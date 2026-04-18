import { apiGet } from './api';

// Get company/shop details
export async function getShopDetails(companyId) {
  return apiGet(`/users/company/${companyId}/details`);
}

// Get all professional users (vendors/shops)
export async function getAllShops() {
  const data = await apiGet('/admin/all-prousers-list/');
  const users = Array.isArray(data) ? data : data.results || data.data || [];

  // Map professional users to shop-like objects compatible with Liste_Pearl
  return users
    .filter((u) => u.company || u.companyDetails)
    .map((u) => {
      const company = u.company || u.companyDetails || {};
      return {
        id: company.id || u.id,
        name: company.companyName || company.name || u.userName || 'Shop',
        address: company.address || '',
        city: company.city || '',
        phone: u.phone || '',
        email: u.email || '',
        image: company.coverPhoto || company.logo || null,
        rating: company.average_rating || 0,
        totalRatings: company.total_ratings || 0,
        isVerified: u.is_verified || false,
        categories: u.categories || [],
        distance: null, // Can be calculated from coordinates
        travelTime: null,
        deliveryFee: company.deliveryFee || 3.99,
        lat: company.lat || null,
        lng: company.lng || null,
      };
    });
}

// Get shop media (photos, reels)
export async function getShopMedia(companyId) {
  return apiGet(`/users/company/${companyId}/media/`);
}

// Get shop events
export async function getShopEvents(companyId) {
  return apiGet(`/users/company/${companyId}/event/`);
}

// Get shop reviews
export async function getShopReviews(companyId) {
  return apiGet(`/userprofessional/company/${companyId}/`);
}

// Submit feedback for a shop
export async function submitShopFeedback(companyId, feedback) {
  const { apiPost } = require('./api');
  return apiPost(`/users/company/${companyId}/feedback/`, feedback);
}

// Get home tab data (featured shops, etc.)
export async function getHomeData() {
  return apiGet('/users/home-tab/');
}
