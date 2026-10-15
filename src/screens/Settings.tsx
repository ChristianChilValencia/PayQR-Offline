import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { validateLink } from "../domain/core";
import { openLink } from "../services/platform";
import { Action, Input, styles as s } from "./common";
export function Settings({
  link,
  save,
  report,
}: {
  link: string;
  save: (l: string) => Promise<void>;
  report: (m: string) => void;
}) {
  const [draft, setDraft] = useState(link),
    [busy, setBusy] = useState(false);
  const valid = validateLink(draft);
  async function action(test: boolean) {
    setBusy(true);
    try {
      if (test && valid) await openLink(valid);
      else {
        await save(draft);
        report("Launch link saved.");
      }
    } catch (e) {
      report(e instanceof Error ? e.message : "Link action failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={s.body}
    >
      <Text style={s.title}>Settings</Text>
      <View style={s.card}>
        <Text style={s.subtitle}>Configured launch link</Text>
        <Input
          accessibilityLabel="Launch link"
          value={draft}
          onChangeText={setDraft}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="HTTPS or custom-scheme link"
        />
        {!!draft && !valid && (
          <Text style={s.error}>
            Use a valid HTTPS or custom-scheme URL without credentials, spaces
            or local/executable schemes.
          </Text>
        )}
        <Text style={s.text}>
          HTTPS may open a browser. Valid syntax does not verify the app
          destination. Test a link you trust. The phone number is never inserted
          into it.
        </Text>
        <Action
          title="Save link"
          disabled={busy || (!!draft && !valid)}
          onPress={() => {
            void action(false);
          }}
        />
        <Action
          title="Test Link"
          disabled={busy || !valid}
          onPress={() => {
            void action(true);
          }}
        />
        <Action
          title="Clear link"
          disabled={busy}
          onPress={() => {
            setDraft("");
            void save("").catch(() => report("Could not clear saved link."));
          }}
        />
      </View>
      <View style={s.card}>
        <Text style={s.subtitle}>Local helper, clear limits</Text>
        <Text style={s.text}>
          QR rendering, stored recipient data and number recognition work
          locally. No backend, analytics, cloud OCR or payment submission.
        </Text>
        <Text style={s.text}>
          Expo Go needs a reachable development server for preview. GCash has
          its own connectivity requirements. Image OCR needs a future
          development build. Installed-app selection is deferred.
        </Text>
        <Text style={s.text}>
          BluePeso does not paste automatically, transfer money or confirm
          payments. Recipient and amount acceptance still need a real GCash
          scan.
        </Text>
      </View>
    </ScrollView>
  );
}
