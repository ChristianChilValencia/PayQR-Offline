import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform, Text, View } from "react-native";
import { create } from "qrcode";
import QRCode from "react-native-qrcode-svg";
import { captureRef, releaseCapture } from "react-native-view-shot";
import {
  money,
  displayAmount,
  pesosToCentavos,
  MAX_PESOS,
} from "../domain/core";
import { RecordV1 } from "../domain/state";
import { exportPaymentCard } from "../services/payment-export";
import { savePNG, sharePNG } from "../services/platform";
import { AppIcon, IconName } from "./icons";
import { useCopyFeedback } from "./useCopyFeedback";
import { useFooterInset } from "./footerInset";
import { FeedbackPressable as Pressable, Action, Input, styles as s } from "./common";
import { paymentCardFrame, paymentSnapshot, PaymentSnapshot } from "../domain/payment-card";
export { paymentSnapshot, PaymentSnapshot } from "../domain/payment-card";

export function PaymentCard({
  snapshot,
  ready,
  maxHeight = 460,
  hideZeroAmount = false,
}: {
  snapshot: PaymentSnapshot;
  ready?: () => void;
  maxHeight?: number;
  hideZeroAmount?: boolean;
}) {
  const [width, setWidth] = useState(240);
  const modules = useMemo(
    () => create(snapshot.payload, { errorCorrectionLevel: "M" }).modules.size,
    [snapshot.payload],
  );
  const frame = paymentCardFrame({ width, height: maxHeight }, snapshot.label ?? false, !hideZeroAmount || snapshot.cents !== 0);
  const size = frame.qrSize;
  return (
    <View style={{ flex: 1, minHeight: 0, backgroundColor: "white" }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[s.subtitle, { position: "absolute", top: frame.titleTop, width: "100%", height: 30, textAlign: "center", fontSize: 26, lineHeight: 30 }]}>{snapshot.recipient}</Text>
      {(!hideZeroAmount || snapshot.cents !== 0) && <Text numberOfLines={1} adjustsFontSizeToFit style={[s.title, { position: "absolute", top: frame.amountTop, width: "100%", height: 32, textAlign: "center", fontSize: 28, lineHeight: 32 }]}>{money(snapshot.cents)}</Text>}
      <View style={{ position: "absolute", top: frame.qrTop, left: (width - size) / 2, width: size, height: size }}>
        <QRCode value={snapshot.payload} size={size} quietZone={Math.ceil((size * 4) / modules)} color="#000000" backgroundColor="#ffffff" ecl="M" getRef={() => ready?.()} />
      </View>
      {!!snapshot.label && <View style={{ position: "absolute", top: frame.labelTop, width: "100%", height: frame.labelHeight, justifyContent: "center" }}><Text numberOfLines={2} adjustsFontSizeToFit style={[s.text, { fontSize: 20, textAlign: "center" }]}>{snapshot.label}</Text></View>}
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
  children,
  history = false,
  initialExport,
  onExportingChange,
}: {
  children?: React.ReactNode;
  history?: boolean;
  initialExport?: "save" | "share";
  onExportingChange?: (busy: boolean) => void;
  record: RecordV1;
  update: (r: RecordV1) => Promise<void>;
  importQR: () => void;
  busy: boolean;
  cancel: () => void;
  report: (m: string) => void;
}) {
  const [canvasSize, setCanvasSize] = useState({ width: 320, height: 460 });
  const footerInset = useFooterInset();
  const [input, setInput] = useState(displayAmount(record.cents));
  const valid = pesosToCentavos(input === "" || input === "." ? "0" : input.endsWith(".") ? input.slice(0, -1) : input.startsWith(".") ? "0" + input : input);
  const [exporting, setExporting] = useState(false);
  const exportLock = useRef(false);
  const ref = useRef<View>(null);
  const rendered = useRef(false);
  const lastValid = useRef(record.cents);
  const [previewCents, setPreviewCents] = useState(record.cents);
  const snapshot = record.recipient
    ? paymentSnapshot(record.recipient, valid ?? previewCents)
    : null;
  const [frozen, setFrozen] = useState<PaymentSnapshot | null>(null);
  const editVersion = useRef(0);
  function change(value: string) {
    if (exporting) return;
    if (input === "0" && /^0\d+$/.test(value))
      value = value.replace(/^0+(?=\d)/, "");
    if (!/^\d{0,9}(?:\.\d{0,2})?$/.test(value)) return;
    if (value === "") value = "0";
    if (value.startsWith(".")) value = "0" + value;
    const cents = pesosToCentavos(value.endsWith(".") ? value.slice(0, -1) : value);
    if (cents === null && value !== "" && !/^(0|[1-9]\d{0,8})\.$/.test(value))
      return;
    setInput(value);
    if (cents === null) return;
    lastValid.current = cents;
    setPreviewCents(cents);
    const version = ++editVersion.current;
    void update({ ...record, cents })
      .catch(() => {
        if (version === editVersion.current)
          report("Could not save amount. Edit it again to retry.");
      });
  }
  async function exportPNG(mode: "save" | "share") {
    if (!snapshot || valid === null || exportLock.current) return;
    exportLock.current = true;
    setFrozen({ ...snapshot });
    rendered.current = false;
    setExporting(true);
    onExportingChange?.(true);
    let uri: string | undefined;
    try {
      if (Platform.OS === "web") { await exportPaymentCard({ ...snapshot }, mode, canvasSize); return; }
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
      exportLock.current = false;
      setExporting(false);
      onExportingChange?.(false);
      setFrozen(null);
    }
  }
  useEffect(() => {
    const timer = setTimeout(() => {
      if (initialExport) void exportPNG(initialExport);
    }, 0);
    return () => clearTimeout(timer);
    // A history export is a snapshot taken when this card mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={[s.page, !history && { paddingBottom: footerInset }]}>
      <View style={[s.body, { flex: 1, minHeight: 0, paddingVertical: 12, paddingHorizontal: 14, gap: 12 }]} >
        <View style={[s.card, { flex: 1, minHeight: 0, paddingHorizontal: 8, paddingVertical: 12, gap: 24 }]}>
          {busy && <Action title="Cancel import" variant="secondary" onPress={cancel} />}
          {snapshot ? (
            <>
              <View
                ref={ref}
                style={{ flex: 1, minHeight: 0 }}
                collapsable={false}
                onLayout={(event) => {
                  const { width, height } = event.nativeEvent.layout;
                  if (width > 0 && height > 0) setCanvasSize({ width, height });
                  rendered.current = true;
                }}
              >
                <PaymentCard
                  maxHeight={canvasSize.height}
                  snapshot={frozen ?? snapshot}
                  hideZeroAmount={!!frozen}
                  ready={() => {
                    rendered.current = true;
                  }}
                />
              </View>
            </>
          ) : (
            <View style={[s.empty, { flexGrow: 1, justifyContent: "center" }]}>
              <AppIcon name="qr" size={48} color="#075cce" />
              <Text style={s.subtitle}>No active QR</Text>
              <Text style={[s.text, { textAlign: "center" }]}>
                Import or select your recipient’s payment QR to create a clear,
                shareable payment card.
              </Text>
            </View>
          )}
          <View style={s.row}>
            {!snapshot ? <View style={{ flex: 1 }}><Action title="Open Settings" icon="settings" disabled={busy || exporting} onPress={importQR} /></View> : <>
              <View style={{ flex: 1 }}><IconAction name="Share PNG" icon="share" expanded disabled={valid === null || exporting} onPress={() => { void exportPNG("share"); }} /></View>
              <IconAction name="Download" icon="download" disabled={valid === null || exporting} onPress={() => { void exportPNG("save"); }} />
            </>}
          </View>
        </View>
        {children}
      </View>
      {!history && (
        <View style={[s.dock, { backgroundColor: "transparent", borderTopWidth: 0 }]}>
          <View style={s.row}>
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                borderWidth: 1,
                borderColor: "#9bb1cd",
                borderRadius: 12,
                paddingLeft: 10,
                backgroundColor: "white",
              }}
            >
              <Text style={s.text}>{"\u20b1"}</Text>
              <Input
                accessibilityLabel="Peso amount"
                clearable={valid !== 0}
                clearLabel="Clear amount"
                onClear={() => change("0")}
                value={input}
                onChangeText={change}
                keyboardType="decimal-pad"
                editable={!exporting}
                selectTextOnFocus
                maxLength={12}
                style={{
                  flex: 1,
                  minWidth: 0,
                  paddingHorizontal: 0,
                  borderWidth: 0,
                  fontSize: 22,
                  backgroundColor: "transparent",
                }}
              />
            </View>
            {[-1, 1].map((step) => (
              <StepButton
                key={step}
                step={step}
                disabled={
                  valid === null ||
                  valid + step * 100 < 0 ||
                  valid + step * 100 > MAX_PESOS * 100 ||
                  exporting
                }
                adjust={() => {
                  const next = lastValid.current + step * 100;
                  if (next < 0 || next > MAX_PESOS * 100) return false;
                  change(displayAmount(next));
                  return (
                    next + step * 100 >= 0 &&
                    next + step * 100 <= MAX_PESOS * 100
                  );
                }}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

export function IconAction({
  name,
  icon,
  disabled,
  onPress,
  expanded = false,
}: {
  expanded?: boolean;
  name: string;
  icon: IconName;
  disabled: boolean;
  onPress: () => void | Promise<void>;
}) {
  const [tip, setTip] = useState(false);
  const held = useRef(false);
  const { copied, confirmCopy } = useCopyFeedback();
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={name}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPressIn={() => {
          held.current = false;
        }}
        onLongPress={() => {
          held.current = true;
          setTip(true);
        }}
        onPressOut={() => setTip(false)}
        onPress={() => {
          if (!held.current) {
            if (icon === "copy") void Promise.resolve().then(onPress).then(confirmCopy).catch(() => {});
            else void onPress();
          }
        }}
        style={[s.button, { width: expanded ? "100%" : 48, flexDirection: "row", gap: 8 }, disabled && { opacity: 0.4 }]}
      >
        <AppIcon name={icon === "copy" && copied ? "check" : icon} color="white" size={23} />
        {expanded && <Text style={s.buttonText}>{icon === "share" ? "Share" : name}</Text>}
      </Pressable>
      {tip && (
        <Text
          style={[
            s.caption,
            {
              position: "absolute",
              bottom: 52,
              right: 0,
              width: 120,
              padding: 6,
              backgroundColor: "#edf3fb",
              borderRadius: 10,
              overflow: "hidden",
              textAlign: "center",
            },
          ]}
        >
          {name}
        </Text>
      )}
    </View>
  );
}
export function StepButton({
  step,
  disabled,
  adjust,
}: {
  step: number;
  disabled: boolean;
  adjust: () => boolean;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(adjust);
  latest.current = adjust;
  const held = useRef(false);
  function stop() {
    clearTimeout(timer.current);
    timer.current = undefined;
  }
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        held.current = true;
        stop();
      }
    });
    return () => {
      stop();
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    if (disabled) stop();
  }, [disabled]);
  function repeat() {
    held.current = true;
    if (latest.current()) timer.current = setTimeout(repeat, 150);
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        step > 0 ? "Increase amount by one peso" : "Decrease amount by one peso"
      }
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPressIn={() => {
        stop();
        held.current = false;
        timer.current = setTimeout(repeat, 400);
      }}
      onPressOut={stop}
      onTouchCancel={() => {
        held.current = true;
        stop();
      }}
      onPress={() => {
        if (!held.current) latest.current();
      }}
      style={[
        s.button,
        { width: 48, backgroundColor: "transparent", borderWidth: 1, borderColor: "#9bb1cd" },
        disabled && { opacity: 0.4 },
      ]}
    >
      <AppIcon name={step > 0 ? "plus" : "minus"} color="#1955a6" size={24} />
    </Pressable>
  );
}
