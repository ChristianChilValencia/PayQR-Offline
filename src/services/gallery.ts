import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

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
  await Media.saveToLibraryAsync(uri);
}
