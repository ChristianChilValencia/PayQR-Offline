import QR from "qrcode";
import sharp from "sharp";
import { validateQR } from "../src/domain/core";
import { fixture } from "./fixture";
import { scanQRImage } from "../src/services/qr-image.web";
import { hydrate, initial, migrate } from "../src/domain/state";

test.each([[0, 100], [10000, 10000]])("browser rejects invalid or oversized dimensions %sx%s before creating a canvas", async (width, height) => {
  const oldImage = Object.getOwnPropertyDescriptor(globalThis, "Image");
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const createElement = jest.fn();
  Object.defineProperty(globalThis, "Image", { configurable: true, value: class {
    naturalWidth = width; naturalHeight = height;
    async decode() {}
  } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement } });
  try {
    await expect(scanQRImage("blob:local-photo")).rejects.toThrow("too large or invalid");
    expect(createElement).not.toHaveBeenCalled();
  } finally {
    if (oldImage) Object.defineProperty(globalThis, "Image", oldImage);
    else Reflect.deleteProperty(globalThis, "Image");
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
});

test("browser bounds the decoding canvas for large accepted images", async () => {
  const oldImage = Object.getOwnPropertyDescriptor(globalThis, "Image");
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const context = { drawImage: jest.fn(), getImageData: () => ({
    data: new Uint8ClampedArray(2048 * 1024 * 4).fill(255), width: 2048, height: 1024,
  }) };
  const canvas = { width: 0, height: 0, getContext: () => context };
  Object.defineProperty(globalThis, "Image", { configurable: true, value: class {
    naturalWidth = 4096; naturalHeight = 2048;
    async decode() {}
  } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => canvas } });
  try {
    expect(await scanQRImage("blob:local-photo")).toEqual([]);
    expect(canvas.width).toBe(2048);
    expect(canvas.height).toBe(1024);
    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2048, 1024);
  } finally {
    if (oldImage) Object.defineProperty(globalThis, "Image", oldImage);
    else Reflect.deleteProperty(globalThis, "Image");
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
});

test("browser decodes a real payment QR and persists only its payload", async () => {
  const payload = fixture();
  const png = await QR.toBuffer(payload, { width: 500 });
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let masked = false;
  const context = {
    drawImage: jest.fn(),
    getImageData: () => ({
      data: masked
        ? new Uint8ClampedArray(data.length).fill(255)
        : new Uint8ClampedArray(data),
      width: info.width,
      height: info.height,
    }),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    fill: () => {
      masked = true;
    },
  };
  const oldImage = Object.getOwnPropertyDescriptor(globalThis, "Image");
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    value: class {
      naturalWidth = info.width;
      naturalHeight = info.height;
      async decode() {}
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: () => ({ getContext: () => context }),
    },
  });
  try {
    const uri = `data:image/png;base64,${png.toString("base64")}`;
    expect(await scanQRImage(uri)).toEqual([{ data: payload }]);
    const restored = hydrate(
      JSON.stringify(
        migrate({
          ...initial,
          recipient: { image: uri, payload, validation: validateQR(payload) },
        }),
      ),
    );
    expect(restored.recipient?.payload).toBe(payload);
    expect(restored.recipient?.image).toBeUndefined();
  } finally {
    if (oldImage) Object.defineProperty(globalThis, "Image", oldImage);
    else Reflect.deleteProperty(globalThis, "Image");
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
