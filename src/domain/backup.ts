import QR from "qrcode";
import { validateLink, validateQR, MAX_PESOS } from "./core";
import { readPackageTarget } from "./launcher";
import { migrate, RecordV1, SavedApp, SavedNumber, SavedQR } from "./state";

export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
export const MAX_HISTORY_BYTES = 1024 * 1024;
const MAX_ENTRIES = 1000;
const invalid = () => new Error("This backup contains invalid or unsupported data.");
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, limit: number): string {
  if (typeof value !== "string" || !value.length || value.length > limit || /[\x00-\x1f\x7f]/.test(value)) throw invalid();
  return value;
}
function label(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  return text(value, 160).trim() || undefined;
}
function date(value: unknown): string {
  const result = text(value, 40);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(result) || !Number.isFinite(Date.parse(result))) throw invalid();
  return result;
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length > MAX_ENTRIES) throw invalid();
  return value;
}
function unique(values: string[]) {
  if (new Set(values).size !== values.length) throw invalid();
}

/** Construct only known fields; imported approval flags, images and extra properties never survive. */
export function validateBackupRecord(value: unknown): RecordV1 {
  const r = object(value);
  if (r.version !== 3 || !Number.isSafeInteger(r.cents) || (r.cents as number) < 0 || (r.cents as number) > MAX_PESOS * 100) throw invalid();
  const qrs: SavedQR[] = list(r.qrs).map((value) => {
    const q = object(value);
    const payload = text(q.payload, 4096);
    const validation = validateQR(payload);
    // A fixed mask checks capacity without spending time optimizing a display we do not render here.
    QR.create(payload, { errorCorrectionLevel: "M", maskPattern: 0 });
    return { id: text(q.id, 160), date: date(q.date), label: label(q.label), payload, validation };
  });
  const numbers: SavedNumber[] = list(r.numbers).map((value) => {
    const n = object(value);
    const number = text(n.number, 11);
    if (!/^09\d{9}$/.test(number) || (n.source !== "manual" && n.source !== "scanned")) throw invalid();
    return { number, source: n.source, date: date(n.date), label: label(n.label) };
  });
  const apps: SavedApp[] = list(r.apps).map((value) => {
    const a = object(value);
    const link = text(a.link, 2048);
    if (!validateLink(link)) throw invalid();
    const id = readPackageTarget(link)?.packageName ?? link;
    if (a.id !== id) throw invalid();
    return { id, link, date: date(a.date) };
  });
  unique(qrs.map((q) => q.id)); unique(qrs.map((q) => q.payload));
  unique(numbers.map((n) => n.number)); unique(apps.map((a) => a.id));
  const activeQR = r.activeQR ?? null, activeApp = r.activeApp ?? null;
  if ((activeQR !== null && (typeof activeQR !== "string" || !qrs.some((q) => q.id === activeQR))) ||
      (activeApp !== null && (typeof activeApp !== "string" || !apps.some((a) => a.id === activeApp)))) throw invalid();
  return { version: 3, qrs, numbers, apps, activeQR, activeApp,
    recipient: qrs.find((q) => q.id === activeQR) ?? null,
    link: apps.find((a) => a.id === activeApp)?.link ?? "", cents: r.cents as number };
}

export function backupDocument(record: RecordV1): string {
  const r = validateBackupRecord(migrate(record));
  return JSON.stringify({ format: "payqr-history", version: 1, createdAt: new Date().toISOString(), record: {
    version: 3, cents: r.cents, activeQR: r.activeQR, activeApp: r.activeApp,
    qrs: r.qrs!.map(({ id, date, label, payload }) => ({ id, date, label, payload })),
    numbers: r.numbers, apps: r.apps,
  } });
}

export function parseBackupDocument(raw: string): RecordV1 {
  const doc = object(JSON.parse(raw, (key, value) => {
    if (["__proto__", "prototype", "constructor"].includes(key)) throw invalid();
    return value;
  }));
  if (doc.format !== "payqr-history" || doc.version !== 1) throw invalid();
  date(doc.createdAt);
  return validateBackupRecord(doc.record);
}

/** Preserve current entries and selections. Imported links are never activated or opened. */
export function mergeBackup(current: RecordV1, incoming: RecordV1): RecordV1 {
  const r = migrate(current), backup = validateBackupRecord(incoming);
  const qrs = [...(r.qrs ?? [])], numbers = [...(r.numbers ?? [])], apps = [...(r.apps ?? [])];
  const payloads = new Set(qrs.map((q) => q.payload)), ids = new Set(qrs.map((q) => q.id));
  const phones = new Set(numbers.map((n) => n.number)), appIds = new Set(apps.map((a) => a.id));
  let serial = 0;
  for (const q of backup.qrs ?? []) {
    if (payloads.has(q.payload)) continue;
    let id = q.id;
    while (ids.has(id)) id = `imported-${++serial}`;
    qrs.push({ ...q, id }); ids.add(id); payloads.add(q.payload);
  }
  for (const n of backup.numbers ?? []) if (!phones.has(n.number)) { numbers.push(n); phones.add(n.number); }
  for (const a of backup.apps ?? []) if (!appIds.has(a.id)) { apps.push(a); appIds.add(a.id); }
  if ([qrs, numbers, apps].some((items) => items.length > MAX_ENTRIES))
    throw new Error("This merge would exceed 1,000 entries per category. Remove unused entries first.");
  return { ...r, qrs, numbers, apps };
}
