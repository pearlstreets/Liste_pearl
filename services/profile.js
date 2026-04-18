import { apiGet, apiPost, apiUpload } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  } catch (e) {
    console.log('Failed to fetch profile from backend, using local cache');
  }

  // Fallback to local profile
  const raw = await AsyncStorage.getItem(KEY_PROFILE);
  return raw ? JSON.parse(raw) : null;
}

// Update profile on backend
export async function updateProfile(profileData) {
  const data = await apiPost('/users/update-profile/', {
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

  return { success: false, message: data.message || 'Update failed' };
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
  if (!authRaw) return;
  const auth = JSON.parse(authRaw);
  const userKey = 'USER_' + (auth.email || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const savedRaw = await AsyncStorage.getItem(userKey + '_DATA');
  const saved = savedRaw ? JSON.parse(savedRaw) : {};
  saved[key] = data;
  await AsyncStorage.setItem(userKey + '_DATA', JSON.stringify(saved));
}
