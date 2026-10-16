import React, { useImperativeHandle, useRef, useState } from "react";
import {
  ActivityIndicator,
  SectionList,
  Image,
  Platform,
  Text,
  View,
} from "react-native";
import { BottomSheet, BottomSheetHandle } from "./BottomSheet";
import { validateLink } from "../domain/core";
import { readPackageTarget, groupApps } from "../domain/launcher";
import {
  availableApps,
  nativeAppPickerAvailable,
  LaunchApp,
} from "../services/launcher";
import { openLink } from "../services/platform";
import { FeedbackPressable as Pressable, Action, Input, SectionTitle, styles as s } from "./common";

export type SettingsHandle = { choose: () => void };

export function Settings({
  link,
  compact = false,
  ref,
  save,
  report,
}: {
  compact?: boolean;
  ref?: React.Ref<SettingsHandle>;
  link: string;
  save: (target: string) => Promise<void>;
  report: (message: string) => void;
}) {
  const sheet = useRef<BottomSheetHandle>(null);
  const [draft, setDraft] = useState(readPackageTarget(link) ? "" : link);
  const [busy, setBusy] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [apps, setApps] = useState<LaunchApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [custom, setCustom] = useState(false);
  const valid = validateLink(draft);
  const nativePicker = nativeAppPickerAvailable();
  const android = Platform.OS === "android";
  const needsReselection = android && !!link && !readPackageTarget(link);
  const selected =
    readPackageTarget(link)?.name || (link === "gcash://" ? "GCash" : link);
  function dismiss() { if (!busy) setShowPicker(false); }
  async function choose() {
    setCustom(false);
    setQuery("");
    setError("");
    setApps([]);
    setShowPicker(true);
    setLoading(true);
    try {
      setApps(await availableApps());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load apps.");
    } finally {
      setLoading(false);
    }
  }
  useImperativeHandle(ref, () => ({ choose: () => { void choose(); } }));
  async function select(app: LaunchApp) {
    setBusy(true);
    try {
      await save(app.target);
      sheet.current?.close();
      setDraft(readPackageTarget(app.target) ? "" : app.target);
    } catch {
      report("Could not save your app selection. Try again.");
    } finally {
      setBusy(false);
    }
  }
  async function act(mode: "test" | "save" | "reset") {
    setBusy(true);
    try {
      if (mode === "test") await openLink(link);
      else {
        await save(mode === "reset" ? "" : draft);
        if (mode === "reset") setDraft("");
      }
    } catch (e) {
      report(e instanceof Error ? e.message : "App action failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 12 }}>
      {!compact && <>
      <SectionTitle icon="open">Payment app launcher</SectionTitle>
      <View style={s.card}>
        <Text style={s.subtitle}>{selected || "Choose your payment app"}</Text>
        {readPackageTarget(link) && !nativePicker && (
          <Text style={s.text}>
            This saved app needs an Android build. Install the Android
            development build to use it.
          </Text>
        )}
        {needsReselection && (
          <Text style={s.text}>
            Choose an installed app again. Your saved QR and amount are
            retained.
          </Text>
        )}
        <Action
          icon="phone"
          title="Choose app"
          disabled={busy || loading}
          onPress={() => {
            void choose();
          }}
        />
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Action
              icon="open"
              title="Test App"
              disabled={busy || !link || needsReselection}
              onPress={() => {
                void act("test");
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Action
              icon="reset"
              title="Reset"
              variant="secondary"
              disabled={busy || !link}
              onPress={() => {
                void act("reset");
              }}
            />
          </View>
        </View>
      </View>
      </>}
      <BottomSheet ref={sheet} visible={showPicker} onClose={dismiss} busy={busy} title="Choose app" icon="phone" tall backdropLabel="Dismiss app chooser">
              {custom ? (
                <>
                  <Input
                    accessibilityLabel="Launch link"
                    value={draft}
                    onChangeText={setDraft}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="gcash:// or https://?"
                  />
                  {!!draft && !valid && (
                    <Text style={s.error}>
                      Enter a valid HTTPS or app link.
                    </Text>
                  )}
                  <Action
                    title="Save"
                    icon="check"
                    disabled={busy || !valid || draft.startsWith("payqr-app:")}
                    onPress={() => {
                      setBusy(true);
                      void save(draft)
                        .then(() => {
                          sheet.current?.close();
                        })
                        .catch(() => report("Could not save link. Retry."))
                        .finally(() => setBusy(false));
                    }}
                  />
                  <Action
                    title="Back"
                    icon="back"
                    disabled={busy}
                    onPress={() => setCustom(false)}
                  />
                </>
              ) : (
                <>
                  {Platform.OS !== "android" && (
                    <Text style={s.text}>
                      Choose from supported app links. For another app, use its
                      custom link.
                    </Text>
                  )}
                  <Input
                    accessibilityLabel="Search installed apps"
                    placeholder="Search apps"
                    value={query}
                    onChangeText={setQuery}
                    autoCorrect={false}
                  />
                  {loading && (
                    <ActivityIndicator accessibilityLabel="Loading installed apps" />
                  )}
                  {!!error && (
                    <>
                      <Text style={s.error}>{error}</Text>
                      <Action
                        title="Retry"
                        onPress={() => {
                          void choose();
                        }}
                      />
                    </>
                  )}
                  <SectionList
                    sections={groupApps(apps, query).filter(
                      (section) => section.data.length,
                    )}
                    renderSectionHeader={({ section }) =>
                      section.data.length ? (
                        <Text style={[s.subtitle, { paddingVertical: 12 }]}>
                          {section.title}
                        </Text>
                      ) : null
                    }
                    keyExtractor={(app) => app.target}
                    keyboardShouldPersistTaps="handled"
                    ListEmptyComponent={
                      !loading && !error ? (
                        <Text style={s.text}>
                          No installed apps match your search.
                        </Text>
                      ) : null
                    }
                    renderItem={({ item }) => (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={"Choose " + item.name}
                        accessibilityState={{ disabled: busy }}
                        disabled={busy}
                        onPress={() => {
                          void select(item);
                        }}
                        style={[
                          s.row,
                          {
                            padding: 14,
                            backgroundColor: "white",
                            borderRadius: 12,
                            marginBottom: 8,
                          },
                        ]}
                      >
                        {item.icon && (
                          <Image
                            source={{ uri: item.icon }}
                            style={{ width: 40, height: 40 }}
                          />
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={s.text}>{item.name}</Text>
                          <Text style={s.caption}>
                            {readPackageTarget(item.target)?.packageName}
                          </Text>
                        </View>
                        {(readPackageTarget(link)?.packageName
                          ? readPackageTarget(link)?.packageName ===
                            readPackageTarget(item.target)?.packageName
                          : link === item.target) && (
                          <Text style={s.badge}>Selected</Text>
                        )}
                      </Pressable>
                    )}
                  />
                </>
              )}
              <View style={s.row}>
                <View style={{ flex: 3 }}>
                  <Action
                    title="Cancel" variant="secondary"
                    icon="close"
                    disabled={busy}
                    onPress={() => sheet.current?.close()}
                  />
                </View>
                <View style={{ flex: 7 }}>
                  <Action
                    title="Use custom link"
                    icon="link"
                    disabled={busy || android}
                    onPress={() => setCustom(true)}
                  />
                </View>
              </View>
      </BottomSheet>
    </View>
  );
}
