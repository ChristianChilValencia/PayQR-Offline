import QR from "qrcode";
import { exportPaymentCard } from "../src/services/payment-export.web";
import { paymentCardFrame, paymentSnapshot } from "../src/domain/payment-card";
import { money, validateQR } from "../src/domain/core";
import { fixture } from "./fixture";
jest.mock("qrcode", () => ({ __esModule: true, default: { create: jest.fn(() => ({ modules: { size: 49 } })), toCanvas: jest.fn(async canvas => { canvas.width = 855; canvas.height = 855; }) } }));
const ctx = { font: "", fillStyle: "", textAlign: "", imageSmoothingEnabled: true, fillRect: jest.fn(), fillText: jest.fn(), drawImage: jest.fn(), measureText: (value: string) => ({ width: value.length * 16 }) };
const click = jest.fn(), remove = jest.fn(), revoke = jest.fn();
const saved = new Map<string, PropertyDescriptor | undefined>();
function replace(name: string, value: unknown) { saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name)); Object.defineProperty(globalThis, name, { value, configurable: true }); }
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks();
  replace("document", { createElement: (tag: string) => tag === "a" ? { click, remove } : { width: 0, height: 0, getContext: () => ctx, toBlob: (done: (blob: Blob) => void) => done(new Blob(["png"], { type: "image/png" })) }, body: { appendChild: jest.fn() } });
  replace("navigator", {});
  replace("URL", { createObjectURL: jest.fn(() => "blob:png"), revokeObjectURL: revoke });
  replace("File", class { type = "image/png"; constructor(public parts: unknown[], public name: string) {} });
});
afterEach(() => { for (const [name, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name); } saved.clear(); jest.useRealTimers(); });
const snapshot = () => { const payload = fixture(); return paymentSnapshot({ payload, validation: validateQR(payload), label: "Shop" }, 0); };

test("direct download renders original payload and label, then cleans up the URL", async () => {
  await exportPaymentCard(snapshot(), "save");
  expect(QR.toCanvas).toHaveBeenCalledWith(expect.anything(), fixture(), expect.objectContaining({ margin: 4, errorCorrectionLevel: "M" }));
  expect(ctx.fillText).toHaveBeenCalledWith("Shop", 512, expect.any(Number), 1024);
  expect(ctx.fillText.mock.calls.some(call => call[0] === money(0))).toBe(false);
  expect(click).toHaveBeenCalledTimes(1);
  expect(remove).toHaveBeenCalledTimes(1);
  expect(revoke).not.toHaveBeenCalled();
  jest.advanceTimersByTime(60_000);
  expect(revoke).toHaveBeenCalledWith("blob:png");
});
test("supported file sharing uses the system share sheet without downloading", async () => {
  const share = jest.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { share, canShare: () => true });
  await exportPaymentCard(snapshot(), "share");
  expect(ctx.fillText.mock.calls.some(call => call[0] === money(0))).toBe(false);
  expect(share).toHaveBeenCalledWith({ files: [expect.objectContaining({ name: "payqr.png", type: "image/png" })], title: "PayQR" });
  expect(click).not.toHaveBeenCalled();
});
test("unsupported sharing downloads automatically; cancellation does not download", async () => {
  await exportPaymentCard(snapshot(), "share");
  expect(click).toHaveBeenCalledTimes(1);
  click.mockClear();
  Object.assign(navigator, { canShare: () => true, share: jest.fn().mockRejectedValue(Object.assign(new Error("cancel"), { name: "AbortError" })) });
  await expect(exportPaymentCard(snapshot(), "share")).resolves.toBeUndefined();
  expect(click).not.toHaveBeenCalled();
});
test("positive amount exports the rewritten payload without changing the saved snapshot", async () => {
  const original = snapshot();
  const payload = fixture();
  const amount = paymentSnapshot({ payload, validation: validateQR(payload), label: "Shop" }, 12300);
  await exportPaymentCard(amount, "save");
  expect(ctx.fillText).toHaveBeenCalledWith(money(12300), 512, expect.any(Number), 1024);
  expect(QR.toCanvas).toHaveBeenCalledWith(expect.anything(), amount.payload, expect.anything());
  expect(amount.payload).not.toBe(original.payload);
  expect(original.payload).toBe(payload);
});


test("downloaded card uses the same QR and label positions as the Receive layout", async () => {
  const size = { width: 320, height: 480 };
  const card = snapshot();
  const frame = paymentCardFrame(size, card.label!, false);
  const scale = 1024 / size.width;
  await exportPaymentCard(card, "save", size);
  expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), (size.width - frame.qrSize) / 2 * scale, frame.qrTop * scale, frame.qrSize * scale, frame.qrSize * scale);
  expect(ctx.fillText).toHaveBeenCalledWith("Shop", 512, (frame.labelTop + frame.labelHeight / 2) * scale, 1024);
  expect(frame.labelTop - (frame.qrTop + frame.qrSize)).toBe(16);
  expect(frame.qrTop - (frame.titleTop + 30)).toBe(16);
  expect(frame.titleTop).toBeCloseTo(size.height - (frame.labelTop + frame.labelHeight));
});
