import { strToU8, strFromU8, zipSync, unzipSync } from "fflate";
import { backupDocument, parseBackupDocument, MAX_BACKUP_BYTES, MAX_HISTORY_BYTES } from "../domain/backup";
import { RecordV1 } from "../domain/state";

const ENTRY = "payqr-backup.json";
const invalid = () => new Error("Damaged ZIP or unsupported PayQR backup. Your saved data has not changed.");

export async function createBackupZip(record: RecordV1): Promise<Uint8Array> {
  const document = strToU8(backupDocument(record));
  try {
    if (document.length > MAX_HISTORY_BYTES) throw new Error("History is too large for a backup (1 MB maximum).");
    return zipSync({ [ENTRY]: document }, { level: 0, mtime: new Date("1980-01-01T00:00:00Z") });
  } finally { document.fill(0); }
}

export async function openBackupZip(zip: Uint8Array): Promise<RecordV1> {
  try {
    if (!zip.length || zip.length > MAX_BACKUP_BYTES) throw invalid();
    let entries = 0;
    const files = unzipSync(zip, { filter(file) {
      // Accept only bounded STORE entries: no extraction and no decompression of untrusted data.
      if (++entries !== 1 || file.name !== ENTRY || file.compression !== 0 ||
          file.originalSize > MAX_HISTORY_BYTES || file.size !== file.originalSize) throw invalid();
      return true;
    } });
    if (entries !== 1 || !files[ENTRY] || files[ENTRY].length > MAX_HISTORY_BYTES) throw invalid();
    try { return parseBackupDocument(strFromU8(files[ENTRY])); }
    finally { files[ENTRY].fill(0); }
  } catch { throw invalid(); }
}
