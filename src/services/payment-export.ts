import { PaymentCardSize, PaymentSnapshot } from "../domain/payment-card";
/** Browser implementation is selected by Metro; native exports use the captured card. */
export async function exportPaymentCard(_snapshot: PaymentSnapshot, _mode: "save" | "share", _size?: PaymentCardSize): Promise<void> {
  throw new Error("Direct browser export is unavailable on this platform.");
}
