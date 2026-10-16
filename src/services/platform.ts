import AsyncStorage from "@react-native-async-storage/async-storage";
import { scanQRImage } from "./qr-image";
import * as Picker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { savePNGToGallery } from "./gallery";
import QR from "qrcode";
import { hydrate, RecordV1, SerialStore, copyThenOpen } from "../domain/state";
import { validateQR } from "../domain/core";
import { openConfiguredApp } from "./launcher";
import { readStoredValue, writeStoredValue } from "./storage";
export { removeImage } from "./qr-image";
export const store = new SerialStore(writeStoredValue);
export async function load(): Promise<RecordV1> {
  // Preserve existing installations when adopting the PayQR storage key.
  const current = await AsyncStorage.getItem("payqr.v1");
  const legacy =
    current === null ? await AsyncStorage.getItem("bluepeso.v1") : null;
  const r = hydrate(await readStoredValue(current ?? legacy));
  if (r.recipient) assertRenderable(r.recipient.payload);
  // Validate and persist before cleaning either legacy key or image references.
  await store.save(r);
  return r;
}
export async function pickQR() {
  const picked = await Picker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: false,
    quality: 1,
  });
  if (picked.canceled) return null;
  const asset = picked.assets[0];
  if ((asset.fileSize ?? 0) > 20 * 1024 * 1024 || asset.width * asset.height > 40_000_000)
    throw new Error("Image is too large. Choose a QR image below 20 MB and 40 megapixels.");
  const results = await scanQRImage(asset.uri);
  if (results.length !== 1 || !results[0].data)
    throw new Error(
      "Invalid QR: select an image containing exactly one readable QR.",
    );
  const payload = results[0].data;
  let validation;
  try {
    validation = validateQR(payload);
  } catch (e) {
    throw new Error(
      `Invalid QR: ${e instanceof Error ? e.message : "malformed payload"}`,
    );
  }
  assertRenderable(payload);
  return { payload, validation };
}
function assertRenderable(payload: string) {
  try {
    QR.create(payload, { errorCorrectionLevel: "M" });
  } catch {
    throw new Error("Invalid QR: payload cannot be rendered safely.");
  }
}
export async function copyNumber(number: string) {
  const ok = await Clipboard.setStringAsync(number);
  if (!ok) throw new Error("Clipboard unavailable. Nothing was opened.");
}
export const openLink = openConfiguredApp;
export const copyAndOpen = (number: string, link: string) =>
  copyThenOpen(number, link, copyNumber, openLink);
export async function sharePNG(uri: string) {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("PNG sharing is unavailable on this device.");
  await Sharing.shareAsync(uri, {
    mimeType: "image/png",
    dialogTitle: "Share PayQR PNG",
  });
}
export async function savePNG(uri: string) {
  await savePNGToGallery(uri);
}
