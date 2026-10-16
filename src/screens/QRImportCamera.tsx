import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, Modal, Text } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";
import { create } from "qrcode";
import { validateQR } from "../domain/core";
import { Recipient } from "../domain/state";
import { Action, styles as s } from "./common";

export function QRImportCamera({ onImport, onClose }: {
  onImport: (recipient: Recipient) => void;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [error, setError] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => setForeground(state === "active"));
    return () => subscription.remove();
  }, []);
  return <Modal animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={[s.page, { padding: 18, gap: 16 }]}>
      <Text style={s.sectionTitle}>Capture QR</Text>
      {!permission ? <ActivityIndicator accessibilityLabel="Loading camera permission" /> : !permission.granted ? <>
        <Text style={s.text}>Allow camera access to automatically scan a payment QR.</Text>
        <Action title={permission.canAskAgain ? "Allow camera" : "Open system settings"} onPress={() => {
          void (permission.canAskAgain ? requestPermission() : Linking.openSettings()).catch(() => setError("Could not open camera permissions. Try again."));
        }} />
      </> : !error && foreground ? <>
        <Text style={s.text}>Point the camera at a QR. It will scan automatically.</Text>
        <CameraView facing="back" style={{ flex: 1, minHeight: 220, borderRadius: 20, overflow: "hidden" }} barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onMountError={() => setError("Could not start the camera. Check permissions and retry.")}
          onBarcodeScanned={({ data }) => {
            if (lock.current) return;
            lock.current = true;
            try {
              const validation = validateQR(data);
              create(data, { errorCorrectionLevel: "M" });
              onImport({ payload: data, validation });
            } catch (e) {
              setError(e instanceof Error ? e.message : "Invalid payment QR. Try another code.");
            }
          }} />
      </> : null}
      {!!error && <><Text style={s.error}>{error}</Text><Action title="Retry" onPress={() => { lock.current = false; setError(""); }} /></>}
      <Action title="Cancel" icon="close" variant="secondary" onPress={onClose} />
    </SafeAreaView>
  </Modal>;
}
