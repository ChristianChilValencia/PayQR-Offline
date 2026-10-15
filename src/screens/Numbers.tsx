import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { findPhones, normalizePhone } from "../domain/core";
import { copyNumber, copyAndOpen, openLink } from "../services/platform";
import { Action, Input, styles as s } from "./common";
export function Numbers({
  link,
  report,
}: {
  link: string;
  report: (m: string) => void;
}) {
  const [text, setText] = useState(""),
    [number, setNumber] = useState(""),
    [busy, setBusy] = useState(false);
  const candidates = findPhones(text),
    normalized = normalizePhone(number);
  async function act(mode: "copy" | "open" | "both") {
    if (!normalized || busy) return;
    setBusy(true);
    try {
      if (mode === "copy") await copyNumber(normalized);
      if (mode === "open") await openLink(link);
      if (mode === "both") await copyAndOpen(normalized, link);
      report(
        mode === "copy"
          ? "Number copied."
          : "Launch link opened. Paste the number yourself and verify the recipient.",
      );
    } catch (e) {
      report(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScrollView
      contentContainerStyle={s.body}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={s.title}>Scan Number</Text>
      <Text style={s.text}>
        Recognize numbers from pasted text or type a number.
      </Text>
      <View style={s.card}>
        <Input
          accessibilityLabel="Text to recognize"
          value={text}
          onChangeText={(v) => {
            setText(v);
            setNumber("");
          }}
          placeholder="Paste text containing a mobile number"
          multiline
        />
        <Text style={s.text}>
          {candidates.length > 1
            ? "Select a number, then correct it below."
            : candidates.length === 1
              ? "Select the recognized number."
              : "No number found in pasted text."}
        </Text>
        {candidates.map((n) => (
          <Action key={n} title={n} onPress={() => setNumber(n)} />
        ))}
        <Input
          accessibilityLabel="Selected or manual number"
          value={number}
          onChangeText={setNumber}
          placeholder="09xxxxxxxxx or +639xxxxxxxxx"
          keyboardType="phone-pad"
        />
        {!!number && !normalized && (
          <Text style={s.error}>
            Enter an eleven-digit 09 number or +639 number. Spaces and hyphens
            are allowed.
          </Text>
        )}
        {normalized && <Text style={s.text}>Ready: {normalized}</Text>}
        <Action
          title="Copy number"
          disabled={!normalized || busy}
          onPress={() => {
            void act("copy");
          }}
        />
        <Action
          title="Open App"
          disabled={!normalized || !link || busy}
          onPress={() => {
            void act("open");
          }}
        />
        <Action
          title="Copy & Open App"
          disabled={!normalized || !link || busy}
          onPress={() => {
            void act("both");
          }}
        />
        {!link && (
          <Text style={s.text}>
            Configure a launch link in Settings to enable app opening.
          </Text>
        )}
      </View>
      <View style={s.card}>
        <Action title="Camera OCR — unavailable" disabled onPress={() => {}} />
        <Action title="Gallery OCR — unavailable" disabled onPress={() => {}} />
        <Text style={s.text}>
          Image-based offline OCR requires a future development build.
        </Text>
        <Text style={s.text}>
          Expo Go’s QR scanner does not recognize printed phone numbers.
        </Text>
      </View>
    </ScrollView>
  );
}
