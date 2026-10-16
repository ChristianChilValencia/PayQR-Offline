import React from "react";
import { act, create, ReactTestRenderer } from "react-test-renderer";
import { AppState } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as FS from "expo-file-system/legacy";
import { router } from "expo-router";
import { Scan } from "../src/screens/Scan";
import { Numbers } from "../src/screens/Numbers";
import { Action } from "../src/screens/common";
import { recognizeText } from "../src/services/ocr";
jest.mock("../App", () => ({ useApp: () => ({ record: { link: "" }, report: jest.fn() }) }));
jest.mock("expo-router", () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock("expo-file-system/legacy", () => ({ deleteAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock("../src/services/platform", () => ({ copyNumber: jest.fn(), copyAndOpen: jest.fn() }));
jest.mock("../src/services/ocr", () => ({ ocrAvailable: () => true, recognizeText: jest.fn() }));
jest.mock("expo-camera", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    CameraView: class MockCameraView extends React.Component {
      takePictureAsync = jest.fn().mockResolvedValue({ uri: "file:///capture.jpg" });
      render() { return React.createElement("CameraPreview", this.props); }
    },
    useCameraPermissions: jest.fn(() => [{ granted: true }, jest.fn()]),
  };
});
let tree: ReactTestRenderer;
async function mount() {
  Object.defineProperty(AppState, "currentState", { configurable: true, value: "active" });
  await act(async () => { tree = create(<Scan />); });
  await act(async () => tree.root.findByType(CameraView).props.onCameraReady());
}
function button(title: string) { return tree.root.findAllByType(Action).find(node => node.props.title === title)!; }
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.clearAllMocks(); });
test("capture recognizes offline numbers, releases preview and deletes the photo", async () => {
  jest.mocked(recognizeText).mockResolvedValue("0917 123 4567 and +639171234567");
  await mount();
  await act(async () => button("Capture").props.onPress());
  expect(tree.root.findAllByType(CameraView)).toHaveLength(0);
  expect(tree.root.findByType(Numbers).props.candidates).toEqual(["09171234567"]);
  expect(FS.deleteAsync).toHaveBeenCalledWith("file:///capture.jpg", { idempotent: true });
});
test("recognition failure deletes capture and offers retry", async () => {
  jest.mocked(recognizeText).mockRejectedValue(new Error("OCR unavailable"));
  await mount();
  await act(async () => button("Capture").props.onPress());
  expect(button("Retry")).toBeDefined();
  expect(FS.deleteAsync).toHaveBeenCalled();
  await act(async () => button("Retry").props.onPress());
  expect(tree.root.findByType(CameraView)).toBeDefined();
});
test("cancel ignores late OCR completion and still deletes the photo", async () => {
  let resolve!: (text: string) => void;
  jest.mocked(recognizeText).mockReturnValue(new Promise(done => { resolve = done; }));
  await mount();
  await act(async () => button("Capture").props.onPress());
  await act(async () => button("Cancel").props.onPress());
  expect(router.back).toHaveBeenCalled();
  await act(async () => resolve("09171234567"));
  expect(tree.root.findAllByType(Numbers)).toHaveLength(0);
  expect(FS.deleteAsync).toHaveBeenCalled();
});
test("no results allows manual entry and retaking", async () => {
  jest.mocked(recognizeText).mockResolvedValue("No phone here");
  await mount();
  await act(async () => button("Capture").props.onPress());
  expect(tree.root.findByType(Numbers).props.candidates).toEqual([]);
  await act(async () => tree.root.findByType(Numbers).props.onScan());
  expect(tree.root.findByType(CameraView)).toBeDefined();
});

test("denied permission offers an explicit permission action without mounting camera", async () => {
  const request = jest.fn().mockResolvedValue(undefined);
  jest.mocked(useCameraPermissions).mockReturnValueOnce([{ granted: false, canAskAgain: true }, request] as never);
  await act(async () => { tree = create(<Scan />); });
  expect(tree.root.findAllByType(CameraView)).toHaveLength(0);
  await act(async () => button("Allow camera").props.onPress());
  expect(request).toHaveBeenCalled();
});
