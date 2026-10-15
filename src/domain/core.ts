export const MAX_PESOS = 999999999;
export function pesosToCentavos(text: string): number | null {
  return /^(0|[1-9]\d{0,8})$/.test(text) ? Number(text) * 100 : null;
}
export function wireAmount(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > MAX_PESOS * 100)
    throw new Error("Invalid amount");
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}
export function money(cents: number): string {
  return `₱${wireAmount(cents)}`;
}
export function normalizePhone(value: string): string | null {
  if (!/^[+\d -]+$/.test(value)) return null;
  const clean = value.replace(/[ -]/g, "");
  return /^09\d{9}$/.test(clean)
    ? clean
    : /^\+639\d{9}$/.test(clean)
      ? "0" + clean.slice(3)
      : null;
}
export function findPhones(text: string): string[] {
  return [
    ...new Set(
      Array.from(
        text.matchAll(/(?<![\d+])(?:09|\+639)(?:[ -]*\d){9}(?![ -]*\d)/g),
        (m) => normalizePhone(m[0]),
      ).filter((x): x is string => x !== null),
    ),
  ];
}
export function maskRecipient(value: string): string {
  return value.replace(
    /(?:\+63|0)9\d{9}/g,
    (n) => `${n.slice(0, 3)}••••${n.slice(-4)}`,
  );
}
export type Field = { id: string; value: string };
export function parseTLV(payload: string): Field[] {
  if (!/^[\x20-\x7e]+$/.test(payload)) throw new Error("Unsupported encoding");
  const fields: Field[] = [];
  for (let pos = 0; pos < payload.length; ) {
    const head = payload.slice(pos, pos + 4);
    if (!/^\d{4}$/.test(head)) throw new Error("Malformed QR fields");
    const length = Number(head.slice(2)),
      id = head.slice(0, 2);
    if (!length || pos + 4 + length > payload.length)
      throw new Error("Malformed QR length");
    if (fields.some((f) => f.id === id)) throw new Error("Duplicate QR field");
    fields.push({ id, value: payload.slice(pos + 4, pos + 4 + length) });
    pos += 4 + length;
  }
  return fields;
}
export function serialize(fields: Field[]): string {
  if (new Set(fields.map((f) => f.id)).size !== fields.length)
    throw new Error("Duplicate QR field");
  return fields
    .map((f) => {
      if (!/^\d{2}$/.test(f.id) || !/^[\x20-\x7e]{1,99}$/.test(f.value))
        throw new Error("Invalid field");
      return f.id + String(f.value.length).padStart(2, "0") + f.value;
    })
    .join("");
}
export function crc16(text: string): string {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++)
      crc = ((crc << 1) ^ (crc & 0x8000 ? 0x1021 : 0)) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
export type QRValidation = {
  status: "Original QR" | "Unsupported format";
  recipient: string;
  detail: string;
  eligible: boolean;
  structure?: boolean;
  existingAmount?: string;
};
// Intentionally empty. Only evidence from a legitimate recipient may add a profile.
const APPROVED_ROUTING: readonly string[] = [];
export function validateQR(payload: string): QRValidation {
  if (!payload || payload.length > 4096 || /[\x00-\x1f]/.test(payload))
    throw new Error("Invalid QR");
  const fallback: QRValidation = {
    status: "Unsupported format",
    recipient: "Recipient not identified",
    detail: "Enter this amount in GCash.",
    eligible: false,
  };
  if (!payload.startsWith("00")) return fallback;
  const fields = parseTLV(payload),
    get = (id: string) => fields.find((f) => f.id === id)?.value;
  if (
    fields.at(-1)?.id !== "63" ||
    !/^[A-Fa-f0-9]{4}$/.test(get("63") ?? "") ||
    crc16(payload.slice(0, -4)) !== get("63")?.toUpperCase()
  )
    throw new Error("Invalid QR: checksum or misplaced CRC");
  for (const f of fields)
    if (
      (+f.id >= 26 && +f.id <= 51) ||
      ["62", "64"].includes(f.id) ||
      +f.id >= 80
    ) {
      const nested = parseTLV(f.value);
      if (f.id !== "62" && !nested.some((n) => n.id === "00"))
        throw new Error("Invalid nested template identifier");
      if (
        f.id === "64" &&
        !/^[a-zA-Z]{2}$/.test(nested.find((n) => n.id === "00")!.value)
      )
        throw new Error("Invalid language template");
      if (f.id === "62")
        for (const sub of nested) if (+sub.id >= 50) parseTLV(sub.value);
    }
  const routing = fields.filter((f) => +f.id >= 26 && +f.id <= 51);
  const structure =
    get("00") === "01" &&
    ["11", "12"].includes(get("01") ?? "") &&
    get("53") === "608" &&
    get("58") === "PH" &&
    /^\d{4}$/.test(get("52") ?? "") &&
    !!get("59")?.trim() &&
    (get("59")?.length ?? 0) <= 25 &&
    !!get("60")?.trim() &&
    (get("60")?.length ?? 0) <= 15 &&
    routing.length > 0;
  const eligible = structure && APPROVED_ROUTING.includes(serialize(routing));
  return {
    ...fallback,
    status: eligible ? "Original QR" : fallback.status,
    recipient: maskRecipient(get("59") || fallback.recipient),
    existingAmount: get("54"),
    structure,
    eligible,
  };
}
/** Engine takes an explicit evidence predicate; production uses validateQR's empty allowlist. */
export function rewriteAmount(
  payload: string,
  cents: number,
  approved: (payload: string) => boolean = (p) => validateQR(p).eligible,
): string {
  const validation = validateQR(payload);
  wireAmount(cents);
  if (cents === 0 || !approved(payload)) return payload;
  if (!validation.structure) throw new Error("Unsupported rewrite");
  const fields = parseTLV(payload);
  const get = (id: string) => fields.find((f) => f.id === id)?.value;
  if (
    get("00") !== "01" ||
    !["11", "12"].includes(get("01") ?? "") ||
    get("53") !== "608" ||
    get("58") !== "PH" ||
    !get("59") ||
    !get("60") ||
    !get("52") ||
    validation.recipient === "Recipient not identified"
  )
    throw new Error("Unsupported rewrite");
  const output: Field[] = [];
  for (const f of fields) {
    if (["54", "63"].includes(f.id)) continue;
    output.push(f.id === "01" ? { ...f, value: "12" } : f);
    if (f.id === "53") output.push({ id: "54", value: wireAmount(cents) });
  }
  const body = serialize(output) + "6304";
  return body + crc16(body);
}
export function validateLink(value: string): string | null {
  if (!value || /[\s\x00-\x1f\x7f]/.test(value)) return null;
  try {
    const u = new URL(value);
    if (
      !/^[a-z][a-z0-9+.-]*:$/i.test(u.protocol) ||
      [
        "http:",
        "file:",
        "javascript:",
        "data:",
        "content:",
        "intent:",
        "vbscript:",
        "about:",
        "blob:",
        "shell:",
        "powershell:",
        "cmd:",
        "wscript:",
        "cscript:",
        "ms-msdt:",
        "ms-appx:",
        "ms-appdata:",
        "filesystem:",
      ].includes(u.protocol.toLowerCase()) ||
      u.username ||
      u.password ||
      !value.slice(u.protocol.length) ||
      (u.protocol === "https:" && !u.hostname)
    )
      return null;
    return value;
  } catch {
    return null;
  }
}
