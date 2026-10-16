# PayQR

An offline-first payment helper for keeping payment QR codes and mobile numbers within easy reach. Built with React Native, Expo SDK 57 and TypeScript, PayQR brings saved QRs, camera-based number capture and payment app shortcuts into one place.

## Why I built this

I built PayQR because getting a QR code from GCash often felt slower than it needed to be. I had to go online and open the app just to retrieve my QR, especially when I had forgotten to save a copy beforehand.

Typing mobile numbers by hand was another hassle. That is where OCR scan capture came in handy: capture a number with the camera, review the detected text and copy it without typing every digit.

Keeping track of multiple QR codes was exhausting too. I wanted a simple place to save, browse and reuse them, with my QRs and numbers available even without an internet connection.

## Features

- **Offline QR access:** import a recipient QR image, save it and reopen it later.
- **QR collection:** browse saved QRs and switch the active recipient from Settings.
- **Camera OCR:** capture Philippine mobile numbers using on-device text recognition on Android.
- **Saved numbers:** review, correct, save and copy numbers for later use.
- **Payment app shortcuts:** copy a number and open a selected installed app.
- **Payment card exports:** share or download a QR card with the entered amount.
- **Backup & restore:** export saved QRs, numbers, labels and apps to a ZIP, or import a backup from Settings.
- **Local storage:** saved QRs, numbers and app selections persist across restarts.

PayQR is a payment helper, not an official GCash app. It does not send money or confirm payments. Offline access covers saved information and supported on-device features; completing a payment still depends on the payment provider. Amount prefilling depends on QR compatibility; the current routing approval list is empty, so imported payloads remain unchanged.

## Screenshots

Replace each placeholder below with a screenshot. In GitHub's README editor, drag or paste an image into the editor, then move the generated `![description](image-url)` Markdown into the matching table cell. Keep each cell's image Markdown on one line.

| QR screen | Number screen | OCR capture |
| :---: | :---: | :---: |
| **Paste QR screen image here** | **Paste Number screen image here** | **Paste OCR capture image here** |
| View your saved QR and enter an amount. | Enter, save and copy a mobile number. | Capture a number with the camera. |

| Saved QR collection | Saved numbers | Payment app picker |
| :---: | :---: | :---: |
| **Paste saved QR collection image here** | **Paste saved numbers image here** | **Paste payment app picker image here** |
| Browse and reuse recipient QRs. | Keep frequently used numbers handy. | Choose an app to open after copying. |

Example replacement for a table cell:

```markdown
![QR screen](assets/screenshots/qr-screen.png)
```

For repository images, add the files under `assets/screenshots/` and use their relative paths, as shown above.

## Android development build

```powershell
npm ci
npx eas-cli@latest build --platform android --profile development
# Install the resulting APK on your phone, then:
npm start
```

Camera OCR and installed-app discovery require this native build. Connect the phone and computer to the same reachable network and open PayQR's development client. Expo Go and iOS cannot scan numbers offline; manual entry remains available. The preview APK profile is retained for standalone use.

Dependencies were installed using Expo's SDK resolver. SDK patch versions and all resolved packages are committed in `package-lock.json`. Do not run forced dependency upgrades across SDK versions.

## Use

