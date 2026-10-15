export const MAX_PESOS = 999999999;
export function pesosToCentavos(text: string): number | null {
  if (!/^(0|[1-9]\d{0,8})$/.test(text)) return null;
  return Number(text) * 100;
}
export function money(cents: number): string {
  return `₱${(cents / 100).toFixed(2)}`;
}
export function normalizePhone(value: string): string | null {
  if (!/^[+\d -]+$/.test(value)) return null;
  const clean = value.replace(/[ -]/g, '');
  if (/^09\d{9}$/.test(clean)) return clean;
  return /^\+639\d{9}$/.test(clean) ? '0' + clean.slice(3) : null;
}
export function findPhones(text: string): string[] {
  const matches = Array.from(
    text.matchAll(/(?:^|[^\d+])((?:09|\+639)(?:[ -]*\d){9})(?![ -]*\d)/g),
    match => match[1],
  );
  return [
    ...new Set(
      matches.map(normalizePhone).filter((n): n is string => n !== null),
    ),
  ];
}
export type Field = { id: string; value: string };
export function parseTLV(payload: string): Field[] {
  // Conservatively accept ASCII only: JS character lengths then equal wire bytes.
  if (!/^[\x20-\x7e]+$/.test(payload)) throw new Error('Unsupported encoding');
  const fields: Field[] = [];
  let pos = 0;
  while (pos < payload.length) {
    const head = payload.slice(pos, pos + 4);
    if (!/^\d{4}$/.test(head)) throw new Error('Malformed QR fields');
    const length = Number(head.slice(2));
    if (!length || pos + 4 + length > payload.length)
      throw new Error('Malformed QR length');
    const id = head.slice(0, 2);
    if (fields.some(f => f.id === id)) throw new Error('Duplicate QR field');
    fields.push({ id, value: payload.slice(pos + 4, pos + 4 + length) });
    pos += 4 + length;
  }
  return fields;
}
// CRC-16 requires bit operations.
/* eslint-disable no-bitwise */
export function crc16(text: string): string {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++)
      crc = ((crc << 1) ^ (crc & 0x8000 ? 0x1021 : 0)) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
export type QRValidation = {
  status: 'Original QR' | 'Unsupported format';
  recipient: string;
  detail: string;
};
export function validateQR(payload: string): QRValidation {
  if (!payload || payload.length > 4096) throw new Error('Invalid QR');
  if (!payload.startsWith('0002'))
    return {
      status: 'Unsupported format',
      recipient: 'Recipient not identified',
      detail: 'Unrecognized payment format. Confirm the recipient in GCash.',
    };
  const fields = parseTLV(payload);
  const get = (id: string) => fields.find(f => f.id === id)?.value;
  if (
    get('00') !== '01' ||
    !/6304[0-9A-Fa-f]{4}$/.test(payload) ||
    fields.at(-1)?.id !== '63' ||
    crc16(payload.slice(0, -4)) !== get('63')?.toUpperCase()
  )
    throw new Error('Invalid QR: fields or checksum');
  for (const f of fields)
    if (
      (Number(f.id) >= 26 && Number(f.id) <= 51) ||
      f.id === '62' ||
      f.id === '64'
    )
      parseTLV(f.value);
  if (
    get('53') !== '608' ||
    get('58') !== 'PH' ||
    !get('59') ||
    !get('60') ||
    !get('52') ||
    !fields.some(f => Number(f.id) >= 26 && Number(f.id) <= 51)
  )
    return {
      status: 'Unsupported format',
      recipient: get('59') || 'Recipient not identified',
      detail: 'Format is not recognized as a Philippine peso merchant QR.',
    };
  return {
    status: 'Original QR',
    recipient: get('59')!,
    detail: 'Checksum and structure checked. Wallet acceptance is unverified.',
  };
}
