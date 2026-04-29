/**
 * useOtpSender hook for Liste_Pearl (Expo managed).
 *
 * Liste_Pearl uses React Context (not Redux) — this hook stays purely
 * local to the component tree that imports it.
 *
 * Active providers (server-side, no client SDK needed):
 *   - twilio   → backend sends SMS via Twilio Verify
 *   - whatsapp → backend sends OTP via WhatsApp Business API
 *
 * The `firebase` provider is intentionally NOT supported on this client.
 * `expo-firebase-recaptcha` was archived and pulled a vulnerable dep
 * chain (uuid<14, expo-firebase-core, etc.). If the backend returns
 * provider="firebase", the hook reports `shouldFallback=true` so the
 * caller falls back to legacy email/password auth.
 *
 * To re-enable Firebase phone auth in the future, migrate to
 * `@react-native-firebase/auth` (requires EAS Build, native reCAPTCHA
 * is invisible) — or wait for a maintained Expo reCAPTCHA helper.
 */
import { useCallback, useRef, useState } from "react";
import { requestOtp as apiRequestOtp, verifyOtp as apiVerifyOtp } from "./otpV2Client";

export default function useOtpSender({ platform = "app-liste" } = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [provider, setProvider] = useState(null);
  const [shouldFallback, setShouldFallback] = useState(false);
  const sessionRef = useRef({});

  const sendOtp = useCallback(
    async ({ phone, channel = "sms", defaultRegion }) => {
      setLoading(true);
      setError(null);
      setShouldFallback(false);
      setProvider(null);

      const result = await apiRequestOtp({ phone, channel, defaultRegion, platform });

      if (result.fallbackToLegacy) {
        setShouldFallback(true);
        setLoading(false);
        return false;
      }
      if (!result.success) {
        setError(result.error || "send-failed");
        setLoading(false);
        return false;
      }

      // Firebase provider not supported on this client — fallback to legacy.
      if (result.provider === "firebase") {
        setShouldFallback(true);
        setLoading(false);
        return false;
      }

      sessionRef.current = {
        provider: result.provider,
        phone,
        sessionId: result.sessionId,
      };

      setProvider(result.provider);
      setLoading(false);
      return true;
    },
    [platform]
  );

  const verifyOtp = useCallback(async ({ code }) => {
    setLoading(true);
    setError(null);
    const { provider: p, phone, sessionId } = sessionRef.current;
    if (!p || !phone) {
      setError("no-active-session");
      setLoading(false);
      return null;
    }

    // Defensive: firebase sessions never reach this point because sendOtp
    // bails to fallback above, but we guard explicitly anyway.
    if (p === "firebase") {
      setShouldFallback(true);
      setLoading(false);
      return null;
    }

    const payload = { phone, provider: p, code, sessionId };
    const result = await apiVerifyOtp(payload);
    if (result.fallbackToLegacy) {
      setShouldFallback(true);
      setLoading(false);
      return null;
    }
    if (!result.success) {
      setError(result.error || "verify-failed");
      setLoading(false);
      return null;
    }
    setLoading(false);
    sessionRef.current = {};
    return result;
  }, []);

  const reset = useCallback(() => {
    sessionRef.current = {};
    setLoading(false);
    setError(null);
    setProvider(null);
    setShouldFallback(false);
  }, []);

  return { sendOtp, verifyOtp, reset, provider, loading, error, shouldFallback };
}
