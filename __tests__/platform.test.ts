import { fixture } from "./fixture";
import * as FS from "expo-file-system/legacy";
import { Camera } from "expo-camera";
import * as Picker from "expo-image-picker";
import * as Media from "expo-media-library";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  pickQR,
  load,
  savePNG,
  sharePNG,
  copyNumber,
} from "../src/services/platform";
import { initial } from "../src/domain/state";
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///private/",
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
jest.mock("expo-media-library", () => ({
  requestPermissionsAsync: jest.fn(),
  Asset: { create: jest.fn() },
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
test("staged private image and recomputed validation", async () => {
  const r = await pickQR();
  expect(r?.image).toMatch(/^file:\/\/\/private\/bluepeso-/);
  expect(r?.validation.eligible).toBe(false);
  expect(FS.copyAsync).toHaveBeenCalled();
});
test("malformed decoded payment QR never stages an image", async () => {
  jest
    .mocked(Camera.scanFromURLAsync)
    .mockResolvedValue([
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
test("failed image copy cleans staging and returns no recipient", async () => {
  jest.mocked(FS.copyAsync).mockRejectedValue(new Error("disk"));
  await expect(pickQR()).rejects.toThrow("disk");
  expect(FS.deleteAsync).toHaveBeenCalled();
});
test("missing image surfaces hydration error", async () => {
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
  await expect(load()).rejects.toThrow("missing");
});
test("gallery denial never saves, successful grant saves PNG", async () => {
  jest
    .mocked(Media.requestPermissionsAsync)
    .mockResolvedValue({ granted: false } as never);
  await expect(savePNG("file:///a.png")).rejects.toThrow("denied");
  expect(Media.Asset.create).not.toHaveBeenCalled();
  jest
    .mocked(Media.requestPermissionsAsync)
    .mockResolvedValue({ granted: true } as never);
  await savePNG("file:///a.png");
  expect(Media.Asset.create).toHaveBeenCalledWith("file:///a.png");
});
test("sharing unavailable surfaces error", async () => {
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(false);
  await expect(sharePNG("file:///a.png")).rejects.toThrow("unavailable");
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
});
test("clipboard false is failure", async () => {
  jest.mocked(Clipboard.setStringAsync).mockResolvedValue(false);
  await expect(copyNumber("09123456789")).rejects.toThrow(
    "Clipboard unavailable",
  );
});
