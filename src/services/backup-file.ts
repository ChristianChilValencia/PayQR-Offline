import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { randomUUID } from "expo-crypto";
import { MAX_BACKUP_BYTES } from "../domain/backup";

export async function pickBackupZip(): Promise<Uint8Array | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/zip", "application/x-zip-compressed", "application/octet-stream"],
    multiple: false, copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const file = new File(asset.uri);
  try {
    if (!asset.name.toLowerCase().endsWith(".zip") || (asset.size ?? file.size) > MAX_BACKUP_BYTES || file.size > MAX_BACKUP_BYTES)
      throw new Error("Choose a PayQR ZIP backup below 2 MB.");
    const bytes = await file.bytes();
    if (bytes.length > MAX_BACKUP_BYTES) throw new Error("Backup exceeds the 2 MB limit.");
    return bytes;
  } finally {
    // Only remove the picker's cache copy, never an original document.
    if (file.uri.startsWith(Paths.cache.uri.endsWith("/") ? Paths.cache.uri : Paths.cache.uri + "/")) {
      if (file.exists) file.delete();
    }
  }
}

export async function saveBackupZip(bytes: Uint8Array): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error("File sharing is unavailable on this device.");
  const directory = new Directory(Paths.cache, "payqr-backups");
  directory.create({ idempotent: true, intermediates: true });
  for (const cached of directory.list()) {
    const timestamp = /^payqr-backup-(\d{13})-[a-f0-9-]+\.zip$/.exec(cached.name)?.[1];
    if (cached instanceof File && timestamp && Date.now() - Number(timestamp) > 24 * 60 * 60 * 1000) {
      try { cached.delete(); } catch { /* OS cache eviction can also remove exports. */ }
    }
  }
  const file = new File(directory, `payqr-backup-${Date.now()}-${randomUUID()}.zip`);
  try {
    file.create(); file.write(bytes);
    await Sharing.shareAsync(file.uri, { mimeType: "application/zip", UTI: "public.zip-archive", dialogTitle: "Save PayQR backup" });
    // Android can resolve the chooser before the receiving app reads the URI.
    // Keep the ZIP in app-private cache and remove old exports on a later export.
  } catch (error) { if (file.exists) file.delete(); throw error; }
}
