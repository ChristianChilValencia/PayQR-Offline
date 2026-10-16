import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  ScrollView,
  Text,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import * as FS from "expo-file-system/legacy";
import { useApp } from "../../App";
import { saveApp, saveNumber } from "../domain/state";
import { findPhones } from "../domain/core";
import { ocrAvailable, recognizeText } from "../services/ocr";
import { Numbers } from "./Numbers";
import { BottomSheet } from "./BottomSheet";
import { Action, styles as s } from "./common";

export function Scan() {
  const app = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const active = useRef(true);
  const lock = useRef(false);
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [numbers, setNumbers] = useState<string[] | null>(null);
  useEffect(() => {
    active.current = true;
    const subscription = AppState.addEventListener("change", (state) => {
      setForeground(state === "active");
      setReady(false);
    });
    return () => {
      active.current = false;
      subscription.remove();
    };
  }, []);
  function cancel() {
    active.current = false;
    router.back();
  }
  function retry() {
    setNumbers(null);
    setError("");
    setReady(false);
  }
  async function capture() {
    if (lock.current || !ready || !camera.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    let uri: string | undefined;
    try {
      const photo = await camera.current.takePictureAsync({ quality: 1 });
      uri = photo?.uri;
      if (!uri) throw new Error("No photo captured. Try again.");
      if (!active.current) return;
      setProcessing(true);
      const text = await recognizeText(uri);
      if (active.current) {
        const candidates = findPhones(text);
        setNumbers(candidates);
        await app.patch((r) =>
          candidates.reduce(
            (current, n) => saveNumber(current, n, "scanned"),
            r,
          ),
        );
      }
    } catch (e) {
      if (active.current)
        setError(
          e instanceof Error ? e.message : "Recognition failed. Try again.",
        );
    } finally {
      if (uri) {
        try {
          await FS.deleteAsync(uri, { idempotent: true });
        } catch {
          if (active.current)
            setError(
              "Could not delete the temporary capture. Close this screen and try again.",
            );
        }
      }
      lock.current = false;
      if (active.current) {
        setBusy(false);
        setProcessing(false);
      }
    }
  }
  return (
    <View style={[s.page, { padding: 18, gap: 12 }]}>
      <Text style={s.subtitle}>Scan mobile numbers</Text>
      {!ocrAvailable() ? (
        <Text style={s.text}>
          Offline camera scanning requires the PayQR Android development build.
          iOS and Expo Go are unsupported. Enter a number manually on the main
          screen.
        </Text>
      ) : !permission ? (
        <ActivityIndicator accessibilityLabel="Loading camera permission" />
      ) : !permission.granted ? (
        <BottomSheet visible onClose={cancel} title="Allow camera access" icon="camera">
          <Text style={s.text}>Camera permission is required to capture numbers.</Text>
          {!!error && <Text style={s.error}>{error}</Text>}
          <View style={s.row}>
            <View style={{ flex: 1 }}><Action title="Cancel" variant="secondary" onPress={cancel} /></View>
            <View style={{ flex: 1 }}><Action title={permission.canAskAgain ? "Allow camera" : "Open system settings"} onPress={() => {
              void (permission.canAskAgain ? requestPermission() : Linking.openSettings()).catch(() => setError("Could not open camera permissions. Try again."));
            }} /></View>
          </View>
        </BottomSheet>
      ) : processing ? (
        <>
          <ActivityIndicator accessibilityLabel="Recognizing numbers" />
          <Text style={s.text}>Recognizing numbers offline...</Text>
        </>
      ) : numbers !== null ? (
        <ScrollView contentContainerStyle={{ gap: 12 }}>
          {!numbers.length && (
            <Text style={s.text}>
              No complete mobile numbers found. Try a clearer photo or enter a
              number below.
            </Text>
          )}
          <Numbers
      savedNumbers={app.record.numbers?.map((n) => n.number)}
      savedEntries={app.record.numbers}
      saveApp={(link) => app.patch((r) => saveApp(r, link))}
            docked={false}
            save={(n, label) => app.patch((r) => saveNumber(r, n, "manual", label))}
            candidates={numbers}
            onScan={retry}
            link={app.record.link}
            report={app.report}
          />
        </ScrollView>
      ) : !error && foreground ? (
        <>
          <CameraView
            ref={camera}
            facing="back"
            style={{ flex: 1, minHeight: 220 }}
            onCameraReady={() => setReady(true)}
            onMountError={() =>
              setError("Could not start camera. Retry or check permissions.")
            }
          />
          <Action
            icon="camera"
            title="Capture"
            disabled={!ready || busy}
            onPress={() => {
              void capture();
            }}
          />
        </>
      ) : null}
      {!!error && (
        <>
          <Text style={s.error}>{error}</Text>
          <Action title="Retry" onPress={retry} />
        </>
      )}
      <Action
        title={numbers !== null ? "Done" : "Cancel"}
        variant="secondary"
        onPress={cancel}
      />
    </View>
  );
}
