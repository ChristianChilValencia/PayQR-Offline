import { rewriteAmount, validateQR } from "./core";
import { Recipient } from "./state";

export type PaymentSnapshot = {
  label?: string;
  payload: string;
  cents: number;
  recipient: string;
  status: string;
};
export function paymentSnapshot(
  recipient: Recipient,
  cents: number,
): PaymentSnapshot {
  const v = validateQR(recipient.payload),
    payload = cents === 0 ? recipient.payload : rewriteAmount(recipient.payload, cents);
  return {
    payload,
    label: recipient.label,
    cents,
    recipient: v.recipient,
    status:
      payload !== recipient.payload
        ? "Amount-prefilled · unverified"
        : cents === 0
          ? "Original QR"
          : v.status,
  };
}

export type PaymentCardSize = { width: number; height: number };
/** Shared coordinates for the on-screen card and its PNG (buttons are outside the card). */
export function paymentCardFrame({ width, height }: PaymentCardSize, label: string | boolean, showAmount = true) {
  const hasLabel = !!label;
  const rows = typeof label === "string" && label.length <= Math.floor(width / 9) && !label.includes("\n") ? 1 : 2;
  const gap = 16, titleHeight = 30, amountHeight = showAmount ? 32 : 0, labelHeight = hasLabel ? rows * 24 : 0;
  const reserved = titleHeight + amountHeight + labelHeight + gap * ((hasLabel ? 2 : 1) + (showAmount ? 1 : 0)) + 16;
  const qrSize = Math.max(1, Math.floor(Math.min(width, 350, height - reserved)));
  const contentHeight = reserved - 16 + qrSize;
  const titleTop = Math.max(8, (height - contentHeight) / 2);
  const amountTop = titleTop + titleHeight + gap;
  const qrTop = showAmount ? amountTop + amountHeight + gap : amountTop;
  return { qrSize, titleTop, amountTop, qrTop, labelTop: qrTop + qrSize + gap, labelHeight };
}
