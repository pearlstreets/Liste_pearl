/**
 * OTP v2 API client for Liste_Pearl (Expo managed workflow).
 *
 * Talks to the Pearl Streets Django backend via the base URL resolved
 * in `services/config.js` (staging = pythonapi.digiexports.in).
 *
 * Falls back to legacy OTP (services/auth.js verifyOTP) when backend
 * flag OTP_V2_ENABLED=false — zero regression on existing users.
 */
import config from "../config";

function apiBase() {
  // config.API_URL already includes /api/v1
  return (config.API_URL || "http://localhost:8000/api/v1").replace(/\/+$/, "");
}

export async function requestOtp({
  phone,
  channel = "sms",
  defaultRegion,
  platform = "app-liste",
}) {
  try {
    const response = await fetch(`${apiBase()}/auth/v2/request-otp/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        channel,
        default_region: defaultRegion || "",
        platform,
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (response.status === 503 && data.fallback_to_legacy) {
      return {
        success: false,
        provider: "",
        sessionId: null,
        expiresInSeconds: 0,
        clientHint: {},
        fallbackToLegacy: true,
        error: data.error || "v2-disabled",
      };
    }

    return {
      success: Boolean(data.success),
      provider: data.provider || "",
      sessionId: data.session_id || null,
      expiresInSeconds: data.expires_in_seconds || 300,
      clientHint: data.client_hint || {},
      fallbackToLegacy: false,
      error: data.error || null,
    };
  } catch (err) {
    console.warn("[otpV2] request-otp network error, falling back:", err);
    return {
      success: false,
      provider: "",
      sessionId: null,
      expiresInSeconds: 0,
      clientHint: {},
      fallbackToLegacy: true,
      error: "network-error",
    };
  }
}

export async function verifyOtp({
  phone,
  provider,
  code,
  sessionId,
  firebaseIdToken,
  defaultRegion,
}) {
  try {
    const body = { phone, provider, default_region: defaultRegion || "" };
    if (code) body.code = code;
    if (sessionId) body.session_id = sessionId;
    if (firebaseIdToken) body.firebase_id_token = firebaseIdToken;

    const response = await fetch(`${apiBase()}/auth/v2/verify-otp/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));

    if (response.status === 503 && data.fallback_to_legacy) {
      return {
        success: false,
        provider,
        phoneE164: null,
        firebaseUid: null,
        fallbackToLegacy: true,
        error: data.error || "v2-disabled",
      };
    }

    return {
      success: Boolean(data.success),
      provider: data.provider || provider,
      phoneE164: data.phone_e164 || null,
      firebaseUid: data.firebase_uid || null,
      accessToken: data.access_token || null,
      refreshToken: data.refresh_token || null,
      userId: data.user_id || null,
      userType: data.user_type || "user",
      userFound: Boolean(data.user_found),
      fallbackToLegacy: false,
      error: data.error || null,
    };
  } catch (err) {
    console.warn("[otpV2] verify-otp network error, falling back:", err);
    return {
      success: false,
      provider,
      phoneE164: null,
      firebaseUid: null,
      accessToken: null,
      refreshToken: null,
      userId: null,
      userType: null,
      userFound: false,
      fallbackToLegacy: true,
      error: "network-error",
    };
  }
}
