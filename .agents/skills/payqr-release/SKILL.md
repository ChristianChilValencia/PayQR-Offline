---
name: payqr-release
description: Verify PayQR changes and prepare EAS development or preview releases, including native runtime compatibility and repository delivery.
---

# PayQR verification and delivery

Read AGENTS.md, package.json, eas.json, app configuration, and SECURITY.md. Fetch docs matching the installed Expo major for API/config changes; start other Expo/EAS research at https://docs.expo.dev/llms.txt. Use the current lockfile to choose npm/npx or Bun/bunx.

## Verification scope

Always run lint and typecheck. Run relevant Jest tests for behavioral changes; use the full npm test suite for changes spanning domain, persistence, or multiple screens. For dependency, native, or configuration changes, also run Expo dependency compatibility checks, expo-doctor, public config evaluation, and an Android export as appropriate. Record failures and distinguish pre-existing issues from regressions. Do not use forced audit fixes across SDK versions.

Read current advisory results rather than repeating historical counts from SECURITY.md. Keep genuine QR samples, credentials, signing keys, and generated artifacts out of commits.

## Native delivery

The development profile supplies a development client; preview produces an internal Android APK. OCR, app discovery, and new native dependencies require a new binary. Preserve the fingerprint runtime policy so OTA updates cannot target incompatible native builds.

Keep application ID and signing identity when testing upgrades. Test retained QRs/numbers/labels, restart recovery, QR import, OCR, clipboard/app launch, PNG sharing/saving, backup restore, and deletion on a device when relevant. Rollback binaries must retain the encrypted storage reader.

Use npx eas-cli@latest (bunx eas-cli in Bun projects). Build, submit, or publish updates only when the user's task authorizes that action; preparing a release alone does not request a cloud build. Follow SECURITY.md's signing setup when explicitly configuring signed updates, preserving the private key outside source control.

## Git delivery

Inspect status and diff before staging. Stage only intended files, commit after required checks, and push when requested. This repository currently uses main locally and on origin; verify upstream instead of recreating master or force-pushing. Report the commit, checks performed, and any material remaining device validation.