1. In Settings, import an image containing exactly one legitimate recipient QR. Review the unsaved preview, then Save to make it active or Reset to discard it. Cancellation and failed saves preserve the active QR; a failed save keeps the preview available for retry. Leaving Settings discards an unsaved preview.
2. On QR, enter pesos with up to two decimal places, such as `250`, `250.5`, or `250.00`. Valid edits save automatically. Empty input and trailing decimal points retain the last valid QR. The technical maximum is PHP 999,999,999.00, not a wallet limit. At zero the original QR is shown and exports are disabled. Reset clears only the amount.
3. Supported PHP EMV templates receive an amount in field 54 after currency field 53, initiation field 01 becomes 12, and CRC is recalculated. Recipient/routing fields are preserved. Unsupported templates stay unchanged. Confirm recipient and exact amount with a real GCash scan; local validation does not confirm wallet acceptance or payment.
4. Controls use Lucide React Native SVG icon components. Share and Download are adjacent icon buttons; long press for their names. Exports freeze the card and are disabled during incomplete edits or saving. The amount controls stay directly above the QR tab bar: tap minus/plus for one peso, or hold to repeat, preserving centavos. Settings history exports use the current saved amount without changing the active QR. APK gallery downloads use `payqr_YYYY-MM-DD_HH-mm-ss-SSS.png` with the device-local date and time.
5. On Number, enter the full mobile number in one field. A leading `9` automatically becomes `09`; typing `+639` or `639` converts it to `09` as you continue. Pasting a complete `09...`, `639...` or `+639...` number normalizes it; spaces and hyphens are allowed in complete pasted numbers. Malformed and overlong input is rejected. Save Number persists a valid manual or corrected number. Copy Number and Copy & Open App require a complete eleven-digit number. Scan Camera and Copy & Open App share a fixed footer above the Number tab bar.
6. Scan with camera opens the separate capture screen. Complete OCR candidates are saved automatically as scanned numbers. Select a detected number explicitly, correct it if needed, then copy or save. Temporary captures are deleted after recognition.
7. Choose app opens a searchable bottom sheet. Dismiss using the backdrop, header drag, Cancel or Android Back. Android lists installed apps; iOS supports its limited app-link picker and a custom-link form inside the sheet. Saving blocks dismissal. Copy & Open App copies first, then launches without appending numbers or amounts.
8. Settings lists saved QRs, numbers and apps, newest first. Activate or use an entry, export/copy/test it, or confirm deletion. Deleting an active QR or app clears its selection while preserving other history. QR history stores payload strings, not images. Previews and thumbnails are generated from those strings; original imported photos are untouched.

