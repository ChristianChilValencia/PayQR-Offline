import AsyncStorage from "@react-native-async-storage/async-storage";
import { AESEncryptionKey, AESSealedData, aesEncryptAsync, aesDecryptAsync } from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const PREFIX = "payqr:aes-gcm:1:";
const KEY = "payqr.history-key.v1";
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

// Android's native fromCombined accepts ByteArray even though the JS API also
// advertises base64 strings. Decode explicitly to keep existing records readable.
function decodeCombined(value: string): Uint8Array {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))
    throw new Error("Saved history has invalid encryption data. Your data has been retained.");
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const bytes = new Uint8Array(value.length / 4 * 3 - (value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0));
  let bits = 0, count = 0, index = 0;
  for (const char of value) {
    if (char === "=") break;
    bits = (bits << 6) | alphabet.indexOf(char);
    count += 6;
    if (count >= 8) { count -= 8; bytes[index++] = (bits >>> count) & 255; }
  }
  if (bytes.length < 28) throw new Error("Saved history is incomplete. Your data has been retained.");
  return bytes;
}

export async function readStoredValue(raw: string | null): Promise<string | null> {
  if (raw === null || !raw.startsWith(PREFIX)) return raw;
  const encoded = await SecureStore.getItemAsync(KEY, options);
  if (!encoded) throw new Error("Saved history cannot be unlocked on this device. Your data has been retained.");
  const key = await AESEncryptionKey.import(encoded, "hex");
  const bytes = await aesDecryptAsync(AESSealedData.fromCombined(decodeCombined(raw.slice(PREFIX.length)), { ivLength: 12, tagLength: 16 }), key);
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
  // The ciphertext is already committed. A stale legacy copy is safe because
  // reads prefer payqr.v1; cleanup failure must not roll back the in-memory state.
  await AsyncStorage.removeItem("bluepeso.v1").catch(() => {});
}
