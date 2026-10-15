import { validateLink, validateQR, MAX_PESOS, QRValidation } from "./core";
export type Recipient = {
  image: string;
  payload: string;
  validation: QRValidation;
};
export type RecordV1 = {
  version: 1;
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
    const value = JSON.stringify(record);
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
    r.version !== 1 ||
    !Number.isSafeInteger(r.cents) ||
    r.cents < 0 ||
    r.cents > MAX_PESOS * 100 ||
    r.cents % 100 ||
    typeof r.link !== "string" ||
    (r.link && !validateLink(r.link))
  )
    throw new Error("Saved data is corrupt");
  if (r.recipient !== null) {
    if (
      !r.recipient ||
      typeof r.recipient.image !== "string" ||
      !r.recipient.image.startsWith("file:") ||
      typeof r.recipient.payload !== "string"
    )
      throw new Error("Saved recipient is corrupt");
    r.recipient.validation = validateQR(r.recipient.payload);
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
    throw new Error("Could not open link. The number remains copied.");
  }
}
