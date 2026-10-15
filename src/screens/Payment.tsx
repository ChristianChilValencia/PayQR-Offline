import React, { useRef, useState } from "react";
import { Text, View, ScrollView, useWindowDimensions } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { captureRef, releaseCapture } from "react-native-view-shot";
import {
  money,
  pesosToCentavos,
  rewriteAmount,
  validateQR,
  MAX_PESOS,
} from "../domain/core";
import { RecordV1, Recipient } from "../domain/state";
import { savePNG, sharePNG } from "../services/platform";
import { Action, Input, styles as s } from "./common";
export type PaymentSnapshot = {
  payload: string;
  cents: number;
  recipient: string;
  status: string;
};
export function paymentSnapshot(
  recipient: Recipient,
  cents: number,
): PaymentSnapshot {
  const v = validateQR(recipient.payload),
    payload = rewriteAmount(recipient.payload, cents);
  return {
    payload,
    cents,
    recipient: v.recipient,
    status:
      payload !== recipient.payload
        ? "Amount-prefilled · unverified"
        : cents === 0
          ? "Original QR"
          : v.status,
  };
}
export function PaymentCard({
  snapshot,
  ready,
}: {
  snapshot: PaymentSnapshot;
  ready?: () => void;
}) {
  const size = Math.floor(
    Math.min(((useWindowDimensions().width - 88) * 21) / 29, 320),
  );
  return (
    <View style={[s.card, { alignItems: "center", borderRadius: 0 }]}>
      <Text style={s.subtitle}>BluePeso</Text>
      <Text style={[s.text, { textAlign: "center" }]}>
        {snapshot.recipient}
      </Text>
      <Text style={[s.title, { fontSize: 26 }]}>{money(snapshot.cents)}</Text>
      <QRCode
        value={snapshot.payload}
        size={size}
        quietZone={Math.ceil((size * 4) / 21)}
        color="#000000"
        backgroundColor="#ffffff"
        ecl="M"
        getRef={() => ready?.()}
      />
      <Text style={[s.text, { textAlign: "center" }]}>{snapshot.status}</Text>
      <Text style={[s.text, { textAlign: "center" }]}>
        Enter this amount in GCash.
      </Text>
    </View>
  );
}
export function Payment({
  record,
  update,
  importQR,
  busy,
  cancel,
  report,
}: {
  record: RecordV1;
  update: (r: RecordV1) => Promise<void>;
  importQR: () => void;
  busy: boolean;
  cancel: () => void;
  report: (m: string) => void;
}) {
  const [input, setInput] = useState(String(record.cents / 100));
  const valid = pesosToCentavos(input);
  const pending = valid !== null && valid !== record.cents;
  const [exporting, setExporting] = useState(false);
  const ref = useRef<View>(null);
  const rendered = useRef(false);
  const snapshot = record.recipient
    ? paymentSnapshot(record.recipient, record.cents)
    : null;
  const [frozen, setFrozen] = useState<PaymentSnapshot | null>(null);
  async function change(value: string) {
    setInput(value);
    const cents = pesosToCentavos(value);
    if (cents !== null)
      try {
        await update({ ...record, cents });
      } catch {
        report("Could not save amount. Retry your edit.");
      }
  }
  async function exportPNG(mode: "save" | "share") {
    if (!snapshot || !valid || pending || exporting) return;
    setFrozen({ ...snapshot });
    rendered.current = false;
    setExporting(true);
    let uri: string | undefined;
    try {
      // Wait for the frozen card's native layout and QR render to settle.
      await new Promise<void>((resolve, reject) => {
        let tries = 0;
        const poll = () => {
          if (rendered.current && ref.current) resolve();
          else if (++tries > 40)
            reject(new Error("Payment card is not ready. Retry."));
          else setTimeout(poll, 50);
        };
        poll();
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      uri = await captureRef(ref, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });
      if (mode === "save") await savePNG(uri);
      else await sharePNG(uri);
      report(
        mode === "save" ? "PNG saved to gallery." : "PNG sharing finished.",
      );
    } catch (e) {
      report(e instanceof Error ? e.message : "PNG export failed.");
    } finally {
      if (uri) releaseCapture(uri);
      setExporting(false);
      setFrozen(null);
    }
  }
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={s.body}
    >
      <Text style={s.title}>Payment QR</Text>
      <Text style={s.text}>
        Your recipient QR, with a clear amount beside it.
      </Text>
      <Action
        title={busy ? "Importing…" : "Import recipient QR"}
        onPress={importQR}
        disabled={busy || exporting}
      />
      {busy && <Action title="Cancel import" onPress={cancel} />}
      <View style={s.card}>
        <Text style={s.subtitle}>Requested amount</Text>
        <Input
          accessibilityLabel="Whole peso amount"
          value={input}
          onChangeText={(v) => {
            void change(v);
          }}
          keyboardType="number-pad"
          editable={!exporting}
        />
        {valid === null && (
          <Text style={s.error}>
            Use whole pesos: 0–999999999. No spaces, signs, decimals, commas or
            leading zeros. Last valid amount stays displayed.
          </Text>
        )}
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Action
              title="− ₱1"
              disabled={valid === null || valid === 0 || exporting}
              onPress={() => {
                void change(String(valid! / 100 - 1));
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Action
              title="+ ₱1"
              disabled={
                valid === null || valid === MAX_PESOS * 100 || exporting
              }
              onPress={() => {
                void change(String(valid! / 100 + 1));
              }}
            />
          </View>
        </View>
        {pending && (
          <Text style={s.text}>
            Amount is not yet saved. Retry your edit if saving failed.
          </Text>
        )}
        <Text style={s.text}>
          Technical input limit only; GCash limits may differ.
        </Text>
      </View>
      {snapshot ? (
        <>
          <View
            ref={ref}
            collapsable={false}
            onLayout={() => {
              rendered.current = true;
            }}
          >
            <PaymentCard
              snapshot={frozen ?? snapshot}
              ready={() => {
                rendered.current = true;
              }}
            />
          </View>
          {validateQR(record.recipient!.payload).existingAmount && (
            <Text style={s.error}>
              Original QR already contains amount{" "}
              {validateQR(record.recipient!.payload).existingAmount}. Confirm
              and enter the intended amount in GCash.
            </Text>
          )}
          <Text style={s.text}>
            Amount prefilling is gated pending a legitimate supported QR
            profile. Confirm the recipient and amount in GCash. This helper
            cannot confirm payment.
          </Text>
          <Action
            title={exporting ? "Exporting…" : "Share PNG"}
            disabled={
              valid === null || pending || record.cents === 0 || exporting
            }
            onPress={() => {
              void exportPNG("share");
            }}
          />
          <Action
            title="Save to Gallery"
            disabled={
              valid === null || pending || record.cents === 0 || exporting
            }
            onPress={() => {
              void exportPNG("save");
            }}
          />
        </>
      ) : (
        <View style={s.card}>
          <Text style={s.subtitle}>Add a recipient</Text>
          <Text style={s.text}>
            Import a legitimate recipient QR image. An invalid import keeps your
            previous QR.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
