import { requireOptionalNativeModule } from "expo";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import { packageTarget, readPackageTarget } from "../domain/launcher";
import { validateLink } from "../domain/core";

export type LaunchApp = { name: string; target: string; icon?: string | null };
type NativeLauncher = {
  getApps(): Promise<{ name: string; packageName: string; icon?: string | null }[]>;
  openApp(packageName: string): Promise<void>;
};
function androidModule() {
  return requireOptionalNativeModule<NativeLauncher>("PayQRLauncher");
}
export function nativeAppPickerAvailable(): boolean {
  return Platform.OS === "android" && !!androidModule();
}
export async function availableApps(): Promise<LaunchApp[]> {
  if (Platform.OS === "android") {
    const native = androidModule();
    if (!native) throw new Error("Installed apps require the PayQR Android development build. Expo Go is unsupported.");
    return (await native.getApps()).map(app => ({
      name: app.name,
      icon: app.icon,
      target: packageTarget(app.packageName, app.name),
    }));
  }
  if (Platform.OS === "ios") {
    const supported = [{ name: "GCash", target: "gcash://" }];
    const checks = await Promise.all(supported.map(async app =>
      await Linking.canOpenURL(app.target) ? app : null));
    return checks.filter((app): app is LaunchApp => app !== null);
  }
  throw new Error("Choose an app on your phone, or use a custom HTTPS link here.");
}
export async function openConfiguredApp(target: string) {
  if (!validateLink(target)) throw new Error("Choose an app or save a valid launch link first.");
  const app = readPackageTarget(target);
  if (app) {
    if (Platform.OS !== "android")
      throw new Error("This selection is for Android. Choose an app on this phone instead.");
    const native = androidModule();
    if (!native) throw new Error("This saved selection needs the PayQR Android build. Install the Android development build.");
    await native.openApp(app.packageName);
    return;
  }
  if (Platform.OS === "android") throw new Error("Choose an installed app again in Settings. Saved URL selections are unsupported on Android.");
  try { await Linking.openURL(target); }
  catch { throw new Error("Could not open app. Install an app that handles this link, or choose another link in Settings."); }
}
