import { apiPost, saveTokens, clearTokens, getTokens, apiGet } from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_AUTH = "KEY_AUTH";
const KEY_PROFILE = "KEY_PROFILE";

// Register a new user on the Marketplace backend
export async function registerUser({ username, email, password, firstName, lastName, phone, address }) {
  const body = {
    username,
    email,
    password,
    firstName,
    lastName,
    phone: phone || "",
    termCondition: true,
    marketingReference: true,
    manualAddress: JSON.stringify(address || { address1: "", city: "", postalCode: "", country: "France" }),
  };

  const data = await apiPost("/users/register/", body);

  if (data.status && data.access_token) {
    await saveTokens(data.access_token, data.refresh_token);
    const user = data.user || {};
    const authData = {
      id: user.id,
      username: user.username || username,
      email: user.email || email,
      firstName: user.firstName || firstName,
      lastName: user.lastName || lastName,
      pseudo: user.username || username,
      prenom: user.firstName || firstName,
      nom: user.lastName || lastName,
      photo: user.profileImage || null,
      role: user.role || "user",
    };
    await AsyncStorage.setItem(KEY_AUTH, JSON.stringify(authData));
    await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify(authData));
    return { success: true, user: authData };
  }

  return { success: false, message: data.message || "Registration failed" };
}

// Login with username/email and password
export async function loginUser(identifier, password) {
  const data = await apiPost("/users/login/", {
    username: identifier,
    password,
  });

  if (data.status && data.access_token) {
    await saveTokens(data.access_token, data.refresh_token);
    const user = data.user || {};
    const authData = {
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
      role: user.role_name || user.role || "user",
    };
    await AsyncStorage.setItem(KEY_AUTH, JSON.stringify(authData));
    await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify(authData));
    return { success: true, user: authData };
  }

  return { success: false, message: data.message || "Login failed" };
}

// Logout
export async function logoutUser() {
  try {
    const tokens = await getTokens();
    if (tokens?.refresh) {
      await apiPost("/users/logout/", { refresh: tokens.refresh });
    }
  } catch (e) {
    // Ignore logout API errors
  }
  await clearTokens();
  await AsyncStorage.removeItem(KEY_AUTH);
}

// Forgot password
export async function forgotPassword(email) {
  const data = await apiPost("/users/forgot-password/", { email });
  return data;
}

// Reset password
export async function resetPassword(email, otp, newPassword) {
  const data = await apiPost("/users/reset-password/", {
    email,
    otp,
    new_password: newPassword,
  });
  return data;
}

// Update password (authenticated)
export async function updatePassword(oldPassword, newPassword) {
  const data = await apiPost("/users/update-password/", {
    old_password: oldPassword,
    new_password: newPassword,
  });
  return data;
}

// Verify OTP
export async function verifyOTP(otp) {
  const data = await apiPost("/users/verify-otp/", { otp });
  return data;
}

// Register a professional user with company details and documents
export async function registerProfessional({ email, password, phone, phoneCode, companyName, managerFullName, siret, vatNumber, sector, address, documents }) {
  const { apiUpload } = require("./api");

  const formData = new FormData();
  formData.append("email", email);
  formData.append("password", password);
  formData.append("confirm_password", password);
  formData.append("phone", phone || "");
  formData.append("phoneCode", phoneCode || "+33");
  formData.append("term_condition", "true");
  formData.append("companyName", companyName || "");
  formData.append("managerFullName", managerFullName || "");
  formData.append("siret", siret || "");
  formData.append("vatNumber", vatNumber || "");
  formData.append("sectorofActivity", sector || "");
  formData.append("manual_address", JSON.stringify(address || { address1: "", city: "", postalCode: "", country: "France" }));

  // Documents obligatoires
  if (documents.kbiss) formData.append("kbiss", { uri: documents.kbiss, type: "application/pdf", name: "kbiss.pdf" });
  if (documents.iban) formData.append("iban", { uri: documents.iban, type: "application/pdf", name: "iban.pdf" });
  if (documents.identityFront) formData.append("identityCardFront", { uri: documents.identityFront, type: "image/jpeg", name: "id_front.jpg" });
  if (documents.identityBack) formData.append("identityCardBack", { uri: documents.identityBack, type: "image/jpeg", name: "id_back.jpg" });
  if (documents.proofOfAddress) formData.append("proofOfAddress", { uri: documents.proofOfAddress, type: "image/jpeg", name: "proof_address.jpg" });

  const data = await apiUpload("/userprofessional/register/", formData);

  if (data.status && data.access_token) {
    await saveTokens(data.access_token, data.refresh_token);
    const user = data.user || {};
    const authData = {
      id: user.id,
      email: user.email || email,
      username: user.userName || email,
      pseudo: user.userName || companyName,
      prenom: managerFullName,
      nom: companyName,
      phone: user.phone || phone,
      photo: null,
      role: "professionaluser",
      isVerified: false,
      companyName: companyName,
    };
    await AsyncStorage.setItem(KEY_AUTH, JSON.stringify(authData));
    await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify(authData));
    return { success: true, user: authData };
  }

  return { success: false, message: data.message || data.error || "Registration failed" };
}

// Get document verification status (professional users)
export async function getDocumentStatus() {
  return apiGet("/userprofessional/document-status/");
}

// Check if user is authenticated (has valid tokens)
export async function isAuthenticated() {
  const tokens = await getTokens();
  if (!tokens?.access) return false;
  try {
    const data = await apiGet("/users/get-users-profile/");
    return data.statusCode === 200 || !!data.id;
  } catch {
    return false;
  }
}
