import AsyncStorage from "@react-native-async-storage/async-storage";
import { AESEncryptionKey, AESSealedData, aesEncryptAsync, aesDecryptAsync } from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const PREFIX = "payqr:aes-gcm:1:";
const KEY = "payqr.history-key.v1";
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export async function readStoredValue(raw: string | null): Promise<string | null> {
  if (raw === null || !raw.startsWith(PREFIX)) return raw;
  const encoded = await SecureStore.getItemAsync(KEY, options);
  if (!encoded) throw new Error("Saved history cannot be unlocked on this device. Your data has been retained.");
  const key = await AESEncryptionKey.import(encoded, "hex");
  const bytes = await aesDecryptAsync(AESSealedData.fromCombined(raw.slice(PREFIX.length)), key);
  // The encrypted JSON is ASCII (Unicode characters use JSON escape sequences).
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
}

export async function writeStoredValue(value: string): Promise<void> {
  let encoded = await SecureStore.getItemAsync(KEY, options);
  if (!encoded) {
    const existing = await AsyncStorage.getItem("payqr.v1");
    if (existing?.startsWith(PREFIX))
      throw new Error("Saved history cannot be unlocked. Your data has been retained.");
    const generated = await AESEncryptionKey.generate();
    encoded = await generated.encoded("hex");
    // Persist the key before replacing any existing plaintext history.
    await SecureStore.setItemAsync(KEY, encoded, options);
  }
  const key = await AESEncryptionKey.import(encoded, "hex");
  const ascii = value.replace(/[\u007f-\uffff]/g, (char) =>
    "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0"));
  const sealed = await aesEncryptAsync(Uint8Array.from(ascii, (char) => char.charCodeAt(0)), key);
  await AsyncStorage.setItem("payqr.v1", PREFIX + await sealed.combined("base64"));
  // Never remove the recovery source until the encrypted write succeeds.
  await AsyncStorage.removeItem("bluepeso.v1");
}
