import React, { useRef, useState } from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useFocusEffect } from "expo-router";
import { BottomSheet, BottomSheetHandle } from "./BottomSheet";
import { useApp } from "../../App";
import { saveRecipient, deleteRecipient } from "../domain/import";
import { Recipient, SavedQR } from "../domain/state";
import { readPackageTarget } from "../domain/launcher";
import { copyAndOpen, copyNumber, openLink, pickQR } from "../services/platform";
import { DeleteSheet } from "./DeleteSheet";
import { Settings } from "./Settings";
import { exportPaymentCard } from "../services/payment-export";
import { paymentSnapshot } from "../domain/payment-card";
import { Payment, IconAction } from "./Payment";
import { Action, Input, SectionTitle, styles as s } from "./common";

import { SavedList, SavedRow } from "./SavedList";
import { AppIcon } from "./icons";
import { QRImportCamera } from "./QRImportCamera";
import { useFooterInset } from "./footerInset";
import { BackupSection } from "./BackupSection";

export function SettingsPage() {
  const app = useApp();
  const footerInset = useFooterInset();
  const labelSheet = useRef<BottomSheetHandle>(null);
  const exportSheet = useRef<BottomSheetHandle>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [importLabel, setImportLabel] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [editor, setEditor] = useState<{ kind: "qr" | "number"; id: string; value: string; editing: boolean } | null>(null);
  const [labelBusy, setLabelBusy] = useState(false);
  const labelLock = useRef(false);
  async function saveLabel() {
    if (!editor || labelLock.current) return;
    labelLock.current = true;
    setLabelBusy(true);
    try {
      await app.patch((r) => {
        const label = editor.value.trim() || undefined;
        if (editor.kind === "number") return { ...r, numbers: r.numbers?.map((n) => n.number === editor.id ? { ...n, label } : n) };
        const qrs = r.qrs?.map((q) => q.id === editor.id ? { ...q, label } : q);
        return { ...r, qrs, recipient: qrs?.find((q) => q.id === r.activeQR) ?? null };
      });
      labelSheet.current?.close();
    } catch (e) { fail(e); } finally { labelLock.current = false; setLabelBusy(false); }
  }
  const configured = !!app.record.link && (Platform.OS !== "android" || !!readPackageTarget(app.record.link));
  const [preview, setPreview] = useState<Recipient | null>(null);
  const staged = useRef<Recipient | null>(null);
  const generation = useRef(0);
  const focused = useRef(false);
  const saving = useRef(false);
  const lock = useRef(false);
  const [deletion, setDeletion] = useState<{ label: string; action: () => Promise<unknown> } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteLock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [exportQR, setExportQR] = useState<SavedQR | null>(null);
  const [exportMode, setExportMode] = useState<"save" | "share">("share");
  const [exporting, setExporting] = useState(false);
  const webExportLock = useRef(false);
  function startExport(q: SavedQR, mode: "save" | "share") {
    if (Platform.OS === "web") {
      if (webExportLock.current) return;
      webExportLock.current = true;
      setExporting(true);
      void exportPaymentCard(paymentSnapshot(q, app.record.cents), mode)
        .catch(fail)
        .finally(() => { webExportLock.current = false; setExporting(false); });
      return;
    }
    setExportMode(mode);
    setExportQR(q);
  }
  function fail(e: unknown) {
    app.report(e instanceof Error ? e.message : "Action failed. Retry.");
  }
  function reset() {
    ++generation.current;
    staged.current = null;
    setPreview(null);
  }
  useFocusEffect(
    React.useCallback(() => {
      focused.current = true;
      return () => {
        focused.current = false;
        setCameraOpen(false);
        ++generation.current;
        if (!saving.current) {
          staged.current = null;
          setPreview(null);
        }
      };
      // A payload-only draft is discarded when Settings loses focus.
    }, [setPreview]),
  );
  async function importQR() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    const id = ++generation.current;
    try {
      const next = await pickQR();
      if (!next) return;
      if (!focused.current || id !== generation.current) {
        return;
      }
      staged.current = next;
      setImportLabel("");
      setPreview(next);
    } catch (e) {
      fail(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function saveQR() {
    const draft = staged.current;
    if (!draft || lock.current) return;
    lock.current = true;
    saving.current = true;
    setBusy(true);
    try {
      await app.patch((r) => {
        const result = saveRecipient(r, { ...draft, label: importLabel.trim() || undefined });
        return result.record;
      });
      staged.current = null;
      setPreview(null);
    } catch (e) {
      fail(e);
      if (!focused.current) reset();
    } finally {
      lock.current = false;
      saving.current = false;
      setBusy(false);
    }
  }
  function run(action: () => Promise<unknown>) {
    void action().catch(fail);
  }
  function confirm(label: string, action: () => Promise<unknown>) {
    setDeletion({ label, action });
  }
  async function confirmDeletion() {
    if (!deletion || deleteLock.current) return;
    deleteLock.current = true;
    setDeleting(true);
    try {
      await deletion.action();
      setDeletion(null);
    } catch (e) {
      fail(e);
    } finally {
      deleteLock.current = false;
      setDeleting(false);
    }
  }

  async function deleteQR(q: SavedQR) {
    await app.patch((r) => {
      const result = deleteRecipient(r, q.id);
      return result.record;
    });
  }
  return (
    <View style={s.page}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[s.body, { paddingBottom: footerInset + 24 }]}
      >
        <View style={s.row}><AppIcon name="settings" size={32} /><Text style={s.title}>Settings</Text></View>
        <View style={s.card}>
          <SectionTitle>QR import</SectionTitle>
          <View style={s.row}><View style={{ flex: 1 }}><Action title="Capture QR" icon="camera" disabled={busy} onPress={() => setCameraOpen(true)} /></View><View style={{ flex: 1 }}><Action
            title="Import QR"
            icon="import"
            disabled={busy}
            onPress={() => run(importQR)}
          /></View></View>
          {preview && (
            <>
              <View
                style={{
                  alignSelf: "center",
                  padding: 8,
                  backgroundColor: "white",
                }}
              >
                <QRCode
                  value={preview.payload}
                  size={140}
                  quietZone={8}
                  ecl="M"
                />
              </View>
              {!!importLabel.trim() && <Text style={s.text}>{importLabel.trim()}</Text>}
              <Input accessibilityLabel="QR label (optional)" placeholder="Label (optional)" value={importLabel} onChangeText={setImportLabel} editable={!busy} />
              <Text style={s.text}>{preview.validation.recipient}</Text>
              <Text style={s.caption}>
                Unsaved preview · {preview.validation.status}
              </Text>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Action
                    title="Save"
                    icon="check"
                    disabled={busy}
                    onPress={() => run(saveQR)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Action
                    title="Reset"
                    icon="reset"
                    disabled={busy}
                    variant="secondary"
                    onPress={reset}
                  />
                </View>
              </View>
            </>
          )}
        </View>
        <View style={{ gap: 12 }}>
        <SectionTitle>Saved QRs</SectionTitle>
        {!(app.record.qrs ?? []).length && (
          <Text style={s.text}>No saved QRs.</Text>
        )}
        <SavedList items={app.record.qrs ?? []} render={(q) => (
          <SavedRow key={q.id} open={revealed === "qr:" + q.id} reveal={(open) => setRevealed(open ? "qr:" + q.id : null)} label={q.label} edit={() => setEditor({ kind: "qr", id: q.id, value: q.label ?? "", editing: !!q.label })} remove={() => confirm(q.validation.recipient, () => deleteQR(q))}>
            <View style={s.card}>
              <View style={s.row}>
                <View style={{ padding: 4, backgroundColor: "white" }}><QRCode value={q.payload} size={56} quietZone={4} ecl="M" /></View>
                <View style={{ flex: 1 }}><Text style={s.text}>{q.validation.recipient}</Text><Text style={s.caption}>{q.label || new Date(q.date).toLocaleDateString()}</Text></View>
                {q.id === app.record.activeQR && <Text style={s.badge}>Active</Text>}
              </View>
              <View style={s.row}>
                <View style={{ flex: 1 }}><Action icon="check" title={q.id === app.record.activeQR ? "Activated" : "Activate"} disabled={q.id === app.record.activeQR} onPress={() => run(() => app.patch((r) => ({ ...r, activeQR: q.id, recipient: q })))} /></View>
                <IconAction name="Download" icon="download" disabled={exporting} onPress={() => startExport(q, "save")} />
                <IconAction name="Share PNG" icon="share" disabled={exporting} onPress={() => startExport(q, "share")} />
              </View>
            </View>
          </SavedRow>
        )} />
        </View>
        <View style={{ gap: 12 }}>
          <SectionTitle icon="phone">Saved numbers</SectionTitle>
          <SavedList items={app.record.numbers ?? []} render={(n) => (
            <SavedRow key={n.number} open={revealed === "number:" + n.number} reveal={(open) => setRevealed(open ? "number:" + n.number : null)} label={n.label} edit={() => setEditor({ kind: "number", id: n.number, value: n.label ?? "", editing: !!n.label })} remove={() => confirm(n.number, () => app.patch((r) => ({ ...r, numbers: r.numbers?.filter((x) => x.number !== n.number) })))}>
              <View style={s.card}>
                <View style={s.row}><AppIcon name="number" size={36} /><View style={{ flex: 1 }}><Text style={s.text}>{n.number}</Text><Text style={s.caption}>{n.label || new Date(n.date).toLocaleDateString()}</Text></View></View>
                <View style={s.row}>
                  <View style={{ flex: 1 }}><Action icon="open" title="Copy & Open" disabled={!configured} onPress={() => run(() => copyAndOpen(n.number, app.record.link))} /></View>
                  <IconAction name="Copy" icon="copy" disabled={false} onPress={async () => { try { await copyNumber(n.number); } catch (e) { fail(e); throw e; } }} />
                </View>
              </View>
            </SavedRow>
          )} />
        </View>
        <Settings
          link={app.record.link}
          report={app.report}
          save={(link) =>
            app.patch((r) => {
              const id = readPackageTarget(link)?.packageName ?? link;
              return {
                ...r,
                link,
                activeApp: link ? id : null,
                apps: link
                  ? [
                      { id, link, date: new Date().toISOString() },
                      ...(r.apps ?? []).filter((a) => a.id !== id),
                    ]
                  : r.apps,
              };
            })
          }
        />
        <View style={{ gap: 12 }}>
        <SavedList items={app.record.apps ?? []} render={(a) => (
          <SavedRow key={a.id} open={revealed === "app:" + a.id} reveal={(open) => setRevealed(open ? "app:" + a.id : null)} remove={() => confirm(a.link, () => app.patch((r) => ({ ...r, apps: r.apps?.filter((x) => x.id !== a.id), ...(r.activeApp === a.id ? { activeApp: null, link: "" } : {}) })))}>
            <View style={s.card}>
              <View style={s.row}><Text style={[s.text, { flex: 1 }]}>{readPackageTarget(a.link)?.name || a.link}</Text>{a.id === app.record.activeApp && <Text style={s.badge}>Selected</Text>}</View>
              <Text style={s.caption}>{readPackageTarget(a.link)?.packageName || a.link}</Text>
              <View style={s.row}>
                <View style={{ flex: 1 }}><Action icon="check" title="Select" disabled={a.id === app.record.activeApp} onPress={() => run(() => app.patch((r) => ({ ...r, activeApp: a.id, link: a.link })))} /></View>
                <View style={{ flex: 1 }}><Action icon="open" title="Test" onPress={() => run(() => openLink(a.link))} /></View>
              </View>
            </View>
          </SavedRow>
        )} />
        </View>
        <BackupSection />
      </ScrollView>
      {cameraOpen && <QRImportCamera onClose={() => setCameraOpen(false)} onImport={(next) => {
        staged.current = next;
        setImportLabel("");
        setPreview(next);
        setCameraOpen(false);
      }} />}
      <BottomSheet ref={labelSheet} visible={!!editor} onClose={() => setEditor(null)} busy={labelBusy} icon="edit" title={editor?.editing ? "Edit Label" : "Add Label"}>
        <Input accessibilityLabel="Edit label" value={editor?.value ?? ""} editable={!labelBusy} onChangeText={(value) => setEditor((e) => e ? { ...e, value } : null)} placeholder="Label (optional)" />
        <View style={s.row}>
          <View style={{ flex: 3 }}><Action title="Cancel" variant="secondary" disabled={labelBusy} onPress={() => labelSheet.current?.close()} /></View>
          <View style={{ flex: 7 }}><Action title="Save" disabled={labelBusy} onPress={() => { void saveLabel(); }} /></View>
        </View>
      </BottomSheet>
      <DeleteSheet
        visible={!!deletion}
        label={deletion?.label ?? ""}
        busy={deleting}
        onCancel={() => { if (!deleteLock.current) setDeletion(null); }}
        onConfirm={() => { void confirmDeletion(); }}
      />
      {Platform.OS !== "web" && <BottomSheet ref={exportSheet} visible={!!exportQR} title="QR export" icon={exportMode === "save" ? "download" : "share"} tall busy={exporting} onClose={() => setExportQR(null)}>
          {exportQR && (
            <Payment
              key={exportQR.id}
              initialExport={exportMode}
              onExportingChange={setExporting}
              history
              record={{ ...app.record, recipient: exportQR }}
              update={async () => {}}
              importQR={() => {}}
              busy={false}
              cancel={() => {}}
              report={app.report}
            />
          )}
          <Action
            disabled={exporting}
            title="Close"
            icon="close"
            onPress={() => exportSheet.current?.close()}
          />
      </BottomSheet>}
    </View>
  );
}
