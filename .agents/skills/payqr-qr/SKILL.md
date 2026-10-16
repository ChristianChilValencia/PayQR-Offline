---
name: payqr-qr
description: Change PayQR payment QR parsing, amount handling, import previews, rendering, or card exports while preserving recipient routing and compatibility evidence.
---

# PayQR payment QR workflow

Read README.md's payload and storage design, then inspect src/domain/core.ts, import.ts, and payment-card.ts plus the affected service/screen. Follow root AGENTS.md for current SDK documentation before using platform APIs.

## Payload invariants

Use integer centavos and the existing strict amount parser. Empty input and incomplete decimal edits must retain the last valid QR. Zero shows the original payload and disables exports. The code's amount maximum is a technical limit, not a wallet limit.

APPROVED_ROUTING is intentionally empty. A valid CRC or synthetic fixture does not establish rewrite compatibility. Do not approve profiles or introduce an application override without legitimate recipient evidence, documented routing rules, and a real GCash scan confirming recipient and exact amount. Keep real samples in ignored private-samples/; use clearly marked TEST ONLY fixtures in source control.

For eligible PHP EMV payloads, preserve recipient, routing, and unknown field values. Remove field 54 before inserting the amount immediately after 53, set initiation field 01 to 12, and recompute final field 63. Keep strict TLV boundaries, duplicate/nested-tag checks, and CRC validation. Unsupported readable payloads remain unchanged. Local prefilling is not a provider-issued dynamic request or payment confirmation.

## Import and export behavior

An imported image creates an unsaved payload preview. Only Save commits it; failed saves keep the draft for retry. Reset, replacement, and navigation discard drafts while cancellation preserves the active QR. Store payload strings, not source photos or base64 images.

Render black modules on white with at least four modules of quiet zone and text outside it. Freeze export snapshots so edits cannot mismatch amount, recipient, and image. Respect platform-specific services for gallery and sharing.

Run npm run lint, npm run typecheck, and relevant domain/import/payment/export tests. Run npm run verify:qr when payload or rendering changes: it independently decodes the rasterized component. This check does not establish native export behavior or GCash acceptance; report those separately.
