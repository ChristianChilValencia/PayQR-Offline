import AsyncStorage from "@react-native-async-storage/async-storage";

// Browsers have no SecureStore/Keystore. Do not store a pretend secret beside the data.
export async function readStoredValue(raw: string | null): Promise<string | null> {
  return raw;
}

export async function writeStoredValue(value: string): Promise<void> {
  await AsyncStorage.setItem("payqr.v1", value);
  await AsyncStorage.removeItem("bluepeso.v1");
}
