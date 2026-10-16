import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { readStoredValue, writeStoredValue } from "../src/services/storage";

jest.mock("@react-native-async-storage/async-storage", () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), WHEN_UNLOCKED_THIS_DEVICE_ONLY: 7 }));
// Exercise real AES-GCM through a Node adapter; native module behavior still needs a device build.
jest.mock("expo-crypto", () => {
  const crypto = jest.requireActual("node:crypto");
  return {
    AESEncryptionKey: {
      generate: async () => ({ encoded: async () => crypto.randomBytes(32).toString("hex") }),
      import: async (hex: string) => Buffer.from(hex, "hex"),
    },
    AESSealedData: { fromCombined: (base64: string) => Buffer.from(base64, "base64") },
    aesEncryptAsync: async (bytes: Uint8Array, key: Buffer) => {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
      const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
      return { combined: async () => Buffer.concat([iv, ciphertext, cipher.getAuthTag()]).toString("base64") };
    },
    aesDecryptAsync: async (bytes: Buffer, key: Buffer) => {
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
      decipher.setAuthTag(bytes.subarray(-16));
      return Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]);
    },
  };
});

let values: Map<string, string>;
let key: string | null;
beforeEach(() => {
  jest.clearAllMocks();
  values = new Map();
  key = null;
  jest.mocked(AsyncStorage.getItem).mockImplementation(async (name) => values.get(name) ?? null);
  jest.mocked(AsyncStorage.setItem).mockImplementation(async (name, value) => { values.set(name, value); });
  jest.mocked(AsyncStorage.removeItem).mockImplementation(async (name) => { values.delete(name); });
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async () => key);
  jest.mocked(SecureStore.setItemAsync).mockImplementation(async (_name, value) => { key = value; });
});

test("encrypted history round-trips Unicode and large records with a separate device key", async () => {
  const record = { label: "Café ₱ 🧾", numbers: Array(500).fill("09171234567") };
  const plaintext = JSON.stringify(record);
  values.set("payqr.v1", plaintext);
  values.set("bluepeso.v1", plaintext);
  await writeStoredValue(plaintext);
  const encrypted = values.get("payqr.v1")!;
  expect(encrypted).not.toContain("09171234567");
  expect(JSON.parse((await readStoredValue(encrypted))!)).toEqual(record);
  expect(values.has("bluepeso.v1")).toBe(false);
  expect(key).toHaveLength(64);
  await writeStoredValue(plaintext);
  expect(values.get("payqr.v1")).not.toBe(encrypted);
});

test("key storage failure preserves both plaintext sources", async () => {
  values.set("payqr.v1", "original"); values.set("bluepeso.v1", "legacy");
  jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error("Locked"));
  await expect(writeStoredValue("new")).rejects.toThrow("Locked");
  expect(values.get("payqr.v1")).toBe("original");
  expect(values.get("bluepeso.v1")).toBe("legacy");
});

test("failed ciphertext write preserves the recovery copy", async () => {
  values.set("bluepeso.v1", "legacy");
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error("Disk full"));
  await expect(writeStoredValue("new")).rejects.toThrow("Disk full");
  expect(values.get("bluepeso.v1")).toBe("legacy");
});

test("missing keys never replace unreadable encrypted history", async () => {
  await writeStoredValue("{}");
  const encrypted = values.get("payqr.v1")!;
  key = null;
  await expect(readStoredValue(encrypted)).rejects.toThrow("cannot be unlocked");
  await expect(writeStoredValue("replacement")).rejects.toThrow("cannot be unlocked");
  expect(values.get("payqr.v1")).toBe(encrypted);
});

test("tampering fails authentication and never falls back to old history", async () => {
  await writeStoredValue("{}");
  const encrypted = values.get("payqr.v1")!;
  const prefix = "payqr:aes-gcm:1:";
  const bytes = Buffer.from(encrypted.slice(prefix.length), "base64");
  bytes[12] ^= 1;
  await expect(readStoredValue(prefix + bytes.toString("base64"))).rejects.toThrow();
  expect(values.get("payqr.v1")).toBe(encrypted);
});
