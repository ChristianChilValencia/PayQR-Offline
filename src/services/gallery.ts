import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import * as FS from "expo-file-system/legacy";

/** Device-local date and time; milliseconds distinguish rapid downloads. */
export function paymentPNGFilename(date = new Date()): string {
  const pad = (value: number, width = 2) => String(value).padStart(width, "0");
  return `payqr_${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}-${pad(date.getMilliseconds(), 3)}.png`;
}

export async function savePNGToGallery(uri: string) {
  if (Platform.OS === "android" && Constants.executionEnvironment === ExecutionEnvironment.StoreClient)
    throw new Error("Gallery saving needs a PayQR Android build. In Expo Go, use Share PNG instead.");
  // Load only when saving. The root API requires ExpoMediaLibraryNext,
  // which may be absent in the installed Expo Go native runtime.
  let Media: typeof import("expo-media-library/legacy");
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Media = require("expo-media-library/legacy") as typeof Media;
  } catch {
    throw new Error("Gallery saving is unavailable in this Expo Go version. Update Expo Go or use Share PNG.");
  }
  const permission = await Media.requestPermissionsAsync(true, ["photo"]);
  if (!permission.granted)
    throw new Error("Gallery permission denied. You can use Share PNG.");
  if (!FS.cacheDirectory) throw new Error("Temporary storage is unavailable. Retry saving the PNG.");
  const namedURI = FS.cacheDirectory + paymentPNGFilename();
  try {
    // MediaLibrary uses the source basename as the gallery filename.
    await FS.copyAsync({ from: uri, to: namedURI });
    await Media.saveToLibraryAsync(namedURI);
  } finally {
    // A cleanup failure must not turn a successful gallery save into an error.
    await FS.deleteAsync(namedURI, { idempotent: true }).catch(() => {});
  }
}
