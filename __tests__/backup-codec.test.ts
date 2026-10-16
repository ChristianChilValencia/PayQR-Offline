import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { createBackupZip, openBackupZip } from "../src/services/backup-codec";
import { initial, migrate, saveNumber } from "../src/domain/state";
import { MAX_BACKUP_BYTES, MAX_HISTORY_BYTES } from "../src/domain/backup";
const entry = "payqr-backup.json";
test("ordinary ZIP roundtrips history without a password", async () => {
  const source = saveNumber(migrate(initial), "09171234567", "manual", "Caf?");
  const zip = await createBackupZip(source);
  expect(Array.from(zip.slice(0, 4))).toEqual([80, 75, 3, 4]);
  expect(Object.keys(unzipSync(zip))).toEqual([entry]);
  expect(strFromU8(unzipSync(zip)[entry])).toContain("09171234567");
  expect(await openBackupZip(zip)).toEqual(source);
});
test("rejects paths, extra entries, compressed entries, and oversized data", async () => {
  for (const zip of [
    zipSync({ "../payqr-backup.json": strToU8("{}") }, { level: 0 }),
    zipSync({ [entry]: strToU8("{}"), "extra.txt": strToU8("extra") }, { level: 0 }),
    zipSync({ [entry]: strToU8("x".repeat(100000)) }, { level: 9 }),
    zipSync({ [entry]: new Uint8Array(MAX_HISTORY_BYTES + 1) }, { level: 0 }),
    new Uint8Array(MAX_BACKUP_BYTES + 1),
    new Uint8Array([80, 75]),
    zipSync({ [entry]: strToU8('{"__proto__":{}}') }, { level: 0 }),
    zipSync({ [entry]: strToU8('{"format":"payqr-encrypted-backup","version":1}') }, { level: 0 }),
  ]) await expect(openBackupZip(zip)).rejects.toThrow("unsupported");
});
