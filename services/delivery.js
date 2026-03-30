import AsyncStorage from "@react-native-async-storage/async-storage";
import { CONFIG } from "./config";

// Delivery API - connects to the same backend as Livraison-app
// This allows Liste_Pearl orders to be picked up by delivery drivers
const DELIVERY_BASE = CONFIG.DELIVERY_API_URL || CONFIG.API_URL.replace("/api/v1", "") + "/api/v1/delivery";

async function getAuthHeaders() {
  const raw = await AsyncStorage.getItem("MARKETPLACE_TOKENS");
  const tokens = raw ? JSON.parse(raw) : null;
  const headers = { "Content-Type": "application/json" };
  if (tokens?.access) {
    headers["Authorization"] = `Bearer ${tokens.access}`;
  }
  return headers;
}

async function deliveryFetch(endpoint, options = {}) {
  const headers = await getAuthHeaders();
  const url = `${DELIVERY_BASE}${endpoint}`;
  const res = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  return res.json();
}

// Create a delivery order - called when customer places an order in delivery mode
// This creates an assignment that drivers in Livraison-app can see and accept
export async function createDeliveryOrder(orderData) {
  return deliveryFetch("/create-order/", {
    method: "POST",
    body: JSON.stringify({
      order_id: orderData.id,
      pickup_address: orderData.shops?.map(s => s.address || s.name).join(", ") || "",
      pickup_shop_names: orderData.shops || [],
      delivery_address: orderData.address || "",
      delivery_info: orderData.deliveryInfo || "",
      customer_name: orderData.customerName || "",
      customer_phone: orderData.customerPhone || "",
      items: (orderData.items || []).map(item => ({
        name: item.name || item.title,
        qty: item.qty || 1,
        price: item.price || 0,
        shop: item.shop || "",
      })),
      total: orderData.total || 0,
      delivery_fee: orderData.deliveryFee || 0,
      delivery_slot: orderData.slot || "",
      delivery_date: orderData.deliveryDate || "",
      mode: orderData.mode || "delivery",
    }),
  });
}

// Track delivery status - customer can see where their order is
export async function trackDelivery(orderId) {
  return deliveryFetch(`/track/${orderId}/`);
}

// Get delivery status for an order
export async function getDeliveryStatus(orderId) {
  return deliveryFetch(`/status/${orderId}/`);
}

// Cancel a delivery (customer-side)
export async function cancelDelivery(orderId, reason = "") {
  return deliveryFetch(`/customer-cancel/${orderId}/`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

// Rate a delivery driver
export async function rateDelivery(orderId, rating, comment = "") {
  return deliveryFetch(`/rate/${orderId}/`, {
    method: "POST",
    body: JSON.stringify({ rating, comment }),
  });
}

// Get estimated delivery time for an address
export async function getDeliveryEstimate(address, shopNames = []) {
  return deliveryFetch("/estimate/", {
    method: "POST",
    body: JSON.stringify({ address, shops: shopNames }),
  });
}

// Get available delivery slots
export async function getDeliverySlots(date) {
  return deliveryFetch(`/slots/?date=${date}`);
}

// Delivery status constants (matching Livraison-app flow)
export const DELIVERY_STATUS = {
  PENDING: "pending",           // Order placed, waiting for driver
  ACCEPTED: "accepted",         // Driver accepted the delivery
  PICKUP: "pickup",             // Driver at shop, picking up
  EN_ROUTE: "en_route",         // Driver on the way to customer
  ARRIVED: "arrived",           // Driver arrived at delivery location
  DELIVERED: "delivered",       // Order delivered successfully
  CANCELLED: "cancelled",       // Delivery cancelled
};

// Map delivery status to user-friendly info
export function getDeliveryStatusInfo(status, t) {
  const statusMap = {
    [DELIVERY_STATUS.PENDING]: {
      step: 0,
      label: t ? t("orderStatus.confirmed") : "Confirmed",
      color: "#2563EB",
      icon: "checkmark-circle",
    },
    [DELIVERY_STATUS.ACCEPTED]: {
      step: 1,
      label: t ? t("orderStatus.driverAssigned") : "Driver assigned",
      color: "#F59E0B",
      icon: "person",
    },
    [DELIVERY_STATUS.PICKUP]: {
      step: 2,
      label: t ? t("orderStatus.preparing") : "Preparing",
      color: "#F59E0B",
      icon: "storefront",
    },
    [DELIVERY_STATUS.EN_ROUTE]: {
      step: 3,
      label: t ? t("orderStatus.onTheWay") : "On the way",
      color: "#F97316",
      icon: "bicycle",
    },
    [DELIVERY_STATUS.ARRIVED]: {
      step: 4,
      label: t ? t("orderStatus.almostThere") : "Almost there",
      color: "#8B5CF6",
      icon: "location",
    },
    [DELIVERY_STATUS.DELIVERED]: {
      step: 5,
      label: t ? t("orderStatus.delivered") : "Delivered",
      color: "#059669",
      icon: "checkmark-done",
    },
    [DELIVERY_STATUS.CANCELLED]: {
      step: -1,
      label: t ? t("orderStatus.cancelled") : "Cancelled",
      color: "#EF4444",
      icon: "close-circle",
    },
  };
  return statusMap[status] || statusMap[DELIVERY_STATUS.PENDING];
}
