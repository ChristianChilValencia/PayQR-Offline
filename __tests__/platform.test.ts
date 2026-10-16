import { fixture } from "./fixture";
import * as FS from "expo-file-system/legacy";
import { Camera } from "expo-camera";
import * as Picker from "expo-image-picker";
import * as Media from "expo-media-library/legacy";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  pickQR,
  load,
  savePNG,
  sharePNG,
  copyNumber,
  store,
} from "../src/services/platform";
import { initial, migrate } from "../src/domain/state";
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { executionEnvironment: "bare" },
  ExecutionEnvironment: { StoreClient: "storeClient" },
}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
jest.mock("../src/services/storage", () => jest.requireActual("../src/services/storage.web"));
jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///private/",
  cacheDirectory: "file:///cache/",
  copyAsync: jest.fn(),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn(),
}));
jest.mock("expo-camera", () => ({ Camera: { scanFromURLAsync: jest.fn() } }));
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn() }));
jest.mock("expo-linking", () => ({ openURL: jest.fn() }));
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));
jest.mock("expo-media-library", () => {
  throw new Error("Cannot find native module 'ExpoMediaLibraryNext'");
});
jest.mock("expo-media-library/legacy", () => ({
  requestPermissionsAsync: jest.fn(),
  saveToLibraryAsync: jest.fn(),
}));
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(Picker.launchImageLibraryAsync).mockResolvedValue({
    canceled: false,
    assets: [{ uri: "file:///picked.png", width: 300, height: 300 }],
  });
  jest.mocked(Camera.scanFromURLAsync).mockResolvedValue([
    {
      data: fixture(),
      type: "qr",
      bounds: { origin: { x: 0, y: 0 }, size: { width: 200, height: 200 } },
      cornerPoints: [],
    },
  ]);
  jest.mocked(FS.copyAsync).mockResolvedValue(undefined);
});
test("cancelled selection never copies", async () => {
  jest
    .mocked(Picker.launchImageLibraryAsync)
    .mockResolvedValue({ canceled: true, assets: null });
  expect(await pickQR()).toBeNull();
  expect(FS.copyAsync).not.toHaveBeenCalled();
});
test("exactly one QR required before staging", async () => {
  jest.mocked(Camera.scanFromURLAsync).mockResolvedValue([]);
  await expect(pickQR()).rejects.toThrow("exactly one");
  const one = {
    data: fixture(),
    type: "qr",
    bounds: { origin: { x: 0, y: 0 }, size: { width: 200, height: 200 } },
    cornerPoints: [],
  };
  jest.mocked(Camera.scanFromURLAsync).mockResolvedValue([one, one]);
  await expect(pickQR()).rejects.toThrow("exactly one");
  expect(FS.copyAsync).not.toHaveBeenCalled();
});
test("QR import returns only a validated payload and never copies the selected image", async () => {
  const r = await pickQR();
  expect(r?.payload).toBe(fixture());
  expect(r).not.toHaveProperty("image");
  expect(r?.validation.eligible).toBe(true);
  expect(FS.copyAsync).not.toHaveBeenCalled();
});

