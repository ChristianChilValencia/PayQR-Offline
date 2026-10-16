import { paymentPNGFilename, savePNGToGallery } from "../src/services/gallery";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { executionEnvironment: "bare" },
  ExecutionEnvironment: { StoreClient: "storeClient" },
}));

jest.mock("expo-media-library/legacy", () => {
  throw new Error("Cannot find native module 'ExpoMediaLibrary'");
});

test("missing gallery module does not prevent startup and saving explains the fallback", async () => {
  expect(typeof savePNGToGallery).toBe("function");
  await expect(savePNGToGallery("file:///card.png")).rejects.toThrow("use Share PNG");
});

test("Android Expo Go never loads the restricted media library", async () => {
  const originalOS = Platform.OS;
  const originalEnvironment = Constants.executionEnvironment;
  Platform.OS = "android";
  Constants.executionEnvironment = ExecutionEnvironment.StoreClient;
  try {
    await expect(savePNGToGallery("file:///card.png")).rejects.toThrow("In Expo Go, use Share PNG instead.");
  } finally {
    Platform.OS = originalOS;
    Constants.executionEnvironment = originalEnvironment;
  }
});


test("PNG filename uses a padded local date/time, milliseconds, and a safe PNG extension", () => {
  expect(paymentPNGFilename(new Date(2026, 0, 2, 3, 4, 5, 6))).toBe("payqr_2026-01-02_03-04-05-006.png");
});
