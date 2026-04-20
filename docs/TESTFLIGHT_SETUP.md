# TestFlight setup notes

## One-time setup (done)

The Expo project `@localidad/pearl-list` is already provisioned and the
most recent successful submission was build 13 on April 19, 2026
(version 1.0.0). The following credentials are stored and reusable:

- **Expo project ID**: `c2ae23d8-1884-47ae-b45c-feea16814db6`
- **Apple Team ID**: `5R8LA6469V` (Localidad, Company/Organization)
- **App Store Connect App ID** (Pearl List): `6762128624`
- **Apple Distribution Certificate**: valid until 2026-08-11
- **Provisioning Profile**: valid until 2026-08-11

These are baked into `eas.json` (submit profile) and `app.json`
(extra.eas.projectId + owner).

## Running a fresh build + TestFlight submit

From the repo root:

```bash
# Expo auth (use a personal access token; paste value once, store in shell rc)
export EXPO_TOKEN="<your expo access token>"

# App Store Connect API key for the submit step.
# The .p8 file can only be downloaded once from App Store Connect -
# generate a fresh "App Manager" key at
# https://appstoreconnect.apple.com/access/integrations/api and place it
# under ~/.asc-keys/. This path is personal and NOT committed.
export EAS_ASC_API_KEY_PATH="$HOME/.asc-keys/AuthKey_XXXXXXXXXX.p8"

# Build + auto-submit to TestFlight
eas build --platform ios --profile production --non-interactive --auto-submit
```

If `eas submit` complains that the key can't be set up in
non-interactive mode, add these fields to the `submit.production.ios`
block in `eas.json` temporarily (revert before committing):

```json
"ascApiKeyPath": "/Users/<you>/.asc-keys/AuthKey_XXXXXXXXXX.p8",
"ascApiKeyId": "XXXXXXXXXX",
"ascApiKeyIssuerId": "59cc99d5-0558-4fcc-91a3-8211efe2200b"
```

Issuer ID is constant for the `Localidad` team (see App Store Connect →
Users and Access → Integrations → App Store Connect API).

## Build 13 verified path

- Branch: `claude/mystifying-blackwell`
- Commit: `9dbfaba` (with `.npmrc` → `legacy-peer-deps=true`)
- Build ID: `7a0508e8-3416-4905-9f0c-c77366376168`
- Submission ID: `32595926-23db-4b57-83de-71a5472dfcfd`
- Build time: ~4 min
- Appears in TestFlight ~5-10 min after "Submitted" confirmation
- Live link: https://appstoreconnect.apple.com/apps/6762128624/testflight/ios

## Gotchas to remember

- `npm ci` in EAS Build uses strict peer-dep resolution → `.npmrc` with
  `legacy-peer-deps=true` is required as long as the project pins
  `typescript@6` against packages that declare `peer typescript@^5`.
- EAS auto-increments `ios.buildNumber` in `app.json` on every build
  (appVersionSource: local). Don't hand-edit it; EAS will bump it.
- Apple blocks re-using a buildNumber that's already been submitted.
  If a submit fails partway, bump manually before retry.
- The `--auto-submit` flag on `eas build` only works when a complete
  `submit.production.ios` block (including ascApiKey*) is in eas.json
  at queue-time. Otherwise run `eas submit --id <build-id>` after.
