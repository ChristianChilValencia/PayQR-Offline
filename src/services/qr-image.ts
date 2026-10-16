import * as FS from "expo-file-system/legacy";
import { Camera } from "expo-camera";
export const scanQRImage = (uri: string) =>
  Camera.scanFromURLAsync(uri, ["qr"]);
/** Migration only: never delete the user's original selected photo. */
export async function removeImage(uri: string) {
  if (!FS.documentDirectory) return;
  if (!uri.startsWith(FS.documentDirectory)) return;
  const filename = uri.slice(FS.documentDirectory.length);
  if (!/^(?:payqr|bluepeso)-[a-zA-Z0-9.-]+\.(?:img|png)$/.test(filename))
    return;
  await FS.deleteAsync(uri, { idempotent: true });
}
