# Security and release notes

## Local history

Android and iOS encrypt the version-3 history record using AES-256-GCM through Expo Crypto. A separate random 256-bit key is held in Expo SecureStore, accessible only while the device is unlocked; on iOS it uses `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. Only the small key goes in SecureStore, avoiding its platform limits for large histories. AsyncStorage holds the authenticated ciphertext, including its random nonce and tag.

Existing plaintext `payqr.v1` or `bluepeso.v1` records are validated and migrated on startup. The device key is saved first, then the encrypted record replaces `payqr.v1`. Only after that write succeeds is `bluepeso.v1` removed. Failure blocks entry into the app with a retry action instead of allowing empty state to overwrite unreadable history. Old app-owned QR images are cleaned after persistence succeeds. Encryption does not protect an unlocked compromised device, clipboard contents, screenshots, or PNGs deliberately shared or saved to the gallery.

Browser history remains unencrypted browser storage. The browser build has no device key store. Avoid using it for sensitive payment history on shared devices. Android automatic app backup is disabled; existing cloud backup copies are not retroactively erased by this setting. Uninstalling/clearing app data removes history; a key retained by the iOS Keychain alone cannot recover deleted ciphertext.

QR import rejects files above 20 MB or images above 40 megapixels when picker metadata is available. The web scanner also rejects excessive decoded dimensions and caps its scan canvas at 2048 pixels per side. Browser image decoding still occurs before decoded dimensions can be checked, so these limits are not a complete defense against a malicious image decoder exploit.

## ZIP backups

Settings exports a normal, unencrypted ZIP with exactly one STORE-only `payqr-backup.json` entry containing a versioned PayQR history document. No password is required. Anyone with this file can read or modify its contents; there is no cryptographic authentication. Keep backups private and import only trusted files. Native local-history encryption is unchanged. Earlier encrypted backups are unsupported by this flow.

Import rejects extra/duplicate entries, traversal paths, compressed entries, invalid formats, prototype-pollution keys, oversized documents, and invalid history fields. Limits are 2 MB per archive, 1 MB per document, and 1,000 entries per category. QR validation is recomputed. Files are never extracted to filesystem paths; STORE-only archives avoid decompression bombs. Validation protects app integrity, not the authenticity or privacy of the file.

Choosing a valid PayQR ZIP immediately merges it without a preview or confirmation modal. Merges use the latest record in the serialized transaction; current entries win duplicates. Existing selections and amount remain, and imported apps are never selected or launched automatically. Invalid files never write history. Failed persistence preserves existing history; choose the ZIP again to retry.

Picker cache copies are deleted after reading. Native exported ZIPs remain in app-private cache so Android receivers can consume them after the chooser returns. Exports older than 24 hours are removed on the next export or by OS eviction; deletion is not timer-guaranteed. These cached exports contain plaintext history. Browser object URLs are released after 60 seconds; user-saved/shared copies remain at their chosen destinations.

Native file dialogs and receiver behavior still require device smoke tests. Existing dependency advisories remain; this is not a claim that the app is vulnerability-free.

## Build and update compatibility

These changes add `expo-crypto` and `expo-secure-store` and require a new development/preview/production binary. Build with `npx eas-cli@latest build --platform android --profile preview` (or the development profile for development). Test an upgrade over the existing installation with the same application ID and signing identity, rather than uninstalling it. Expo's fingerprint runtime policy prevents new OTA updates from targeting older native builds. Do not switch back to the old `appVersion` runtime for this release.

Before distribution, test on a device: upgrade with saved QRs/numbers/labels; restart and verify history; import a QR; capture a number with OCR; copy/open the payment app; save/share a PNG; delete entries and restart. Automated crypto tests exercise real AES-GCM with a Node adapter, enforce Android's byte-only combined-data input, and cover cold module reload, locked-device retry, missing keys and tampering. The reader explicitly decodes persisted base64 to bytes for the SDK 57 Android bridge; existing ciphertext and device keys remain compatible. These tests do not execute the Android/iOS native implementation.

After successful encryption, older app versions that only understand plaintext history cannot read the new stored format. Any rollback binary must retain the encrypted storage reader. Keep the same application ID and signing identity to preserve history during upgrades.

## Dependency advisories

SDK 57 packages are retained at SDK-compatible versions. The audit on 2026-10-16 reported 67 affected packages (50 high, 17 moderate, zero critical), including transitive parent packages. Remaining underlying advisories cover `node-forge`, `braces`, `decode-uri-component`, `sprintf-js`, and `uuid`. This is not a claim that every advisory is reachable in the shipped app. Do not run `npm audit fix --force`: its suggestions include incompatible SDK downgrades/upgrades. Re-run `npm audit` before each release and assess SDK-compatible fixes as published.

`node-forge` and `braces` have no newer published package version at the time of review. The patched URI decoder 0.5.0 is ESM while the installed `query-string` 7 requires a CommonJS function, so a blanket dependency override is unsafe. Upgrade the Router/SDK through its supported migration when compatible fixes become available. Keep development servers private to trusted networks.

## OTA update signing (release setup still required)

OTA signing has intentionally not been activated: a certificate without a securely retained private key and a coordinated publisher setup can prevent updates from installing. Follow [Expo's code-signing setup](https://docs.expo.dev/eas-update/code-signing/):

1. Generate the private key and certificate into ignored `.secrets/`, and back up the key securely outside this repository. Never put it in public source, application assets, or build artifacts.
2. Copy only the public certificate to a tracked path such as `certificates/update-certificate.pem` (force-add that specific public file if the existing `*.pem` ignore applies). Set `updates.codeSigningCertificate` to that path and `updates.codeSigningMetadata` to `{ "keyid": "main", "alg": "rsa-v1_5-sha256" }`.
3. Build a new native binary that embeds the certificate. Publish only matching-runtime updates using `npx eas-cli@latest update --private-key-path .secrets/private-key.pem` and the intended channel. Verify a signed update on a test installation before distributing that binary.
4. Protect the EAS account and any CI publishing token; retain the key for future releases and plan certificate rotation before expiry.

The Expo project ID/update URL are public app configuration, not signing credentials. `.gitignore` excludes environment files, signing keys, keystores, credentials, `.secrets/`, samples, and generated artifacts. Ignoring a file does not remove it from existing Git history. Enable GitHub secret scanning/push protection where available, and use synthetic fixtures rather than genuine payment QR images in public issues.
