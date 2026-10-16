---
name: payqr-history-backup
description: Modify PayQR saved history, encryption, migrations, or ZIP backup and restore without losing records or weakening import validation.
---

# PayQR history and backup

Read SECURITY.md and inspect src/domain/state.ts, src/domain/backup.ts, and the affected storage/backup services. Treat documented formats and limits as current behavior; verify the implementation before changing them.

## Local history

Preserve migrations from older records and compatible storage keys. Hydration validates records and recomputes QR validation rather than trusting stored approval flags. Deduplicate numbers by normalized number, apps by package/link, and QRs by original payload.

Derive mutations from the latest committed record inside serialized operations. Failed persistence must preserve committed history. An unreadable encrypted record must block with a retry path instead of becoming empty history that overwrites data.

Native history uses AES-256-GCM with a separate device key in SecureStore; browser history is plaintext. Save the key before ciphertext and remove legacy records/images only after successful persistence. Do not move full history into SecureStore or log keys, payloads, or private records. Verify SDK docs before changing crypto/storage APIs.

## ZIP restore

Backups are intentionally unencrypted and unauthenticated. Preserve clear disclosure of this fact. The current archive contains exactly one STORE-only payqr-backup.json entry. Validate archive structure, sizes, entry counts, prototype-pollution keys, and history fields before any write. Do not extract archive entries into filesystem paths.

Merge using the latest serialized record: existing entries win duplicates; active QR, selected app, and amount remain unchanged. Imported apps must never launch or become selected automatically. Invalid backups never write history. Preserve picker cleanup and the documented cache lifetime needed by share receivers.

Run npm run lint and npm run typecheck plus relevant history, storage, recovery, migration, and backup tests in __tests__. For migration changes, cover retained records and failed-write recovery. Native encryption, upgrade persistence, and file-dialog behavior need device checks; Node/browser tests alone do not prove them.
