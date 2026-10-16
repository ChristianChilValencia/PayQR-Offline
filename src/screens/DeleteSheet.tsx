import React, { useRef, useState } from "react";
import { Text, View } from "react-native";
import { BottomSheet, BottomSheetHandle } from "./BottomSheet";
import { Action, styles as s } from "./common";
export function DeleteSheet({ visible, label, busy, onCancel, onConfirm }: { visible: boolean; label: string; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const sheet = useRef<BottomSheetHandle>(null);
  const [lastLabel, setLastLabel] = useState(label);
  if (visible && label !== lastLabel) setLastLabel(label);
  return <BottomSheet ref={sheet} visible={visible} onClose={onCancel} busy={busy} icon="trash" title="Delete saved entry?" backdropLabel="Cancel deletion">
    <Text style={s.text}>{lastLabel}</Text>
    <Text style={s.caption}>This removes the entry from saved history.</Text>
    <View style={s.row}>
      <View style={{ flex: 3 }}><Action title="Cancel" variant="secondary" icon="close" disabled={busy} onPress={() => sheet.current?.close()} /></View>
      <View style={{ flex: 7 }}><Action title={busy ? "Deleting..." : "Delete"} icon="trash" variant="danger" disabled={busy} onPress={onConfirm} /></View>
    </View>
  </BottomSheet>;
}
