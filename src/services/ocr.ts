import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";
export function ocrAvailable() {
  return Platform.OS === "android" && !!requireOptionalNativeModule("PayQROCR");
}
export async function recognizeText(uri: string): Promise<string> {
  const native = Platform.OS === "android" ? requireOptionalNativeModule<{ recognizeText(uri: string): Promise<string> }>("PayQROCR") : null;
  if (!native) throw new Error("Offline scanning requires the PayQR Android development build. iOS and Expo Go are unsupported.");
  return native.recognizeText(uri);
}
