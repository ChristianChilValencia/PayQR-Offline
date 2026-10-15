import {
  crc16,
  parseTLV,
  pesosToCentavos,
  wireAmount,
  rewriteAmount,
  validateQR,
  serialize,
  normalizePhone,
  findPhones,
  maskRecipient,
  validateLink,
} from "../src/domain/core";
import {
  hydrate,
  initial,
  SerialStore,
  Operations,
  copyThenOpen,
} from "../src/domain/state";
import { fields, fixture } from "./fixture";
test.each([
  "",
  "00",
  "01",
  " 1",
  "1 ",
  "1.0",
  "-1",
  "+1",
  "1e3",
  "1,000",
  "1000000000",
  "\n1",
  "０",
])("reject amount %j", (v) => expect(pesosToCentavos(v)).toBeNull());
test("exact integer money and bounds", () => {
  expect(pesosToCentavos("999999999")).toBe(99999999900);
  expect(wireAmount(99999999900)).toBe("999999999.00");
  expect(wireAmount(1)).toBe("0.01");
  expect(pesosToCentavos("0")).toBe(0);
  expect(() => wireAmount(-1)).toThrow();
});
test("CRC known CCITT-FALSE vector", () =>
  expect(crc16("123456789")).toBe("29B1"));
test.each([
  "0000",
  "000301",
  "000201000201",
  "000201x",
  "0002010102116304FFFF000201",
])("reject malformed TLV %j", (s) => expect(() => validateQR(s)).toThrow());
test("parser rejects malformed field identifiers", () =>
  expect(() => parseTLV("xx0201")).toThrow());
test("nested duplicate and truncated scopes rejected", () => {
  for (const value of ["0001A0001B", "0012short"])
    expect(() =>
      validateQR(
        fixture(fields.map((f) => (f.id === "26" ? { ...f, value } : f))),
      ),
    ).toThrow();
  expect(() =>
    validateQR(
      fixture(
        fields.map((f) => (f.id === "26" ? { ...f, value: "0101X" } : f)),
      ),
    ),
  ).toThrow("identifier");
  expect(() =>
    validateQR(fixture([...fields, { id: "62", value: "5005xx01X" }])),
  ).toThrow();
  expect(() =>
    serialize([
      { id: "00", value: "01" },
      { id: "00", value: "02" },
    ]),
  ).toThrow("Duplicate");
});
test("explicit evidence cannot bypass rewrite structure restrictions", () => {
  for (const id of ["00", "01", "53", "58", "52", "59", "60"]) {
    const p = fixture(
      fields.map((f) =>
        f.id === id
          ? { ...f, value: ["59", "60"].includes(id) ? " " : "X" }
          : f,
      ),
    );
    expect(() => rewriteAmount(p, 100, () => true)).toThrow("Unsupported");
  }
});
test("misplaced or incorrect CRC rejected", () => {
  const p = fixture();
  expect(() => validateQR(p.slice(0, -4) + "0000")).toThrow();
  expect(() => validateQR(p + "7001X")).toThrow();
});
test("amount insertion, indicator, CRC and unknown routing preserved", () => {
  const p = fixture(),
    out = rewriteAmount(p, 12300, () => true),
    f = parseTLV(out);
  expect(f.find((x) => x.id === "54")?.value).toBe("123.00");
  expect(f.find((x) => x.id === "01")?.value).toBe("12");
  expect(f.findIndex((x) => x.id === "54")).toBe(
    f.findIndex((x) => x.id === "53") + 1,
  );
  expect(f.filter((x) => !["01", "54", "63"].includes(x.id))).toEqual(
    fields.filter((x) => x.id !== "01"),
  );
  expect(validateQR(out).recipient).toBe("TEST ONLY");
  expect(rewriteAmount(p, 0, () => true)).toBe(p);
  expect(rewriteAmount(p, 12300)).toBe(p);
});
test("replacement removes previous amount and keeps other order", () => {
  const p = fixture([
    ...fields.slice(0, 5),
    { id: "54", value: "4.00" },
    ...fields.slice(5),
  ]);
  expect(validateQR(p).existingAmount).toBe("4.00");
  expect(
    parseTLV(rewriteAmount(p, 200, () => true)).filter((f) => f.id === "54"),
  ).toEqual([{ id: "54", value: "2.00" }]);
});
test("unsupported fallback never becomes approved", () => {
  expect(validateQR("https://example.com").status).toBe("Unsupported format");
  expect(validateQR(fixture()).eligible).toBe(false);
  expect(rewriteAmount("https://example.com", 100)).toBe("https://example.com");
  expect(() => serialize([{ id: "01", value: "x".repeat(100) }])).toThrow();
});
test("recipient masking", () =>
  expect(maskRecipient("09123456789")).toBe("091••••6789"));
