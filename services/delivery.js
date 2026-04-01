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

// === Particulier delivery mode (casual driver) ===
const KEY_DRIVER_MODE = "PEARL_DRIVER_MODE";
const KEY_DRIVER_EARNINGS = "PEARL_DRIVER_EARNINGS";
const KEY_DRIVER_COUNTRY = "PEARL_DRIVER_COUNTRY";

// Earnings limits per country
export const COUNTRY_LIMITS = {
  FR: { limit: 3000, label: "France", flag: "🇫🇷", status: "ok", taxInfo: "Régime micro-BIC — Abattement 50% sur revenus imposables", beyondMsg: "Au-delà de 3 000 € → compte bloqué, statut auto-entrepreneur requis" },
  BE: { limit: 7700, label: "Belgique", flag: "🇧🇪", status: "ok", taxInfo: "Économie collaborative — Taux fixe 10,7% prélevé par la plateforme", beyondMsg: "Au-delà de 7 700 € → statut d'indépendant requis" },
  DE: { limit: 0, label: "Allemagne", flag: "🇩🇪", status: "gray", taxInfo: "Pas de cadre spécifique. Revenus à déclarer en \"revenus divers\".", beyondMsg: "Service non disponible — cadre légal non défini" },
  IT: { limit: 0, label: "Italie", flag: "🇮🇹", status: "gray", taxInfo: "Pas de cadre spécifique. Revenus à déclarer.", beyondMsg: "Service non disponible — cadre légal non défini" },
  PT: { limit: 0, label: "Portugal", flag: "🇵🇹", status: "gray", taxInfo: "Pas de cadre spécifique. Revenus à déclarer.", beyondMsg: "Service non disponible — cadre légal non défini" },
  NL: { limit: 0, label: "Pays-Bas", flag: "🇳🇱", status: "strict", taxInfo: "Tendance forte à requalifier en salarié. Risque juridique élevé.", beyondMsg: "Service non disponible — risque de requalification en salarié" },
  ES: { limit: 0, label: "Espagne", flag: "🇪🇸", status: "blocked", taxInfo: "Loi 2021 : statut salarié obligatoire pour la livraison.", beyondMsg: "Service interdit — statut salarié obligatoire (Loi Rider 2021)" },
  GB: { limit: 1000, label: "Royaume-Uni", flag: "🇬🇧", status: "ok", currency: "£", taxInfo: "Trading Allowance : sous 1 000 £/an, rien à déclarer. Au-delà, enregistrement self-employed obligatoire auprès de HMRC.", beyondMsg: "Au-delà de 1 000 £ → enregistrement self-employed + déclaration HMRC obligatoire" },
  CH: { limit: 0, label: "Suisse", flag: "🇨🇭", status: "blocked", taxInfo: "Depuis mars 2023, les livreurs sont considérés comme salariés en Suisse (gig economy).", beyondMsg: "Service non disponible — statut salarié obligatoire en Suisse" },
};

export function getCountryLimit(countryCode) {
  return COUNTRY_LIMITS[countryCode] || COUNTRY_LIMITS['FR'];
}

// Set driver country
export async function setDriverCountry(code) {
  await AsyncStorage.setItem(KEY_DRIVER_COUNTRY, code);
}

// Get driver country
export async function getDriverCountry() {
  const raw = await AsyncStorage.getItem(KEY_DRIVER_COUNTRY);
  return raw || 'FR';
}

// Enable/disable casual driver mode for a regular user
export async function toggleDriverMode(enabled, countryCode) {
  await AsyncStorage.setItem(KEY_DRIVER_MODE, JSON.stringify(enabled));
  if (countryCode) await setDriverCountry(countryCode);
  try {
    await deliveryFetch("/toggle-casual-driver/", {
      method: "POST",
      body: JSON.stringify({ is_casual_driver: enabled, country: countryCode || 'FR' }),
    });
  } catch (e) {}
  return enabled;
}

// Check if casual driver mode is active
export async function isDriverMode() {
  const raw = await AsyncStorage.getItem(KEY_DRIVER_MODE);
  return raw ? JSON.parse(raw) : false;
}

// Get casual driver earnings for current year
export async function getDriverEarnings() {
  const country = await getDriverCountry();
  const limit = getCountryLimit(country).limit;
  try {
    const data = await deliveryFetch("/earnings/");
    if (data && data.total_year !== undefined) {
      const enriched = { ...data, limit, remaining: Math.max(0, limit - (data.total_year || 0)), country };
      await AsyncStorage.setItem(KEY_DRIVER_EARNINGS, JSON.stringify(enriched));
      return enriched;
    }
  } catch (e) {}
  const raw = await AsyncStorage.getItem(KEY_DRIVER_EARNINGS);
  return raw ? JSON.parse(raw) : { total_year: 0, remaining: limit, limit, country };
}

// Check if user can still deliver (under country threshold)
export async function canDeliver() {
  const earnings = await getDriverEarnings();
  return (earnings.total_year || 0) < earnings.limit;
}

// Get available deliveries for casual drivers
export async function getAvailableDeliveries() {
  return deliveryFetch("/available/");
}

// Accept a delivery as casual driver
export async function acceptDelivery(assignmentId) {
  return deliveryFetch(`/accept/${assignmentId}/`, { method: "POST" });
}

// Update delivery status
export async function updateDeliveryStatusDriver(assignmentId, status) {
  return deliveryFetch(`/status/${assignmentId}/`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
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
      color: "#059669",
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
