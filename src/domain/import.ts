import { cleanLabel, migrate, Recipient, RecordV1, SavedQR } from "./state";

/** Only commit the returned record after storage succeeds. */
export function saveRecipient(record: RecordV1, recipient: Recipient) {
  const r = migrate(record);
  const existing = r.qrs?.find((q) => q.payload === recipient.payload);
  const qr: SavedQR = {
    label: cleanLabel(recipient.label) ?? existing?.label,
    payload: recipient.payload,
    validation: recipient.validation,
    id: existing?.id ?? `${Date.now()}-${Math.random()}`,
    date: new Date().toISOString(),
  };
  const qrs = [qr, ...(r.qrs ?? []).filter((q) => q.payload !== qr.payload)];
  return { record: { ...r, recipient: qr, activeQR: qr.id, qrs } };
}

/** Cleanup is safe only after this record has been successfully persisted. */
export function deleteRecipient(r: RecordV1, id: string) {
  const qrs = (r.qrs ?? []).filter((q) => q.id !== id);
  return {
    record: {
      ...r,
      qrs,
      ...(r.activeQR === id ? { activeQR: null, recipient: null } : {}),
    },
  };
}
