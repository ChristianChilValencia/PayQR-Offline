import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import * as Linking from "expo-linking";
import { availableApps, openConfiguredApp } from "../src/services/launcher";
import { packageTarget, readPackageTarget } from "../src/domain/launcher";
import { validateLink } from "../src/domain/core";
jest.mock("expo", () => ({ requireOptionalNativeModule: jest.fn() }));
jest.mock("expo-linking", () => ({ canOpenURL: jest.fn(), openURL: jest.fn() }));
const originalOS = Platform.OS;
afterEach(() => { Platform.OS = originalOS; jest.resetAllMocks(); });

test("app targets roundtrip names and reject malformed packages", () => {
  const target = packageTarget("com.example.wallet", "Wallet & Pay");
  expect(readPackageTarget(target)).toEqual({ packageName: "com.example.wallet", name: "Wallet & Pay" });
  expect(validateLink(target)).toBe(target);
  expect(() => packageTarget("../other", "Bad")).toThrow();
  expect(validateLink("payqr-app://com.example/path")).toBeNull();
  expect(validateLink("payqr-app://user:pass@com.example")).toBeNull();
});
test("Android discovers apps and launches a saved package without a URL", async () => {
  Platform.OS = "android";
  const native = { getApps: jest.fn().mockResolvedValue([{ name: "Wallet", packageName: "com.example.wallet", icon: null }]), openApp: jest.fn().mockResolvedValue(undefined) };
  jest.mocked(requireOptionalNativeModule).mockReturnValue(native as never);
  const apps = await availableApps();
  expect(apps[0].name).toBe("Wallet");
  await openConfiguredApp(apps[0].target);
  expect(native.openApp).toHaveBeenCalledWith("com.example.wallet");
  expect(Linking.openURL).not.toHaveBeenCalled();
});
test("Expo Go reports unavailable native picker and does not launch", async () => {
  Platform.OS = "android";
  jest.mocked(requireOptionalNativeModule).mockReturnValue(null);
  await expect(availableApps()).rejects.toThrow("development build");
  await expect(openConfiguredApp(packageTarget("com.example.wallet", "Wallet"))).rejects.toThrow("Android build");
  expect(Linking.openURL).not.toHaveBeenCalled();
});
test("iPhone lists only available supported apps and rejects Android selections", async () => {
  Platform.OS = "ios";
  jest.mocked(Linking.canOpenURL).mockResolvedValue(false);
  expect(await availableApps()).toEqual([]);
  jest.mocked(Linking.canOpenURL).mockResolvedValue(true);
  expect(await availableApps()).toEqual([{ name: "GCash", target: "gcash://" }]);
  await openConfiguredApp("gcash://");
  expect(Linking.openURL).toHaveBeenCalledWith("gcash://");
  await expect(openConfiguredApp(packageTarget("com.example.wallet", "Wallet"))).rejects.toThrow("Android");
  expect(requireOptionalNativeModule).not.toHaveBeenCalled();
});
test("custom links launch exactly as saved and invalid links are rejected", async () => {
  Platform.OS = "web";
  const target = "https://example.com/pay";
  await openConfiguredApp(target);
  expect(Linking.openURL).toHaveBeenCalledWith(target);
  await expect(openConfiguredApp("javascript:alert(1)")).rejects.toThrow("valid launch link");
});

test("unavailable link handler gives an actionable error", async () => {
  Platform.OS = "ios";
  jest.mocked(Linking.openURL).mockRejectedValue(new Error("No handler"));
  await expect(openConfiguredApp("gcash://")).rejects.toThrow("Install an app");
});

test("Android URL selections require reselection and never open", async () => {
  Platform.OS = "android";
  await expect(openConfiguredApp("gcash://")).rejects.toThrow("again in Settings");
  expect(Linking.openURL).not.toHaveBeenCalled();
});
