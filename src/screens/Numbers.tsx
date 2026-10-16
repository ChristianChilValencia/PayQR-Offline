import React, { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { SavedNumber } from "../domain/state";
import { Settings, SettingsHandle } from "./Settings";
import { readPackageTarget } from "../domain/launcher";
import { editPhone, normalizePhone } from "../domain/core";
import { copyNumber, copyAndOpen, openLink } from "../services/platform";
import { FeedbackPressable as Pressable, Action, Input, styles as s } from "./common";
import { useCopyFeedback } from "./useCopyFeedback";
import { useFooterInset } from "./footerInset";
const EMPTY_SAVED_ENTRIES: SavedNumber[] = [];
export function Numbers({
  docked = true,
  link,
  report,
  candidates = [],
  savedNumbers = [],
  savedEntries = EMPTY_SAVED_ENTRIES,
  saveApp,
  save,
  selected,
  selectionKey,
  onScan = () => router.push("/scan"),
}: {
  docked?: boolean;
  candidates?: string[];
  savedNumbers?: string[];
  savedEntries?: SavedNumber[];
  saveApp?: (link: string) => Promise<void>;
  selected?: string;
  selectionKey?: string;
  save?: (number: string, label?: string) => Promise<void>;
  onScan?: () => void;
  link: string;
  report: (m: string) => void;
}) {
  const appChooser = useRef<SettingsHandle>(null);
  const footerInset = useFooterInset();
  const actionLock = useRef(false);
  const { copied, confirmCopy } = useCopyFeedback();
  const [number, setNumber] = useState(normalizePhone(selected ?? "") ?? ""),
    [busy, setBusy] = useState(false);
  const [previousSelected, setPreviousSelected] = useState(
    selectionKey ?? selected,
  );
  if ((selectionKey ?? selected) !== previousSelected) {
    setPreviousSelected(selectionKey ?? selected);
    if (selected) setNumber(normalizePhone(selected) ?? "");
  }
  const [label, setLabel] = useState("");
  const [justSaved, setJustSaved] = useState<string | null>(null);
  const [recentlySaved, setRecentlySaved] = useState<SavedNumber[]>([]);
  const [previousSavedEntries, setPreviousSavedEntries] = useState(savedEntries);
  if (previousSavedEntries !== savedEntries) {
    setPreviousSavedEntries(savedEntries);
    if (recentlySaved.some(n => savedEntries.some(saved => normalizePhone(saved.number) === n.number))) {
      setRecentlySaved(entries => entries.filter(n => !savedEntries.some(saved => normalizePhone(saved.number) === n.number)));
    }
  }
  const normalized = normalizePhone(number);
  const savedNow = !!normalized && justSaved === normalized;
  const savedEntry = [...savedEntries, ...recentlySaved].find(n => normalizePhone(n.number) === normalized && !!normalized);
  const alreadySaved = !!normalized && (savedNumbers.some(n => normalizePhone(n) === normalized) || !!savedEntry);
  const displayedLabel = alreadySaved ? savedEntry?.label ?? (savedNow ? label : "") : label;
  function change(value: string) {
    const next = editPhone(value);
    if (next !== null) { if (next !== number) { setJustSaved(null); setLabel(""); } setNumber(next); }

  }

  const configured =
    !!link && (Platform.OS !== "android" || !!readPackageTarget(link));
  async function act(mode: "copy" | "open" | "both") {
    if (busy || actionLock.current) return;
    if (mode === "both" && !configured) { appChooser.current?.choose(); return; }
    if (!normalized) return;
    actionLock.current = true;
    if (mode !== "copy") setBusy(true);
    try {
      if (mode === "copy") await copyNumber(normalized);
      if (mode === "open") await openLink(link);
      if (mode === "both") await copyAndOpen(normalized, link);
      if (mode === "copy" || mode === "both") confirmCopy();
      if (mode !== "copy") report("App opened. Paste the number yourself and verify the recipient.");
    } catch (e) {
      report(e instanceof Error ? e.message : "Action failed.");
    } finally {
      actionLock.current = false;
      if (mode !== "copy") setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView
      enabled={docked}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={docked ? [s.page, { paddingBottom: footerInset }] : { gap: 12 }}
    >
      <ScrollView keyboardShouldPersistTaps="handled" scrollEnabled={docked} style={docked ? { flex: 1 } : { flexGrow: 0 }} contentContainerStyle={docked ? [s.body, { flexGrow: 1, padding: 12, gap: 10 }] : { gap: 12 }}>
        <View style={[s.card, docked && { flexGrow: 1, justifyContent: "flex-end" }]}>
          {candidates.map((n) => (
            <Action
              key={n}
              title={(normalized === n ? "Selected: " : "") + n}
              onPress={() => change(n)}
            />
          ))}
          <View style={[s.row, { borderWidth: 1, borderColor: "#9bb1cd", borderRadius: 12 }]}>
            <Input
              accessibilityLabel="Selected or manual number"
              clearLabel="Clear number"
              value={number}
              onChangeText={change}
              onBlur={() => { if (["+", "+6", "+63"].includes(number)) change("09"); }}
              placeholder="09xxxxxxxxx or +639xxxxxxxxx"
              autoCorrect={false}
              style={{ flex: 1, borderWidth: 0, minWidth: 0 }}
              keyboardType="phone-pad"
              showSoftInputOnFocus={false}
            />

          </View>
          <Input accessibilityLabel="Number label (optional)" accessibilityState={{ disabled: alreadySaved || savedNow || busy }} placeholder="Label (optional)" value={displayedLabel} onChangeText={setLabel} editable={!alreadySaved && !savedNow && !busy} style={(alreadySaved || savedNow) ? { backgroundColor: "#EBEBEC", color: "#63748c" } : undefined} />
          <View style={s.row}>
            <View style={{ flex: 1 }}>
          <Action
            icon={alreadySaved || savedNow ? "check" : "save"}
            title={savedNow ? "Saved" : alreadySaved ? "Already Saved" : "Save Number"}
            disabled={!normalized || busy || !save || alreadySaved || savedNow}
            onPress={() => {
              if (!normalized || !save || alreadySaved || savedNow || busy) return;
              setBusy(true);
              void save(normalized, label.trim() || undefined)
                .then(() => {
                  setRecentlySaved(entries => [{ number: normalized, label: label.trim() || undefined, source: "manual", date: new Date().toISOString() }, ...entries.filter(n => n.number !== normalized)]);
                  setJustSaved(normalized); setLabel(label.trim()); report("Number saved.");
                })
                .catch(() => report("Could not save number. Retry."))
                .finally(() => setBusy(false));
            }}
          />
            </View>
            <View style={{ flex: 1 }}>
          <Action
            icon={copied ? "check" : "copy"}
            title="Copy Number"
            disabled={!normalized || busy}
            onPress={() => {
              void act("copy");
            }}
          />
            </View>
          </View>
          <View style={{ flex: 1, minHeight: 208, gap: 6 }}>
            {[["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["Clear", "0", "Backspace"]].map((row, i) => (
              <View key={i} style={[s.row, { flex: 1 }]}>
                {row.map((key) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={key} disabled={busy} onPress={() => { if (key === "Clear") change(""); else if (key === "Backspace") change(number.slice(0, -1)); else if (number.length < 11) change(number + key); }} style={{ flex: 1, height: "100%", minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#edf3fb" }}><Text style={[s.subtitle, { fontSize: key.length > 1 ? 14 : 28 }]}>{key === "Backspace" ? "\u232b" : key}</Text></Pressable>)}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      <View testID="number-actions" style={docked ? [s.dock, { backgroundColor: "transparent", borderTopWidth: 0 }] : { gap: 10 }}>
        <View style={s.row}>
          <View style={{ width: 104 }}>
            <Action
              title="Scan"
              icon="camera"
              variant="outline"
              onPress={onScan}
              disabled={busy}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Action
              title="Copy & Open App"
              variant="primary"
              icon="open"
              disabled={busy || (configured && !normalized)}
              onPress={() => {
                void act("both");
              }}
            />
          </View>
        </View>
      </View>
      <Settings ref={appChooser} compact link={link} report={report} save={async target => {
        if (!saveApp) { report("Choose your payment app in Settings."); return; }
        await saveApp(target);
        if (normalized) {
          try { await copyAndOpen(normalized, target); report("App opened. Paste the copied number and verify the recipient."); }
          catch (error) { report(error instanceof Error ? error.message : "Could not open the selected app."); }
        }
      }} />
    </KeyboardAvoidingView>
  );
}
