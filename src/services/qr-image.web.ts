import jsQR from "jsqr";

export async function scanQRImage(uri: string) {
  if (uri.startsWith("data:") && uri.length > 28 * 1024 * 1024)
    throw new Error("Image is too large. Choose a smaller QR image.");
  const image = new Image();
  image.src = uri;
  await image.decode();
  if (!image.naturalWidth || !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 40_000_000)
    throw new Error("Image is too large or invalid. Choose a smaller QR image.");
  const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context)
    throw new Error("Image decoding is unavailable in this browser.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(pixels.data, pixels.width, pixels.height);
  if (!code) return [];
  // Mask the first QR and check that another recipient QR is not present.
  const { topLeftCorner, topRightCorner, bottomRightCorner, bottomLeftCorner } =
    code.location;
  const corners = [
    topLeftCorner,
    topRightCorner,
    bottomRightCorner,
    bottomLeftCorner,
  ];
  context.fillStyle = "white";
  context.beginPath();
  corners.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.closePath();
  context.fill();
  const remaining = context.getImageData(0, 0, canvas.width, canvas.height);
  const second = jsQR(remaining.data, remaining.width, remaining.height);
  return second
    ? [{ data: code.data }, { data: second.data }]
    : [{ data: code.data }];
}

export async function removeImage(_uri: string) {
  // Legacy data URLs are released when payload-only metadata replaces the record.
}