test("malformed decoded payment QR never stages an image", async () => {
  jest.mocked(Camera.scanFromURLAsync).mockResolvedValue([
    {
      data: "000301",
      type: "qr",
      bounds: { origin: { x: 0, y: 0 }, size: { width: 100, height: 100 } },
      cornerPoints: [],
    },
  ]);
  await expect(pickQR()).rejects.toThrow("Invalid QR");
  expect(FS.copyAsync).not.toHaveBeenCalled();
});
test("legacy records recover from their payload even when the image is missing", async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(
    JSON.stringify({
      ...initial,
      recipient: { image: "file:///private/a", payload: fixture() },
    }),
  );
  jest.mocked(FS.getInfoAsync).mockResolvedValue({
    exists: false,
    uri: "file:///private/a",
    isDirectory: false,
  });
  expect((await load()).recipient?.payload).toBe(fixture());
  expect(FS.getInfoAsync).not.toHaveBeenCalled();
});
test("gallery denial never saves, successful grant saves PNG", async () => {
  jest
    .mocked(Media.requestPermissionsAsync)
    .mockResolvedValue({ granted: false } as never);
  await expect(savePNG("file:///a.png")).rejects.toThrow("denied");
  expect(Media.saveToLibraryAsync).not.toHaveBeenCalled();
  jest
    .mocked(Media.requestPermissionsAsync)
    .mockResolvedValue({ granted: true } as never);
  await savePNG("file:///a.png");
  expect(Media.requestPermissionsAsync).toHaveBeenLastCalledWith(true, [
    "photo",
  ]);
  const destination = jest.mocked(FS.copyAsync).mock.calls.at(-1)![0].to;
  expect(destination).toMatch(/^file:\/\/\/cache\/payqr_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3}\.png$/);
  expect(Media.saveToLibraryAsync).toHaveBeenCalledWith(destination);
  expect(FS.deleteAsync).toHaveBeenCalledWith(destination, { idempotent: true });
});
test("sharing unavailable surfaces error", async () => {
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(false);
  await expect(sharePNG("file:///a.png")).rejects.toThrow("unavailable");
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
});
test("legacy stored records remain readable and subsequent writes use PayQR", async () => {
  jest
    .mocked(AsyncStorage.getItem)
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(JSON.stringify(initial));
  expect(await load()).toEqual(initial);
  expect(AsyncStorage.getItem).toHaveBeenNthCalledWith(1, "payqr.v1");
  expect(AsyncStorage.getItem).toHaveBeenNthCalledWith(2, "bluepeso.v1");
  await store.save(initial);
  expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(
    "payqr.v1",
    JSON.stringify(migrate(initial)),
  );
});
test("clipboard false is failure", async () => {
  jest.mocked(Clipboard.setStringAsync).mockResolvedValue(false);
  await expect(copyNumber("09123456789")).rejects.toThrow(
    "Clipboard unavailable",
  );
});

test("failed migration writes retain the legacy recovery copy", async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce(null).mockResolvedValueOnce(JSON.stringify(initial));
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error("Disk full"));
  await expect(load()).rejects.toThrow("Disk full");
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
});

test("successful writes remove stale legacy history", async () => {
  await store.save(initial);
  expect(AsyncStorage.removeItem).toHaveBeenCalledWith("bluepeso.v1");
});

test("oversized QR images are rejected before decoding", async () => {
  jest.mocked(Picker.launchImageLibraryAsync).mockResolvedValue({
    canceled: false,
    assets: [{ uri: "file:///large.png", width: 10000, height: 10000 }],
  });
  await expect(pickQR()).rejects.toThrow("too large");
  expect(Camera.scanFromURLAsync).not.toHaveBeenCalled();
});


test("failed gallery save cleans the named copy and preserves the original capture", async () => {
  jest.mocked(Media.requestPermissionsAsync).mockResolvedValue({ granted: true } as never);
  jest.mocked(Media.saveToLibraryAsync).mockRejectedValueOnce(new Error("Gallery full"));
  await expect(savePNG("file:///original.png")).rejects.toThrow("Gallery full");
  const destination = jest.mocked(FS.copyAsync).mock.calls.at(-1)![0].to;
  expect(FS.deleteAsync).toHaveBeenCalledWith(destination, { idempotent: true });
  expect(FS.deleteAsync).not.toHaveBeenCalledWith("file:///original.png", expect.anything());
});

test("copy failure never saves a partial PNG and allows retry", async () => {
  jest.mocked(Media.requestPermissionsAsync).mockResolvedValue({ granted: true } as never);
  jest.mocked(FS.copyAsync).mockRejectedValueOnce(new Error("Disk full"));
  await expect(savePNG("file:///original.png")).rejects.toThrow("Disk full");
  expect(Media.saveToLibraryAsync).not.toHaveBeenCalled();
  await expect(savePNG("file:///original.png")).resolves.toBeUndefined();
});
