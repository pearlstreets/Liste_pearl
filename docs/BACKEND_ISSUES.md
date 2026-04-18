# Backend issues on api.pearlstreets.com

> Captured 2026-04-18 from Liste_Pearl mobile app CI. All endpoints tested in-flight
> with `curl` against `https://api.pearlstreets.com/api/v1`. Methods listed are the
> ones the app actually sends.

The mobile app now handles all these cases gracefully (local fallbacks, silent no-op,
or user-visible error) so the **app never crashes** — but the underlying features are
dead or degraded until these are fixed server-side.

---

## 🔴 Blocking — user-visible breakage

### 1. `POST /users/register/` → HTTP 500
**Impact**: new users cannot create an account.
**Reproduction**:
```
curl -X POST https://api.pearlstreets.com/api/v1/users/register/ \
     -H "Content-Type: application/json" \
     -d '{"email":"x@y.com","password":"Passw0rd!","firstName":"A","lastName":"B"}'
```
Returns HTTP 500 (no JSON body, raw 500 from the server). Likely an unhandled exception
in the view — logs should show the traceback.

### 2. `POST /userprofessional/register/` → HTTP 500
Same symptom as #1, for the professional signup flow.

### 3. `GET /users/get-users-profile/` → HTTP 404
**Impact**: post-login profile refresh fails. The mobile app currently papers over this
by caching the `user` object from the login response into `KEY_PROFILE` directly, so
the user still sees their info — but any backend-only field (avatar URL, role
promotions, verification status) is **stale forever**.
**Expected**: endpoint should return the authenticated user's current profile as JSON.

---

## 🟡 Feature-dead — silently falls back to local-only

### 4. `/users/favorites/*` → HTTP 404 (HTML from nginx)
Endpoints affected:
- `GET /users/favorites/`
- `POST /users/favorites/add/`
- `POST /users/favorites/remove/`

**Impact**: favorites work locally on the device but never sync. Uninstalling the app
or switching device loses favorites.

### 5. `/delivery/*` entire module → HTTP 404 (HTML from nginx)
Endpoints affected (all 14 hit by the app):
- `POST /delivery/create-order/`
- `GET  /delivery/track/{orderId}/`
- `GET  /delivery/status/{orderId}/`
- `POST /delivery/customer-cancel/{orderId}/`
- `POST /delivery/rate/{orderId}/`
- `POST /delivery/estimate/`
- `GET  /delivery/slots/`
- `POST /delivery/toggle-casual-driver/`
- `GET  /delivery/earnings/`
- `GET  /delivery/available/`
- `POST /delivery/accept/{assignmentId}/`
- `PATCH /delivery/status/{assignmentId}/`

**Impact**: delivery is completely non-functional. We have hidden the "Become a driver"
CTA in the mobile UI via a feature flag (`FEATURES.delivery` in `services/config.js`)
so users don't hit dead buttons. Flip the flag to `true` in the app config once the
routes are deployed.

---

## ✅ Confirmed working on prod (no action needed, for reference)

| Method | Endpoint | Status |
|---|---|---|
| GET  | `/users/home-tab/` | 200 — returns 6 companies |
| GET  | `/admin/categories-list/` | 200 — 8 categories |
| GET  | `/admin/all-prousers-list/` | 401 — auth required (OK) |
| POST | `/users/login/` | accepts `{username, password}` |
| POST | `/users/logout/` | 401 without token (OK) |
| POST | `/users/forgot-password/` | 200 |
| POST | `/users/reset-password/` | 200 |
| POST | `/users/verify-otp/` | 200 |
| POST | `/users/update-password/` | 401 without token (OK) |
| POST | `/users/update-profile/` | 401 without token (OK) |
| POST | `/users/get-automatic-address/` | 200 |
| GET/POST | `/users/orders/` | 401 without token (OK) |
| GET  | `/userprofessional/document-status/` | 401 without token (OK) |
| GET  | `/userprofessional/get/products/` | 401 without token (OK) |
| POST | `/admin/refresh-token/` | 200 |

---

## How we tested

Probing script (reproducible):
```bash
for e in GET:/users/home-tab/ POST:/users/register/ GET:/users/favorites/ ...; do
  m=${e%%:*}; p=${e#*:}
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 4 -X "$m" \
         "https://api.pearlstreets.com/api/v1${p}")
  echo "$m $p → HTTP $code"
done
```

---

## What we need from backend team

For each of the 🔴 and 🟡 items:
1. Confirm whether the endpoint is planned, in-progress, or intentionally removed.
2. If planned: rough ETA so we can plan the mobile release that flips the feature flag.
3. If removed: let us know so we can rip the calling code out of the mobile app instead
   of keeping it dormant behind a flag.

Contact: mobile team via PR review on
[Liste_pearl#10](https://github.com/pearlstreets/Liste_pearl/pull/10).
