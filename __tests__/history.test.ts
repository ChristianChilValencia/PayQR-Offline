import {
  hydrate,
  initial,
  migrate,
  saveNumber,
  SerialStore,
} from "../src/domain/state";
import { normalizePhone, validateQR } from "../src/domain/core";
import { packageTarget } from "../src/domain/launcher";
import { fixture } from "./fixture";

test("migration preserves recipient, amount and app and survives restart", () => {
  const recipient = {
    image: "file:///old",
    payload: fixture(),
    validation: validateQR(fixture()),
  };
  const link = packageTarget("com.globe.gcash.android", "GCash");
  const r = migrate({ ...initial, recipient, cents: 12345, link });
  expect(r.version).toBe(3);
  expect(r.qrs).toHaveLength(1);
  expect(r.activeApp).toBe("com.globe.gcash.android");
  expect(hydrate(JSON.stringify(r))).toMatchObject(r);
  expect(r.recipient?.payload).toBe(recipient.payload);
  expect(r.recipient?.image).toBeUndefined();
  expect(r.cents).toBe(12345);
  expect(r.link).toBe(link);
});
test("numbers deduplicate, reorder newest first and retain source across restart", () => {
  let r = migrate(initial);
  r = saveNumber(r, "09171234567", "scanned");
  r = saveNumber(r, "09181234567", "manual");
  r = saveNumber(r, "09171234567", "manual");
  expect(r.numbers?.map((n) => n.number)).toEqual([
    "09171234567",
    "09181234567",
  ]);
  expect(hydrate(JSON.stringify(r)).numbers).toEqual(r.numbers);
  expect(r.numbers?.[0].source).toBe("manual");
  expect(() => saveNumber(r, "0917", "manual")).toThrow();
});
test.each(["09171234567", "639171234567", "+639171234567", "09 17-123-4567"])(
  "normalizes complete paste %s",
  (value) => expect(normalizePhone(value)).toBe("09171234567"),
);
test.each([
  "-09171234567",
  "09171234567-",
  "09abc123456",
  "09171234567.0",
  "091712345678",
  "+6391712345678",
  "0917123456",
])("rejects malformed paste %s", (value) =>
  expect(normalizePhone(value)).toBeNull(),
);
test("history writes remain serialized after failure", async () => {
  const writes: string[] = [];
  const store = new SerialStore(async (s) => {
    writes.push(s);
    if (writes.length === 1) throw Error("disk");
  });
  const r = saveNumber(migrate(initial), "09171234567", "scanned");
  const failed = store.save(r);
  const success = store.save(saveNumber(r, "09181234567", "manual"));
  await expect(failed).rejects.toThrow("disk");
  await success;
  expect(hydrate(writes[1]).numbers).toHaveLength(2);
});

test("v2 history migration strips all images while preserving selections and payloads", () => {
  const payload = fixture();
  const legacy = {
    ...initial,
    version: 2 as const,
    cents: 1234,
    recipient: {
      image: "file:///private/payqr-old.img",
      payload,
      validation: validateQR(payload),
    },
    qrs: [
      {
        id: "saved",
        date: "2026-10-16",
        image: "file:///private/payqr-old.img",
        payload,
        validation: validateQR(payload),
      },
    ],
    numbers: [],
    apps: [{ id: "gcash://", link: "gcash://", date: "2026-10-16" }],
    activeQR: "saved",
    activeApp: "gcash://",
    link: "gcash://",
  };
  const migrated = migrate(hydrate(JSON.stringify(legacy)));
  expect(migrated.version).toBe(3);
  expect(migrated.activeQR).toBe("saved");
  expect(migrated.link).toBe("gcash://");
  expect(migrated.recipient?.payload).toBe(payload);
  expect(migrated.cents).toBe(1234);
  expect(JSON.stringify(migrated)).not.toContain("image");
  expect(hydrate(JSON.stringify(migrated))).toEqual(migrated);
});
test("the serialized store never persists a QR image or base64 image data", async () => {
  const write = jest.fn().mockResolvedValue(undefined);
  const store = new SerialStore(write);
  const payload = fixture();
  await store.save({
    ...initial,
    recipient: {
      image: "data:image/png;base64,PRIVATE_IMAGE",
      payload,
      validation: validateQR(payload),
    },
  });
  const raw = write.mock.calls[0][0];
  expect(raw).not.toContain("image");
  expect(raw).not.toContain("PRIVATE_IMAGE");
  expect(hydrate(raw).recipient?.payload).toBe(payload);
});
