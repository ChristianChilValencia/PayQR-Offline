import QR from "qrcode";
import { money } from "../domain/core";
import { paymentCardFrame, PaymentCardSize, PaymentSnapshot } from "../domain/payment-card";

/** Render directly from a frozen snapshot, without a preview modal or DOM capture. */
export async function paymentCardBlob(snapshot: PaymentSnapshot, size: PaymentCardSize = { width: 360, height: 500 }): Promise<Blob> {
  await document.fonts?.ready;
  const frame = paymentCardFrame(size, snapshot.label ?? false, snapshot.cents !== 0);
  const factor = 1024 / size.width;
  const qr = document.createElement("canvas");
  const modules = QR.create(snapshot.payload, { errorCorrectionLevel: "M" }).modules.size;
  const scale = Math.max(1, Math.ceil(frame.qrSize * factor / (modules + 8)));
  await QR.toCanvas(qr, snapshot.payload, { errorCorrectionLevel: "M", margin: 4, scale, color: { dark: "#000000", light: "#ffffff" } });
  const card = document.createElement("canvas");
  card.width = 1024; card.height = Math.ceil(size.height * factor);
  const context = card.getContext("2d");
  if (!context) throw new Error("This browser cannot create a PNG.");
  const ctx = context;
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, card.width, card.height);
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#11274a";
  function text(value: string, font: string, fontSize: number, y: number) {
    ctx.font = `${fontSize * factor}px ${font}, sans-serif`;
    ctx.fillText(value, 512, y * factor, card.width);
  }
  text(snapshot.recipient, "RobotoMedium", 26, frame.titleTop + 15);
  if (snapshot.cents !== 0) text(money(snapshot.cents), "RobotoBold", 28, frame.amountTop + 16);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qr, (size.width - frame.qrSize) / 2 * factor, frame.qrTop * factor, frame.qrSize * factor, frame.qrSize * factor);
  if (snapshot.label) {
    let fontSize = 20, lines: string[] = [];
    do {
      ctx.font = `${fontSize * factor}px RobotoRegular, sans-serif`;
      lines = []; let line = "";
      for (const char of snapshot.label) {
        if (char === "\n" || (line && ctx.measureText(line + char).width > card.width)) { lines.push(line); line = ""; }
        if (char !== "\n") line += char;
      }
      if (line) lines.push(line);
      if (lines.length <= 2 || fontSize <= 8) break;
      --fontSize;
    } while (true);
    const visible = lines.slice(0, 2);
    visible.forEach((line, i) => text(line, "RobotoRegular", fontSize, frame.labelTop + frame.labelHeight / 2 + (i - (visible.length - 1) / 2) * 24));
  }
  return new Promise((resolve, reject) => card.toBlob(blob => blob ? resolve(blob) : reject(new Error("PNG export failed. Retry.")), "image/png"));
}

export async function exportPaymentCard(snapshot: PaymentSnapshot, mode: "save" | "share", size?: PaymentCardSize): Promise<void> {
  const blob = await paymentCardBlob({ ...snapshot }, size);
  const file = mode === "share" && typeof File !== "undefined" ? new File([blob], "payqr.png", { type: "image/png" }) : null;
  if (file && navigator.canShare?.({ files: [file] }) && navigator.share) {
    try { await navigator.share({ files: [file], title: "PayQR" }); }
    catch (error) { if (!(error instanceof Error && error.name === "AbortError")) throw error; }
    return;
  }
  // Browsers without file sharing download the same PNG automatically.
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "payqr.png";
  document.body.appendChild(link);
  try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000); }
}
