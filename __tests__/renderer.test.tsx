import React from "react";
import renderer, { act, ReactTestInstance } from "react-test-renderer";
import sharp from "sharp";
import jsQR from "jsqr";
import fs from "fs";
import { fixture } from "./fixture";
import { PaymentCard, paymentSnapshot } from "../src/screens/Payment";
import { validateQR } from "../src/domain/core";
jest.mock("../src/services/platform", () => ({
  savePNG: jest.fn(),
  sharePNG: jest.fn(),
}));
jest.mock("react-native-svg", () => {
  // Jest mock factories must load React inside their own scope.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  const component = (name: string) => {
    const C = React.forwardRef((props: any, ref: any) =>
      React.createElement(name, { ...props, ref }, props.children),
    );
    C.displayName = name;
    return C;
  };
  return {
    __esModule: true,
    default: component("svg"),
    Svg: component("svg"),
    G: component("g"),
    Path: component("path"),
    Rect: component("rect"),
    Defs: component("defs"),
    Image: component("image"),
    ClipPath: component("clipPath"),
    LinearGradient: component("linearGradient"),
    Stop: component("stop"),
  };
});
function svgMarkup(node: ReactTestInstance): string {
  if (typeof node.type !== "string")
    return node.children
      .map((child) => (typeof child === "string" ? child : svgMarkup(child)))
      .join("");
  const attributes = Object.entries(node.props)
    .filter(
      ([key, value]) =>
        !["children", "ref"].includes(key) &&
        typeof value !== "function" &&
        typeof value !== "object",
    )
    .map(
      ([key, value]) =>
        `${key === "strokeWidth" ? "stroke-width" : key}="${value}"`,
    )
    .join(" ");
  return `<${node.type} ${attributes}>${node.children.map((child) => (typeof child === "string" ? child : svgMarkup(child))).join("")}</${node.type}>`;
}
test("app QR renderer produces independently decodable exact-payload PNG", async () => {
  const payload = fixture();
  const recipient = {
    image: "file:///synthetic",
    payload,
    validation: validateQR(payload),
  };
  const snapshot = paymentSnapshot(recipient, 12300);
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<PaymentCard snapshot={snapshot} />);
  });
  const svg = tree!.root.findByType("svg" as any);
  const source = svgMarkup(svg).replace(
    "<svg ",
    '<svg xmlns="http://www.w3.org/2000/svg" ',
  );
  const png = await sharp(Buffer.from(source))
    .resize(900, 900)
    .png()
    .toBuffer();
  fs.mkdirSync("artifacts", { recursive: true });
  fs.writeFileSync("artifacts/synthetic-renderer.svg", source);
  fs.writeFileSync("artifacts/synthetic-renderer.png", png);
  const raw = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const decoded = jsQR(
    new Uint8ClampedArray(raw.data),
    raw.info.width,
    raw.info.height,
  );
  expect(decoded?.data).toBe(snapshot.payload);
  expect(snapshot.cents).toBe(12300);
  fs.mkdirSync("artifacts", { recursive: true });
  fs.writeFileSync("artifacts/synthetic-renderer.png", png);
  await act(async () => {
    tree!.unmount();
  });
});
