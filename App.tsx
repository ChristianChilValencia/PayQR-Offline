import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Text,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { RecordV1, initial, migrate, legacyImages } from "./src/domain/state";

import { load, store, removeImage } from "./src/services/platform";
import { Action, styles as s } from "./src/screens/common";
type AppState = {
  record: RecordV1;
  busy: boolean;
  patch: (transform: (r: RecordV1) => RecordV1) => Promise<void>;
  importQR: () => Promise<void>;
  cancel: () => void;
  report: (m: string) => void;
};
const Context = createContext<AppState | null>(null);
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing app provider");
  return value;
}
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [fonts, fontError] = useFonts({
    RobotoRegular: require("./assets/fonts/Roboto-Regular.ttf"),
    RobotoMedium: require("./assets/fonts/Roboto-Medium.ttf"),
    RobotoBold: require("./assets/fonts/Roboto-Bold.ttf"),
  });
  const [record, setRecord] = useState<RecordV1>(initial),
    latest = useRef(initial);
  const [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);

  const pendingImages = useRef<string[]>([]);
  async function cleanLegacyImages() {
    const pending = pendingImages.current;
    pendingImages.current = [];
    for (const uri of pending) {
      try {
        await removeImage(uri);
      } catch {
        pendingImages.current.push(uri);
      }
    }
  }
  const report = (message: string) => Alert.alert("PayQR", message);
  useEffect(() => {
    void load()
      .then(async (r) => {
        pendingImages.current = legacyImages(r);
        const migrated = migrate(r);
        latest.current = migrated;
        setRecord(latest.current);
        if (r.version !== 3)
          await store
            .save(migrated)
            .then(cleanLegacyImages)
            .catch(() =>
              report(
                "Could not persist the history migration. Your saved data is retained; retry by saving an entry.",
              ),
            );
      })
      .catch(() => setLoadError("Your saved history could not be opened safely. Your data has been retained. Unlock your device and retry. If you just updated PayQR, install the new app build."))
      .finally(() => setLoaded(true));
  }, [loadAttempt]);
  // Every mutation runs through this queue and derives from the latest committed record.
  const mutation = useRef<Promise<unknown>>(Promise.resolve());
  function patch(transform: (r: RecordV1) => RecordV1): Promise<void> {
    const next = mutation.current
      .catch(() => {})
      .then(async () => {
        const r = transform(migrate(latest.current));
        await store.save(r);
        latest.current = r;
        setRecord(r);
        await cleanLegacyImages();
      });
    mutation.current = next;
    return next;
  }
  async function importQR() {
    /* Imports are staged in Settings. */
  }
  if (loaded && loadError)
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[s.page, { padding: 24, justifyContent: "center", gap: 18 }]}>
          <Text style={s.text}>{loadError}</Text>
          <Action title="Retry loading history" onPress={() => {
            setLoaded(false);
            setLoadError("");
            setLoadAttempt((attempt) => attempt + 1);
          }} />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  if ((!fonts && !fontError) || !loaded)
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[s.page, { justifyContent: "center", alignItems: "center", backgroundColor: "#ffffff", gap: 24 }]}>
          <Image
            source={require("./assets/splash-icon.png")}
            style={{ width: 180, height: 180 }}
            resizeMode="contain"
            accessibilityLabel="PayQR logo"
          />
          <ActivityIndicator accessibilityLabel="Loading PayQR" />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.page} edges={["top", "left", "right"]}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Context.Provider
            value={{
              record,
              busy,
              patch,
              importQR,
              report,
              cancel: () => setBusy(false),
            }}
          >
            {children}
          </Context.Provider>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
