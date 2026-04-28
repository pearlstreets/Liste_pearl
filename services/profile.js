import { apiGet, apiPost, apiUpload } from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PROFILE = "KEY_PROFILE";

// Normalize a backend address object into app format
function normalizeAddress(addr, index) {
  if (!addr) return null;
  return {
    id: addr.id ? String(addr.id) : String(index + 1),
    address: addr.address1 || addr.address || addr.street || "",
    addressSupplement: addr.address2 || addr.addressSupplement || addr.complement || "",
    city: addr.city || "",
    postalCode: addr.postalCode || addr.postal_code || addr.zipCode || "",
    country: addr.country || "",
    label: addr.label || addr.name || "",
  };
}

// Get user profile from backend
export async function getProfile() {
  try {
    const data = await apiGet("/users/get-users-profile/");
    if (data && (data.id || data.user)) {
      const user = data.user || data;

      // Extract addresses array from backend
      const rawAddresses = user.addresses || user.shippingAddresses || user.deliveryAddresses || [];
      let addresses = rawAddresses.map((a, i) => normalizeAddress(a, i)).filter(Boolean);

      // If no addresses array, fall back to manualAddress
      if (addresses.length === 0 && user.manualAddress?.address1) {
        addresses = [normalizeAddress(user.manualAddress, 0)];
      }

      const profile = {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        pseudo: user.username,
        prenom: user.firstName,
        nom: user.lastName,
        phone: user.phone,
        photo: user.profileImage || null,
        gender: user.gender,
        dob: user.dob,
        addresses,
        selectedAddressId: addresses[0]?.id || null,
        // Keep flat fields for backward compatibility
        address: user.manualAddress?.address1 || "",
        addressSupplement: user.manualAddress?.address2 || "",
        city: user.manualAddress?.city || "",
        postalCode: user.manualAddress?.postalCode || "",
        country: user.manualAddress?.country || "",
        role: user.role_name || user.role || "user",
      };
      await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify(profile));
      return profile;
    }
  } catch (e) {
    console.log("Failed to fetch profile from backend, using local cache");
  }

  // Fallback to local profile
  const raw = await AsyncStorage.getItem(KEY_PROFILE);
  return raw ? JSON.parse(raw) : null;
}

// Update profile on backend
export async function updateProfile(profileData) {
  const data = await apiPost("/users/update-profile/", {
    firstName: profileData.prenom || profileData.firstName,
    lastName: profileData.nom || profileData.lastName,
    username: profileData.pseudo || profileData.username,
    email: profileData.email,
    phone: profileData.phone,
  });

  if (data.status || data.id) {
    // Update local cache
    const current = await getProfile();
    const updated = { ...current, ...profileData };
    await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify(updated));
    return { success: true, profile: updated };
  }

  return { success: false, message: data.message || "Update failed" };
}

// Upload profile photo
export async function uploadProfilePhoto(uri) {
  const formData = new FormData();
  formData.append("profileImage", {
    uri,
    type: "image/jpeg",
    name: "profile.jpg",
  });

  const data = await apiUpload("/users/update-profile/", formData);
  return data;
}

// Get/update address
export async function updateAddress(addressData) {
  const data = await apiPost("/users/get-automatic-address/", addressData);
  return data;
}

// ─── Multi-address CRUD against the Pearl Streets UserAddress endpoints ───
// These mirror the AppUser/WebsiteUser endpoints so pearl-list shares the
// same source of truth — the addresses you manage here surface across the
// whole ecosystem (checkout, delivery, admin).
import { apiPut, apiDelete } from "./api";

function _coerceAddressForBackend(a) {
  // pearl-list local shape → backend UserAddress payload
  return {
    house_building: a.address || a.house_building || "",
    road_area_colony: a.addressSupplement || a.road_area_colony || "",
    pincode: a.postalCode || a.pincode || "",
    city: a.city || "",
    country: a.country || "",
    address_type: a.address_type || "home",
    is_default: !!a.is_default,
  };
}

export async function listUserAddresses() {
  try {
    const res = await apiGet("/users/addresses/");
    const list = res?.data || res?.addresses || [];
    return Array.isArray(list) ? list.map((a, i) => normalizeAddress(a, i)) : [];
  } catch (_) { return []; }
}

export async function createUserAddress(addr) {
  return apiPost("/users/addresses/", _coerceAddressForBackend(addr));
}

export async function updateUserAddress(id, addr) {
  return apiPut(`/users/addresses/${id}/`, _coerceAddressForBackend(addr));
}

export async function deleteUserAddress(id) {
  return apiDelete(`/users/addresses/${id}/`);
}

export async function setDefaultUserAddress(id) {
  return apiPost(`/users/addresses/${id}/set-default/`, {});
}

// Save user data locally (for offline support)
export async function saveUserDataLocally(key, data) {
  const authRaw = await AsyncStorage.getItem("KEY_AUTH");
  if (!authRaw) return;
  const auth = JSON.parse(authRaw);
  const userKey = "USER_" + (auth.email || "").toLowerCase().replace(/[^a-z0-9]/g, "_");
  const savedRaw = await AsyncStorage.getItem(userKey + "_DATA");
  const saved = savedRaw ? JSON.parse(savedRaw) : {};
  saved[key] = data;
  await AsyncStorage.setItem(userKey + "_DATA", JSON.stringify(saved));
}
