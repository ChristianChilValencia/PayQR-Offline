import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, Modal, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";
import { create } from "qrcode";
import { validateQR } from "../domain/core";
import { Recipient } from "../domain/state";
import { BottomSheet } from "./BottomSheet";
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
  if (permission && !permission.granted) return <BottomSheet visible onClose={onClose} title="Allow camera access" icon="camera">
    <Text style={s.text}>Allow camera access to scan a payment QR.</Text>
    {!!error && <Text style={s.error}>{error}</Text>}
    <View style={s.row}>
      <View style={{ flex: 1 }}><Action title="Cancel" variant="secondary" onPress={onClose} /></View>
      <View style={{ flex: 1 }}><Action title={permission.canAskAgain ? "Allow camera" : "Open system settings"} onPress={() => {
        void (permission.canAskAgain ? requestPermission() : Linking.openSettings()).catch(() => setError("Could not open camera permissions. Try again."));
      }} /></View>
    </View>
  </BottomSheet>;
  return <Modal animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={[s.page, { padding: 18, gap: 16 }]}>
      <Text style={s.sectionTitle}>Capture QR</Text>
      {!permission ? <ActivityIndicator accessibilityLabel="Loading camera permission" /> : !error && foreground ? <>
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
