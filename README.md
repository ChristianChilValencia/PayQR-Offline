# BluePeso

An Android payment helper built with TypeScript, Expo SDK 57 and Expo Router. Payment QR, Scan Number and Settings retain their state while switching tabs. No backend, analytics, provider credentials, OCR downloads or payment submission are included.

## Run in Expo Go

```powershell
cd D:\Documents\OFFLINE-GCASH-QR-EXPO
npm ci
npx expo start --go
```

Install the SDK 57 compatible [Expo Go](https://expo.dev/go) on Android. Connect the phone and computer to the same network, allow Node/Metro through Windows Firewall on the private network, then scan the terminal's development-server QR using Expo Go. This QR opens the helper; it is not a payment QR. VPNs, guest Wi-Fi isolation and firewalls can prevent LAN connections. If needed, stop the server and use `npx expo start --go --tunnel` (requires network access and Expo's tunnel tooling), or use a reachable LAN address. No Android device launch was verified during implementation; see [VERIFICATION.md](VERIFICATION.md).

Dependencies were installed using Expo's SDK resolver. SDK patch versions and all resolved packages are committed in `package-lock.json`. Do not run forced dependency upgrades across SDK versions.

## Use

1. Import an image containing exactly one legitimate recipient QR. Cancelled, invalid or failed imports preserve the previous working recipient. Use a cropped, clear QR image; Android's image scanner works best when the QR occupies most of the image.
2. Enter whole pesos, starting at zero. Invalid pasted input stays visible; the last successfully saved amount stays on the card. The technical maximum is ₱999,999,999 and is not a GCash limit. At zero the original payload is shown and PNG export is disabled.
3. The original QR is preserved for every production profile currently. **Enter this amount in GCash.** Check the recipient and amount in GCash, especially if the imported QR already contains an amount.
4. Share PNG or Save to Gallery exports the displayed payment card, including recipient, requested amount and status. Permission denial and unavailable sharing are reported. Changes during capture cannot alter the frozen card labels or payload.
5. On Scan Number, paste text or enter `09xxxxxxxxx` / `+639xxxxxxxxx`; spaces and hyphens are allowed. Select a recognized candidate, correct it if needed, then copy it. Multiple candidates require explicit selection.
6. Settings accepts a configured HTTPS or custom-scheme link, with no default. Save it or explicitly Test Link. HTTPS may open a browser; syntax validation does not verify the destination. Copy & Open App copies successfully before opening the exact configured link. It never inserts the number into the URL or pastes automatically.

## Support

| Capability                                                         | Initial Expo Go version                                                                       |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| QR image import, strict validation, rendering, private persistence | Implemented; device verification pending                                                      |
| Amount rewriting                                                   | Engine implemented and tested; production allowlist empty pending legitimate profile evidence |
| PNG export                                                         | Share PNG; SDK 57 gallery API with permission handling; device verification pending           |
| Manual/pasted phone recognition and copy                           | Implemented                                                                                   |
| Configured-link launch                                             | Conditional on configuration and a device handler                                             |
| Image OCR                                                          | Disabled: “Image-based offline OCR requires a future development build.”                      |
| Installed-app picker                                               | Deferred; native feasibility work required                                                    |
| Payment confirmation/reconciliation                                | Outside this local helper                                                                     |

## Payload and storage design

`src/domain` contains strict amounts, phone recognition, TLV parsing/serialization, CRC-16/CCITT-FALSE, recipient masking, explicit routing approval, immutable export snapshots and import coordination. ASCII EMV candidates are checked for boundaries, duplicate tags, nested templates and final CRC. Unknown field values and routing content are preserved. Unsupported readable formats remain unchanged. A valid checksum never grants rewrite eligibility.

`APPROVED_ROUTING` in `src/domain/core.ts` is intentionally empty. Enabling a profile requires a legitimate recipient sample, documented routing rules and a real GCash scan confirming exact recipient and amount. Synthetic fixtures are marked TEST ONLY and do not establish compatibility. The engine's explicit evidence predicate exists for isolated structural tests; the application never supplies an override. Rewrites remove 54, insert it immediately after 53, set 01 to 12, and recompute final 63. This is unverified local amount prefilling, not a provider-issued payment request.

A version-1 AsyncStorage record contains original decoded payload, private copied image URI, recomputed validation/profile result, integer centavos and settings. Metadata writes are serialized and only committed after the image is copied. Import operation IDs reject stale results; staging and obsolete images are cleaned after failures/success respectively. Cancellation applies until metadata commit starts. Hydration rejects invalid versions, amounts, links, malformed payloads and missing images; it never trusts stored approval flags. On hydration failure the error is shown and the helper starts empty without treating the stored record as valid. A later explicit successful edit/import replaces the bad record.

`src/services/platform.ts` isolates Expo APIs. Screen modules handle input, accessibility, scrolling, safe areas and keyboard avoidance. The QR uses black modules on white with at least four modules of quiet zone and text outside it. Original images and metadata are in app-private storage, not encrypted storage. Gallery exports are user-visible files. Uninstalling or clearing app data removes the local recipient.

Reference projects `../OFFLINE-GCASH-QR` and `../Tagpila` were read only. Amount/phone/TLV/CRC validation was adapted and hardened from the older helper. Tagpila's private QR cache was inspected for the persistent-copy pattern; the current checkout contained no amount-insertion implementation to copy. Roboto Regular, Medium and Bold were copied with their [Apache license](assets/fonts/LICENSE-Roboto.txt). New blue/navy icon artwork is reproducible with `node scripts/icon.cjs`.

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

EAS account/project setup, network access and signing/build tooling are required. No cloud build or APK was requested or executed here. After installation, stored QR rendering, amount display, number recognition and clipboard operations are local; sharing/gallery/launching depend on device services. Expo Go development-server connectivity and GCash payment connectivity are separate. BluePeso cannot make a GCash payment work offline or confirm payment.

Official API references used: [SDK 57 Camera](https://docs.expo.dev/versions/v57.0.0/sdk/camera/), [ImagePicker](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/), [FileSystem legacy](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem-legacy/), [MediaLibrary](https://docs.expo.dev/versions/v57.0.0/sdk/media-library/), [view-shot](https://docs.expo.dev/versions/v57.0.0/sdk/captureRef/), [Font](https://docs.expo.dev/versions/v57.0.0/sdk/font/), [Clipboard](https://docs.expo.dev/versions/v57.0.0/sdk/clipboard/), [Linking](https://docs.expo.dev/versions/v57.0.0/sdk/linking/), [Sharing](https://docs.expo.dev/versions/v57.0.0/sdk/sharing/), [Router](https://docs.expo.dev/versions/v57.0.0/sdk/router/).
