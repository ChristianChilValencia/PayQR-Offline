import React, { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useApp } from "../../App";
import { mergeBackup } from "../domain/backup";
import { createBackupZip, openBackupZip } from "../services/backup-codec";
import { pickBackupZip, saveBackupZip } from "../services/backup-file";
import { useCopyFeedback } from "./useCopyFeedback";
import { Action, SectionTitle, styles as s } from "./common";

export function BackupSection() {
  const app = useApp();
  const [busy, setBusy] = useState(false);
  const { copied: exported, confirmCopy: confirmExport } = useCopyFeedback();
  const lock = useRef(false), focused = useRef(false), generation = useRef(0);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    setBusy(lock.current);
    return () => { focused.current = false; ++generation.current; };
  }, []));

  async function chooseImport() {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    const id = ++generation.current;
    try {
      const zip = await pickBackupZip();
      if (!zip) return;
      if (!focused.current || id !== generation.current) { zip.fill(0); return; }
      try {
        const restored = await openBackupZip(zip);
        if (!focused.current || id !== generation.current) return;
        // Validate completely before merging into the latest committed history.
        await app.patch((current) => mergeBackup(current, restored));
      } finally { zip.fill(0); }
    } catch (e) {
      if (focused.current && id === generation.current) app.report(e instanceof Error ? e.message : "Could not read the ZIP backup.");
    } finally { lock.current = false; if (focused.current) setBusy(false); }
  }
  async function exportZip() {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    const id = ++generation.current;
    try {
      const zip = await createBackupZip(app.record);
      try {
        if (!focused.current || id !== generation.current) return;
        await saveBackupZip(zip);
      } finally { zip.fill(0); }
      if (focused.current && id === generation.current)
        confirmExport();
    } catch (e) {
      if (focused.current && id === generation.current)
        app.report(e instanceof Error ? e.message : "Could not export the ZIP backup.");
    } finally { lock.current = false; if (focused.current) setBusy(false); }
  }

  return (
    <View style={s.card}>
      <SectionTitle icon="backup">Backup & restore</SectionTitle>
      <View style={s.row}>
        <View style={{ flex: 1 }}><Action title="Import ZIP" icon="upload" disabled={busy} onPress={() => { void chooseImport(); }} /></View>
        <View style={{ flex: 1 }}><Action title="Export ZIP" icon={exported ? "check" : "download"} variant="secondary" disabled={busy} onPress={() => { void exportZip(); }} /></View>
      </View>

    </View>
  );
}
