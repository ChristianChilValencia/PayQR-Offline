import { importRecipient } from "../src/domain/import";
import { Operations, RecordV1, Recipient, initial } from "../src/domain/state";
import { validateQR } from "../src/domain/core";
import { fixture } from "./fixture";
const qr = (name: string): Recipient => ({
  image: "file:///" + name,
  payload: fixture(),
  validation: validateQR(fixture()),
});
test("failed metadata write retains previous recipient and cleans staged file", async () => {
  const o = new Operations(),
    old = qr("old"),
    fresh = qr("fresh");
  const record = { ...initial, recipient: old };
  const remove = jest.fn().mockResolvedValue(undefined);
  await expect(
    importRecipient(
      o.begin(),
      o,
      async () => fresh,
      async (transform) => {
        transform(record);
        throw new Error("disk");
      },
      remove,
    ),
  ).rejects.toThrow("disk");
  expect(record.recipient).toEqual(old);
  expect(remove).toHaveBeenCalledWith(fresh.image);
  expect(remove).not.toHaveBeenCalledWith(old.image);
});
test.each(["cancel", "supersede"])(
  "%s during selection discards staging",
  async (mode) => {
    const o = new Operations(),
      id = o.begin(),
      remove = jest.fn().mockResolvedValue(undefined),
      patch = jest.fn();
    await importRecipient(
      id,
      o,
      async () => {
        if (mode === "cancel") o.cancel();
        else o.begin();
        return qr("new");
      },
      patch,
      remove,
    );
    expect(patch).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith("file:///new");
  },
);
test("superseded while waiting for metadata queue retains active record", async () => {
  const o = new Operations(),
    id = o.begin(),
    remove = jest.fn().mockResolvedValue(undefined);
  await expect(
    importRecipient(
      id,
      o,
      async () => qr("new"),
      async (transform) => {
        o.cancel();
        transform(initial);
      },
      remove,
    ),
  ).rejects.toThrow("cancelled");
  expect(remove).toHaveBeenCalledWith("file:///new");
});
test("commit precedes obsolete image cleanup and preserves concurrent settings", async () => {
  const o = new Operations();
  let record: RecordV1 = {
    ...initial,
    recipient: qr("old"),
    link: "my:link",
    cents: 200,
  };
  const remove = jest.fn(async () => {
    expect(record.recipient?.image).toBe("file:///new");
  });
  await importRecipient(
    o.begin(),
    o,
    async () => qr("new"),
    async (transform) => {
      record = transform(record);
    },
    remove,
  );
  expect(record.cents).toBe(200);
  expect(record.link).toBe("my:link");
  expect(remove).toHaveBeenCalledWith("file:///old");
});
