import { apiGet, apiPost, apiUpload } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeParse } from '../utils/safeParse';

const KEY_PROFILE = 'KEY_PROFILE';

// Get user profile from backend
export async function getProfile() {
  try {
    const data = await apiGet('/users/get-users-profile/');
    if (data && (data.id || data.user)) {
      const user = data.user || data;
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
        address: user.manualAddress?.address1 || '',
        addressSupplement: user.manualAddress?.address2 || '',
        city: user.manualAddress?.city || '',
        postalCode: user.manualAddress?.postalCode || '',
        country: user.manualAddress?.country || '',
        role: user.role_name || user.role || 'user',
      };
      await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify(profile));
      return profile;
    }
  } catch (_e) {
    console.log('Failed to fetch profile from backend, using local cache');
  }

  // Fallback to local profile (corrupted JSON → null, not crash)
  const raw = await AsyncStorage.getItem(KEY_PROFILE);
  return safeParse(raw, null);
}

// Update profile on backend.
// Read current profile straight from local cache (never re-fetch from
// backend here, to avoid overwriting freshly-edited fields with a stale
// server snapshot when backend is slow/down).
export async function updateProfile(profileData) {
  let data = {};
  try {
    data = await apiPost('/users/update-profile/', {
      firstName: profileData.prenom || profileData.firstName,
      lastName: profileData.nom || profileData.lastName,
      username: profileData.pseudo || profileData.username,
      email: profileData.email,
      phone: profileData.phone,
    });
  } catch (e) {
    // Backend unreachable — still persist changes locally so user's edits
    // aren't lost. Sync can be retried later.
    const raw = await AsyncStorage.getItem(KEY_PROFILE);
    const current = safeParse(raw, {}) || {};
    const updated = { ...current, ...profileData, _unsynced: true };
    await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify(updated));
    return { success: true, profile: updated, offline: true, message: e.message };
  }

  if (data?.status || data?.id) {
    const raw = await AsyncStorage.getItem(KEY_PROFILE);
    const current = safeParse(raw, {}) || {};
    const updated = { ...current, ...profileData };
    delete updated._unsynced;
    await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify(updated));
    return { success: true, profile: updated };
  }

  return { success: false, message: data?.message || 'Update failed' };
}

// Upload profile photo
export async function uploadProfilePhoto(uri) {
  const formData = new FormData();
  formData.append('profileImage', {
    uri,
    type: 'image/jpeg',
    name: 'profile.jpg',
  });

  const data = await apiUpload('/users/update-profile/', formData);
  return data;
}

// Get/update address
export async function updateAddress(addressData) {
  const data = await apiPost('/users/get-automatic-address/', addressData);
  return data;
}

// Save user data locally (for offline support)
export async function saveUserDataLocally(key, data) {
  const authRaw = await AsyncStorage.getItem('KEY_AUTH');
  const auth = safeParse(authRaw, null);
  if (!auth) return;
  const userKey = 'USER_' + (auth.email || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const savedRaw = await AsyncStorage.getItem(userKey + '_DATA');
  const saved = safeParse(savedRaw, {}) || {};
  saved[key] = data;
  await AsyncStorage.setItem(userKey + '_DATA', JSON.stringify(saved));
}