test.each(["09123456789", "09 123-456-789", "+63 912-345-6789"])(
  "normalize phone %s",
  (value) => expect(normalizePhone(value)).toBe("09123456789"),
);
test.each([
  "0912345678",
  "091234567890",
  "639123456789",
  "text",
  "+63912345678",
])("reject phone %s", (value) => expect(normalizePhone(value)).toBeNull());
test("phone text boundaries, duplicates, multiple and correction", () => {
  expect(findPhones("A 09123456789; +63 9123456789; 09987654321")).toEqual([
    "09123456789",
    "09987654321",
  ]);
  expect(findPhones("109123456789 091234567890")).toEqual([]);
  expect(findPhones("none")).toEqual([]);
  expect(normalizePhone("09987654321")).toBe("09987654321");
});
test.each([
  "javascript:alert(1)",
  "file:///a",
  "https://user:pass@example.com",
  "http://example.com",
  "data:text/html,a",
  "intent://a",
  "https://bad host",
  "https://example.com\n",
  "not a link",
])("reject launch %s", (s) => expect(validateLink(s)).toBeNull());
test.each(["https://example.com/path", "myapp://open", "myapp:open"])(
  "allow syntactic launch %s",
  (s) => expect(validateLink(s)).toBe(s),
);
test("hydration validates version, cents, payload and recalculates profile", () => {
  expect(hydrate(null)).toEqual(initial);
  const r = {
    ...initial,
    recipient: {
      image: "file:///private/a",
      payload: fixture(),
      validation: { eligible: true },
    },
  };
  expect(hydrate(JSON.stringify(r)).recipient?.validation.eligible).toBe(false);
  for (const bad of [
    { ...r, version: 2 },
    { ...r, cents: -1 },
    { ...r, cents: 1 },
    { ...r, link: "file:///a" },
    { ...r, recipient: { image: "http://a", payload: fixture() } },
  ])
    expect(() => hydrate(JSON.stringify(bad))).toThrow();
});
test("serialized writes recover after failure", async () => {
  const order: string[] = [];
  const write = jest.fn(async (v: string) => {
    order.push(v);
    if (order.length === 1) throw new Error("disk");
  });
  const s = new SerialStore(write);
  const first = s.save(initial),
    second = s.save({ ...initial, cents: 100 });
  await expect(first).rejects.toThrow("disk");
  await second;
  expect(order.map((v) => JSON.parse(v).cents)).toEqual([0, 100]);
});
test("cancelled and superseded operations become stale", () => {
  const o = new Operations();
  const a = o.begin();
  const b = o.begin();
  expect(o.current(a)).toBe(false);
  expect(o.current(b)).toBe(true);
  o.cancel();
  expect(o.current(b)).toBe(false);
});
test("clipboard failure prevents launch; launch failure preserves successful copy", async () => {
  const open = jest.fn().mockRejectedValue(new Error("handler"));
  const fail = jest.fn().mockRejectedValue(new Error("clipboard"));
  await expect(
    copyThenOpen("09123456789", "x:open", fail, open),
  ).rejects.toThrow("clipboard");
  expect(open).not.toHaveBeenCalled();
  const copy = jest.fn().mockResolvedValue(undefined);
  await expect(
    copyThenOpen("09123456789", "x:open", copy, open),
  ).rejects.toThrow("number remains copied");
  expect(copy.mock.invocationCallOrder[0]).toBeLessThan(
    open.mock.invocationCallOrder[0],
  );
});
