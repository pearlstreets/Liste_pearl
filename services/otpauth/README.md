# OTP v2 — Liste_Pearl integration

Expo managed workflow. Phone OTP login via server-side providers
(Twilio Verify, WhatsApp Business). No client-side Firebase SDK.

## Active providers

| Provider | Channel | Where the OTP is sent |
|---|---|---|
| `twilio` | SMS | Twilio Verify (server) |
| `whatsapp` | WhatsApp message | WhatsApp Business API (server) |

The `firebase` provider is **NOT** supported on this client. The hook
treats `provider="firebase"` from the backend as `shouldFallback=true`,
so the caller falls back to legacy email/password auth.

## Why no Firebase phone auth?

Firebase Web SDK requires a reCAPTCHA verifier on RN. Expo's official
adapter `expo-firebase-recaptcha` is **archived** and dragged in a chain
of vulnerable transitive deps (`expo-firebase-core` → old `expo-constants`
→ `uuid<14`, etc.). Removing it brought `npm audit` from 12 moderate to 0.

## How to re-enable Firebase phone auth (future)

Two options, both require a build step beyond Expo Managed:

1. **Migrate to `@react-native-firebase/auth`**
   - Requires EAS Build (or `expo prebuild`) — won't work in Expo Go.
   - The native SDK handles reCAPTCHA invisibly on iOS/Android.
   - User action needed: drop `GoogleService-Info.plist` (iOS) and
     `google-services.json` (Android) from Firebase Console into the
     project, then add the `@react-native-firebase/app` Expo plugin.

2. **Wait for a maintained Expo reCAPTCHA helper**
   - Track https://docs.expo.dev/guides/using-firebase/ for updates.
   - Until then, Twilio + WhatsApp covers the use case.

## Files

- `services/otpauth/otpV2Client.js` — fetch wrappers around `/api/v1/auth/v2/*`
- `services/otpauth/useOtpSender.js` — React hook (Twilio/WhatsApp only)

## Feature flags

Backend `OTP_V2_ENABLED`:
- `false` (default) → client reports `shouldFallback=true`, existing
  `services/auth.js` `verifyOTP()` path runs.
- `true` → v2 active for Twilio/WhatsApp providers.
