import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { Operations, RecordV1, initial } from "./src/domain/state";
import { importRecipient } from "./src/domain/import";
import { load, pickQR, removeImage, store } from "./src/services/platform";
import { styles as s } from "./src/screens/common";
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
  const operations = useRef(new Operations()),
    commit = useRef(false);
  const report = (message: string) => Alert.alert("BluePeso", message);
  useEffect(() => {
    void load()
      .then((r) => {
        latest.current = r;
        setRecord(r);
      })
      .catch((e) =>
        report(
          `${e.message} Your stored record has not been treated as valid. Import a QR again.`,
        ),
      )
      .finally(() => setLoaded(true));
  }, []);
  // Every mutation runs through this queue and derives from the latest committed record.
  const mutation = useRef<Promise<unknown>>(Promise.resolve());
  function patch(transform: (r: RecordV1) => RecordV1): Promise<void> {
    const next = mutation.current
      .catch(() => {})
      .then(async () => {
        const r = transform(latest.current);
        await store.save(r);
        latest.current = r;
        setRecord(r);
      });
    mutation.current = next;
    return next;
  }
  async function importQR() {
    const id = operations.current.begin();
    setBusy(true);
    try {
      await importRecipient(
        id,
        operations.current,
        pickQR,
        patch,
        removeImage,
        () => {
          commit.current = true;
        },
      );
    } catch (e) {
      if (operations.current.current(id))
        report(
          e instanceof Error
            ? e.message
            : "QR import failed. Previous recipient retained.",
        );
    } finally {
      if (operations.current.current(id)) {
        commit.current = false;
        setBusy(false);
      }
    }
  }
  if ((!fonts && !fontError) || !loaded)
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[s.page, { justifyContent: "center" }]}>
          <ActivityIndicator accessibilityLabel="Loading BluePeso" />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.page}>
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
              cancel: () => {
                if (!commit.current) {
                  operations.current.cancel();
                  setBusy(false);
                }
              },
            }}
          >
            {children}
          </Context.Provider>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
