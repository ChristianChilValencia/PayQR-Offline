const sharp = require("sharp");
const { Buffer } = require("buffer");
const artwork =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" rx="220" fill="#11274a"/><rect x="176" y="176" width="672" height="672" rx="160" fill="#075cce"/><path d="M386 308h146c160 0 160 216 0 216H386m0-216v408m-64-320h330m-330 58h330" fill="none" stroke="white" stroke-width="50" stroke-linecap="round"/><rect x="658" y="644" width="54" height="54" rx="9" fill="white"/><rect x="732" y="644" width="54" height="54" rx="9" fill="white"/><rect x="658" y="718" width="54" height="54" rx="9" fill="white"/></svg>';
Promise.all(
  ["icon.png", "adaptive-icon.png"].map((name) =>
    sharp(Buffer.from(artwork))
      .png()
      .toFile("assets/" + name),
  ),
);
