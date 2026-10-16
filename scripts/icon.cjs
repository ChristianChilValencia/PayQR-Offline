/* global __dirname */
const sharp = require("sharp");
const path = require("path");
const assets = path.join(__dirname, "..", "assets");
const source = path.join(assets, "PayQR_logo.png");

async function generate() {
  // Preserve the transparent source corners in every generated asset.
  await sharp(source).resize(1024, 1024, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(assets, "icon.png"));
  await sharp(source).resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(assets, "splash-icon.png"));
  // Android adaptive masks need breathing room around the complete logo.
  const foreground = await sharp(source).resize(640, 640, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } } }).composite([{ input: foreground, gravity: "centre" }]).png().toFile(path.join(assets, "adaptive-icon.png"));
  await sharp(source).resize(48, 48, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(assets, "favicon.png"));
}
generate().catch((error) => { console.error(error); process.exitCode = 1; });