OCR uses bundled [ML Kit Latin recognition](https://developers.google.com/ml-kit/vision/text-recognition/v2/android), with no first-use model download. Captures are deleted after processing, including cancellation and recognition failure. Complete detected numbers are saved locally; transient OCR result rows are discarded when the capture screen closes. Camera previews are released during OCR and while backgrounded.

Package sources: [GCash](https://play.google.com/store/apps/details?id=com.globe.gcash.android), [GoTyme](https://play.google.com/store/apps/details?id=ph.com.gotyme), [MariBank PH](https://play.google.com/store/apps/details?id=ph.seabank.seabank), [Maya](https://play.google.com/store/apps/details?id=com.paymaya), [PayPal](https://play.google.com/store/apps/details?id=com.paypal.android.p2pmobile). Discovery determines availability.

## Payload and storage design

`src/domain` contains strict amounts, phone recognition, TLV parsing/serialization, CRC-16/CCITT-FALSE, recipient masking, explicit routing approval, immutable export snapshots and import coordination. ASCII EMV candidates are checked for boundaries, duplicate tags, nested templates and final CRC. Unknown field values and routing content are preserved. Unsupported readable formats remain unchanged. A valid checksum never grants rewrite eligibility.

`APPROVED_ROUTING` in `src/domain/core.ts` is intentionally empty. Enabling a profile requires a legitimate recipient sample, documented routing rules and a real GCash scan confirming exact recipient and amount. Synthetic fixtures are marked TEST ONLY and do not establish compatibility. The engine's explicit evidence predicate exists for isolated structural tests; the application never supplies an override. Rewrites remove 54, insert it immediately after 53, set 01 to 12, and recompute final 63. This is unverified local amount prefilling, not a provider-issued payment request.

The decrypted version-3 history record contains QR, number and app collections, active QR/app identifiers and integer centavos. Existing version-1 and version-2 records migrate without losing the recipient, amount or app. The existing storage key remains compatible. Numbers deduplicate by normalized number, apps by package/link, and QRs by original payload. Writes are serialized and derive from the latest committed record. Imports decode the selected photo into an unsaved payload preview; only Save commits metadata. No QR image is copied or stored. Failed saves retain the draft, and draft replacement/reset or navigation away discards the preview. Old app-owned QR image copies are cleaned only after successful migration; base64 image data is removed from saved metadata. Hydration validates stored data and recomputes QR validation rather than trusting stored approval flags.

`src/services/platform.ts` isolates Expo APIs. Screen modules handle input, accessibility, scrolling, safe areas and keyboard avoidance. The QR uses black modules on white with at least four modules of quiet zone and text outside it. On Android and iOS, payload strings and metadata are encrypted with AES-256-GCM using a device key held in Expo SecureStore. Browser history remains unencrypted browser storage. Android automatic backup is disabled. See [SECURITY.md](SECURITY.md) for migration, release requirements, and remaining advisories. Gallery exports are user-visible files. Uninstalling or clearing app data removes local history.

Reference projects `../OFFLINE-GCASH-QR` and `../Tagpila` were read only. Amount/phone/TLV/CRC validation was adapted and hardened from the older helper. Tagpila's private QR cache was inspected for the persistent-copy pattern; the current checkout contained no amount-insertion implementation to copy. Roboto Regular, Medium and Bold were copied with their [Apache license](assets/fonts/LICENSE-Roboto.txt). New blue/navy icon artwork is reproducible with `node scripts/icon.cjs`.

## ZIP backup and restore

In Settings, use **Export ZIP** to save or share your QRs, numbers, labels and apps. Use **Import ZIP** to merge a PayQR backup with your current collection. Existing entries win duplicates, and your selected QR, app and amount stay unchanged. Invalid backups are rejected before saving.

**Security:** ZIP backups have no password or encryption; anyone with the file can read or modify them. Keep them private and import only trusted backups. Local history is encrypted on Android and iOS, while browser storage is unencrypted. See [SECURITY.md](SECURITY.md) for details.

## Verify

```powershell
npm run typecheck
npm run lint
npm test
npx expo install --check
npx expo-doctor
npx expo config --type public
npx expo export --platform android
```

The renderer test rasterizes the actual QR component's SVG output and independently decodes the resulting PNG using jsQR. It does not exercise Android view-shot or establish GCash acceptance. Generated fixtures and verification artifacts go in ignored `artifacts/`. Keep genuine samples in ignored `private-samples/` and do not commit credentials or private QR images.

## Standalone APK

`eas.json` includes an internal-distribution `preview` profile with `android.buildType: "apk"`.

```powershell
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```

EAS account/project setup, network access and signing/build tooling are required. No cloud build or APK was requested or executed here. After installation, stored QR rendering, amount display, number recognition and clipboard operations are local; sharing/gallery/launching depend on device services. Expo Go development-server connectivity and GCash payment connectivity are separate. PayQR cannot make a GCash payment work offline or confirm payment.

Official API references used: [SDK 57 Camera](https://docs.expo.dev/versions/v57.0.0/sdk/camera/), [ImagePicker](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/), [FileSystem legacy](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem-legacy/), [MediaLibrary](https://docs.expo.dev/versions/v57.0.0/sdk/media-library/), [view-shot](https://docs.expo.dev/versions/v57.0.0/sdk/captureRef/), [Font](https://docs.expo.dev/versions/v57.0.0/sdk/font/), [Clipboard](https://docs.expo.dev/versions/v57.0.0/sdk/clipboard/), [Linking](https://docs.expo.dev/versions/v57.0.0/sdk/linking/), [Sharing](https://docs.expo.dev/versions/v57.0.0/sdk/sharing/), [Router](https://docs.expo.dev/versions/v57.0.0/sdk/router/).

## Native app picker

`modules/payqr-launcher` is a local Expo module, automatically linked by Expo. Its library manifest queries launchable Android activities without `QUERY_ALL_PACKAGES`. It lists app names/icons locally and launches the saved package. Root `android/` and `ios/` remain generated by Expo. iOS checks only declared supported schemes and uses a custom-link fallback; it does not enumerate all installed apps.

Rebuild with `npx eas-cli@latest build --platform android --profile preview` for the native picker. The existing Expo Go scripts still preview other functions. App identifiers are now `com.payqr.helper`; this installs separately from earlier `com.bluepeso.helper` builds. Existing in-app records under the old storage key remain readable when the sandbox is retained.
