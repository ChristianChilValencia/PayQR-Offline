import { saveRecipient, deleteRecipient } from "../src/domain/import";
import { initial } from "../src/domain/state";
import { validateQR } from "../src/domain/core";
const qr = (image: string, payload: string) => ({
  image,
  payload,
  validation: validateQR(payload),
});
test("new imports retain payload history, amount and app without images", () => {
  const old = qr("file:///old", "old payload");
  const r = saveRecipient(
    { ...initial, recipient: old, cents: 200, link: "my:link" },
    qr("file:///new", "new payload"),
  );
  expect(r.record.qrs).toHaveLength(2);
  expect(r.record.qrs?.every((q) => q.image === undefined)).toBe(true);
  expect(r.record.cents).toBe(200);
  expect(r.record.link).toBe("my:link");
  expect(r.record.recipient?.payload).toBe("new payload");
});
test("payload deduplication keeps the identifier and stores no image", () => {
  const first = saveRecipient(
    initial,
    qr("file:///old", "same payload"),
  ).record;
  const r = saveRecipient(first, qr("file:///new", "same payload"));
  expect(r.record.qrs).toHaveLength(1);
  expect(r.record.activeQR).toBe(first.activeQR);
  expect(r.record.recipient?.image).toBeUndefined();
});
test("deleting active entry clears selection and preserves other history", () => {
  const first = saveRecipient(initial, qr("file:///old", "old payload")).record;
  const next = saveRecipient(first, qr("file:///new", "new payload")).record;
  const r = deleteRecipient(next, next.activeQR!);
  expect(r.record.recipient).toBeNull();
  expect(r.record.activeQR).toBeNull();
  expect(r.record.qrs).toEqual(first.qrs);
});
test("legacy image fields cannot enter a newly saved QR record", () => {
  const result = saveRecipient(
    initial,
    qr("data:image/png;base64,PRIVATE_IMAGE", "payload"),
  );
  expect(JSON.stringify(result.record)).not.toContain("PRIVATE_IMAGE");
  expect(result.record.version).toBe(3);
});
