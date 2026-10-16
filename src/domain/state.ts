import { readPackageTarget } from "./launcher";
import { validateLink, validateQR, MAX_PESOS, QRValidation } from "./core";
export type SavedQR = Recipient & { id: string; date: string };
export type SavedNumber = {
  label?: string;
  number: string;
  source: "scanned" | "manual";
  date: string;
};
export type SavedApp = { id: string; link: string; date: string };
export type Recipient = {
  label?: string;
  /** Legacy image reference, removed by migration and never written in v3. */
  image?: string;
  payload: string;
  validation: QRValidation;
};
export type RecordV1 = {
  version: 1 | 2 | 3;
  qrs?: SavedQR[];
  numbers?: SavedNumber[];
  apps?: SavedApp[];
  activeQR?: string | null;
  activeApp?: string | null;
  recipient: Recipient | null;
  cents: number;
  link: string;
};
export const initial: RecordV1 = {
  version: 1,
  recipient: null,
  cents: 0,
  link: "",
};
export class SerialStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private write: (value: string) => Promise<void>) {}
  save(record: RecordV1): Promise<void> {
    const value = JSON.stringify(migrate(record));
    const next = this.queue.catch(() => {}).then(() => this.write(value));
    this.queue = next;
    return next;
  }
}
export class Operations {
  private id = 0;
  begin() {
    return ++this.id;
  }
  current(id: number) {
    return id === this.id;
  }
  cancel() {
    ++this.id;
  }
}
export function hydrate(raw: string | null): RecordV1 {
  if (raw === null) return initial;
  const r = JSON.parse(raw);
  if (!r || typeof r !== "object" || Array.isArray(r))
    throw new Error("Saved data is corrupt");
  if (
    ![1, 2, 3].includes(r.version) ||
    !Number.isSafeInteger(r.cents) ||
    r.cents < 0 ||
    r.cents > MAX_PESOS * 100 ||
    typeof r.link !== "string" ||
    (r.link && !validateLink(r.link))
  )
    throw new Error("Saved data is corrupt");
  if (r.recipient !== null) {
    if (
      !r.recipient ||
      (r.version !== 3 &&
        (typeof r.recipient.image !== "string" ||
          !(
            r.recipient.image.startsWith("file:") ||
            /^data:image\/[a-z0-9.+-]+;base64,/i.test(r.recipient.image)
          ))) ||
      typeof r.recipient.payload !== "string"
    )
      throw new Error("Saved recipient is corrupt");
    r.recipient.validation = validateQR(r.recipient.payload);
  }
  if (r.version >= 2) {
    if (
      !Array.isArray(r.qrs) ||
      !Array.isArray(r.numbers) ||
      !Array.isArray(r.apps)
    )
      throw new Error("Saved history is corrupt");
    for (const q of r.qrs) {
      if (typeof q.id !== "string" || typeof q.date !== "string")
        throw new Error("Saved QR is corrupt");
      if (typeof q.payload !== "string") throw new Error("Saved QR is corrupt");
      q.label = cleanLabel(q.label);
      q.validation = validateQR(q.payload);
    }
    for (const n of r.numbers) {
      n.label = cleanLabel(n.label);
      if (
        !/^09\d{9}$/.test(n.number) ||
        !["scanned", "manual"].includes(n.source) ||
        typeof n.date !== "string"
      )
        throw new Error("Saved number is corrupt");
    }
    for (const a of r.apps)
      if (
        typeof a.id !== "string" ||
        !validateLink(a.link) ||
        typeof a.date !== "string"
      )
        throw new Error("Saved app is corrupt");
    r.recipient = r.qrs.find((q: SavedQR) => q.id === r.activeQR) ?? null;
    r.link = r.apps.find((a: SavedApp) => a.id === r.activeApp)?.link ?? "";
  }
  return r;
}
export async function copyThenOpen(
  number: string,
  link: string,
  copy: (n: string) => Promise<void>,
  open: (l: string) => Promise<unknown>,
) {
  await copy(number);
  try {
    await open(link);
  } catch {
    throw new Error(
      "Could not open app. The number remains copied. Choose another installed app in Settings.",
    );
  }
}

export function legacyImages(r: RecordV1): string[] {
  return [
    ...new Set(
      [r.recipient?.image, ...(r.qrs ?? []).map((q) => q.image)].filter(
        (uri): uri is string => !!uri && uri.startsWith("file:"),
      ),
    ),
  ];
}
export function migrate(r: RecordV1): RecordV1 {
  const date = new Date().toISOString();
  const appId = readPackageTarget(r.link)?.packageName ?? r.link;
  const source =
    r.version === 1
      ? {
          ...r,
          qrs: r.recipient ? [{ ...r.recipient, id: "legacy-qr", date }] : [],
          numbers: [],
          apps: r.link ? [{ id: appId, link: r.link, date }] : [],
          activeQR: r.recipient ? "legacy-qr" : null,
          activeApp: appId || null,
        }
      : r;
  const qrs = (source.qrs ?? []).map((q) => ({
    id: q.id,
    date: q.date,
    label: cleanLabel(q.label),
    payload: q.payload,
    validation: validateQR(q.payload),
  }));
  return {
    ...source,
    version: 3,
    qrs,
    recipient: qrs.find((q) => q.id === source.activeQR) ?? null,
  };
}
export function saveNumber(
  r: RecordV1,
  number: string,
  source: SavedNumber["source"],
  label?: string,
): RecordV1 {
  if (!/^09\d{9}$/.test(number)) throw new Error("Invalid mobile number");
  return {
    ...r,
    numbers: [
      { number, source, date: new Date().toISOString(), label: label === undefined ? r.numbers?.find((n) => n.number === number)?.label : cleanLabel(label) },
      ...(r.numbers ?? []).filter((n) => n.number !== number),
    ],
  };
}

export function cleanLabel(label: unknown): string | undefined {
  return typeof label === "string" ? label.trim() || undefined : undefined;
}

export function saveApp(r: RecordV1, link: string): RecordV1 {
  const id = readPackageTarget(link)?.packageName ?? link;
  return { ...r, link, activeApp: link ? id : null, apps: link ? [{ id, link, date: new Date().toISOString() }, ...(r.apps ?? []).filter(a => a.id !== id)] : r.apps };
}
