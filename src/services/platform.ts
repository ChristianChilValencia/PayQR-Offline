import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FS from "expo-file-system/legacy";
import { Camera } from "expo-camera";
import * as Picker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import * as Sharing from "expo-sharing";
import * as Media from "expo-media-library";
import QR from "qrcode";
import { hydrate, RecordV1, SerialStore, copyThenOpen } from "../domain/state";
import { validateQR } from "../domain/core";
export const store = new SerialStore((value) =>
  AsyncStorage.setItem("bluepeso.v1", value),
);
export async function load(): Promise<RecordV1> {
  const r = hydrate(await AsyncStorage.getItem("bluepeso.v1"));
  if (r.recipient) assertRenderable(r.recipient.payload);
  if (r.recipient && !(await FS.getInfoAsync(r.recipient.image)).exists)
    throw new Error("Saved QR image is missing. Import it again.");
  return r;
}
export async function pickQR() {
  const picked = await Picker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: false,
    quality: 1,
  });
  if (picked.canceled) return null;
  const results = await Camera.scanFromURLAsync(picked.assets[0].uri, ["qr"]);
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
  if (!FS.documentDirectory) throw new Error("Private storage unavailable");
  const image =
    FS.documentDirectory +
    `bluepeso-${Date.now()}-${Math.random().toString(36).slice(2)}.img`;
  try {
    await FS.copyAsync({ from: picked.assets[0].uri, to: image });
  } catch (e) {
    await removeImage(image);
    throw e;
  }
  return { image, payload, validation };
}
export async function removeImage(uri: string) {
  await FS.deleteAsync(uri, { idempotent: true }).catch(() => {});
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
export const openLink = (link: string) => Linking.openURL(link);
export const copyAndOpen = (number: string, link: string) =>
  copyThenOpen(number, link, copyNumber, openLink);
export async function sharePNG(uri: string) {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("PNG sharing is unavailable on this device.");
  await Sharing.shareAsync(uri, {
    mimeType: "image/png",
    dialogTitle: "Share BluePeso PNG",
  });
}
export async function savePNG(uri: string) {
  if (typeof Media.Asset?.create !== "function") {
    throw new Error("Gallery saving is unavailable here. Use Share PNG.");
  }
  const permission = await Media.requestPermissionsAsync(true, ["photo"]);
  if (!permission.granted)
    throw new Error("Gallery permission denied. You can use Share PNG.");
  await Media.Asset.create(uri);
}
