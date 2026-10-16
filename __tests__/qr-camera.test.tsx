import React from "react";
import { act, create, ReactTestRenderer } from "react-test-renderer";
import { AppState } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { QRImportCamera } from "../src/screens/QRImportCamera";
import { Action } from "../src/screens/common";
import { fixture } from "./fixture";

jest.mock("expo-camera", () => ({
  CameraView: "CameraPreview",
  useCameraPermissions: jest.fn(() => [{ granted: true }, jest.fn()]),
}));
let tree: ReactTestRenderer;
beforeEach(() => {
  Object.defineProperty(AppState, "currentState", { configurable: true, value: "active" });
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.clearAllMocks(); });

test("automatically imports a valid QR once despite repeated camera events", async () => {
  const onImport = jest.fn();
  await act(async () => { tree = create(<QRImportCamera onImport={onImport} onClose={jest.fn()} />); });
  const scan = tree.root.findByType(CameraView).props.onBarcodeScanned;
  await act(async () => { scan({ data: fixture() }); scan({ data: fixture() }); });
  expect(onImport).toHaveBeenCalledTimes(1);
  expect(onImport.mock.calls[0][0].payload).toBe(fixture());
});

test("invalid QR offers retry and then accepts a valid QR", async () => {
  const onImport = jest.fn();
  await act(async () => { tree = create(<QRImportCamera onImport={onImport} onClose={jest.fn()} />); });
  await act(async () => tree.root.findByType(CameraView).props.onBarcodeScanned({ data: "" }));
  expect(onImport).not.toHaveBeenCalled();
  expect(tree.root.findAllByType(CameraView)).toHaveLength(0);
  await act(async () => tree.root.findAllByType(Action).find(n => n.props.title === "Retry")!.props.onPress());
  await act(async () => tree.root.findByType(CameraView).props.onBarcodeScanned({ data: fixture() }));
  expect(onImport).toHaveBeenCalledTimes(1);
});

test("denied permission does not mount the camera", async () => {
  const request = jest.fn().mockResolvedValue(undefined);
  jest.mocked(useCameraPermissions).mockReturnValueOnce([{ granted: false, canAskAgain: true }, request] as never);
  await act(async () => { tree = create(<QRImportCamera onImport={jest.fn()} onClose={jest.fn()} />); });
  expect(tree.root.findAllByType(CameraView)).toHaveLength(0);
  await act(async () => tree.root.findAllByType(Action).find(n => n.props.title === "Allow camera")!.props.onPress());
  expect(request).toHaveBeenCalledTimes(1);
});
