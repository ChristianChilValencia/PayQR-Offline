import { backupDocument, mergeBackup, parseBackupDocument, validateBackupRecord } from "../src/domain/backup";
import { initial, migrate, saveApp, saveNumber } from "../src/domain/state";
import { validateQR } from "../src/domain/core";
import { fixture, fields } from "./fixture";

const record = () => saveNumber(saveApp(migrate({ ...initial, cents: 12345, recipient: {
  payload: fixture(), validation: validateQR(fixture()), label: "Café 🧾",
} }), "https://example.com/pay"), "09171234567", "manual", "Shop");

test("backup round-trips histories and selections without images or approval flags", () => {
  const r = record();
  const raw = backupDocument(r);
  expect(raw).not.toContain('"validation"');
  expect(raw).not.toContain('"image"');
  expect(parseBackupDocument(raw)).toEqual(r);
});

test("merge deduplicates and preserves current labels, selections, and amount", () => {
  const current = record();
  const incoming = saveNumber({ ...record(), cents: 999 }, "09181234567", "scanned", "New shop");
  incoming.qrs![0].label = "Changed";
  const result = mergeBackup(current, incoming);
  expect(result.qrs).toHaveLength(1);
  expect(result.qrs![0].label).toBe("Café 🧾");
  expect(result.numbers).toHaveLength(2);
  expect(result.cents).toBe(current.cents);
  expect(result.activeQR).toBe(current.activeQR);
  expect(result.activeApp).toBe(current.activeApp);
  expect(current.numbers).toHaveLength(1);
});

test("conflicting QR IDs get fresh IDs without altering recipient routing", () => {
  const current = record();
  const payload = fixture(fields.map((f) => f.id === "59" ? { ...f, value: "OTHER SHOP" } : f));
  const incoming = record();
  incoming.qrs![0] = { ...incoming.qrs![0], payload, validation: validateQR(payload) };
  const result = mergeBackup(current, incoming);
  expect(result.qrs).toHaveLength(2);
  expect(result.qrs![1].id).not.toBe(result.qrs![0].id);
  expect(result.qrs![1].payload).toBe(payload);
  expect(result.recipient?.payload).toBe(current.recipient?.payload);
});

test("imported apps and QRs are not activated on an empty device", () => {
  const result = mergeBackup(migrate(initial), record());
  expect(result.apps).toHaveLength(1);
  expect(result.qrs).toHaveLength(1);
  expect(result.link).toBe("");
  expect(result.recipient).toBeNull();
});

test.each([
  (r: ReturnType<typeof record>) => { r.qrs![0].payload = "000301"; },
  (r: ReturnType<typeof record>) => { r.qrs![0].label = "x".repeat(161); },
  (r: ReturnType<typeof record>) => { r.numbers![0].number = "not a phone"; },
  (r: ReturnType<typeof record>) => { r.apps![0].link = "javascript:alert(1)"; },
  (r: ReturnType<typeof record>) => { r.activeQR = "missing"; },
  (r: ReturnType<typeof record>) => { r.numbers = Array(1001).fill(r.numbers![0]); },
  (r: ReturnType<typeof record>) => { r.qrs!.push(r.qrs![0]); },
])("malformed imported history is rejected", (mutate) => {
  const r = record(); mutate(r);
  expect(() => validateBackupRecord(r)).toThrow();
});

test("prototype pollution keys are rejected", () => {
  expect(() => parseBackupDocument('{"__proto__":{"polluted":true}}')).toThrow();
  expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
});
