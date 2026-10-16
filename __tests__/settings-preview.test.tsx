import React from "react";
import { Platform } from "react-native";
import { IconAction } from "../src/screens/Payment";
import { exportPaymentCard } from "../src/services/payment-export";
jest.mock("../src/services/payment-export", () => ({ exportPaymentCard: jest.fn().mockResolvedValue(undefined) }));
import { act, create, ReactTestRenderer } from "react-test-renderer";
import { DeleteSheet } from "../src/screens/DeleteSheet";
import { SettingsPage } from "../src/screens/SettingsPage";
import { BottomSheet } from "../src/screens/BottomSheet";
import { SavedRow } from "../src/screens/SavedList";
import { Action } from "../src/screens/common";
import { useApp } from "../App";
import { pickQR, removeImage } from "../src/services/platform";
import { initial, migrate, RecordV1 } from "../src/domain/state";
import { validateQR } from "../src/domain/core";
import { fixture, fields } from "./fixture";
jest.mock("../App", () => ({ useApp: jest.fn() }));
jest.mock("expo-router", () => ({
  router: { navigate: jest.fn() },
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useFocusEffect: (cb: () => void) => require("react").useEffect(cb, [cb]),
}));
jest.mock("../src/screens/Settings", () => ({ Settings: () => null }));
jest.mock("../src/screens/Payment", () => ({
  Payment: () => null,
  IconAction: () => null,
}));
jest.mock("../src/services/platform", () => ({
  pickQR: jest.fn(),
  removeImage: jest.fn().mockResolvedValue(undefined),
}));
let tree: ReactTestRenderer;
let record: RecordV1;
let patch: jest.Mock;
const fresh = () => ({
  payload: fixture(
    fields.map((f) => (f.id === "59" ? { ...f, value: "NEW" } : f)),
  ),
  validation: validateQR(
    fixture(fields.map((f) => (f.id === "59" ? { ...f, value: "NEW" } : f))),
  ),
});
const button = (title: string) =>
  tree.root.findAllByType(Action).find((n) => n.props.title === title)!;
beforeEach(() => {
  jest.clearAllMocks();
  record = migrate({
    ...initial,
    recipient: {
      image: "file:///old",
      payload: fixture(),
      validation: validateQR(fixture()),
    },
  });
  patch = jest.fn(async (transform) => {
    record = transform(record);
  });
  (useApp as jest.Mock).mockImplementation(() => ({
    record,
    patch,
    report: jest.fn(),
  }));
  (pickQR as jest.Mock).mockResolvedValue(fresh());
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
test("preview does not change active QR; reset discards its payload", async () => {
  await act(async () => {
    tree = create(<SettingsPage />);
  });
  await act(async () => button("Import QR").props.onPress());
  expect(patch).not.toHaveBeenCalled();
  expect(record.recipient?.payload).toBe(fixture());
  await act(async () => button("Reset").props.onPress());
  expect(removeImage).not.toHaveBeenCalled();
  expect(removeImage).not.toHaveBeenCalledWith("file:///old");
  expect(button("Save")).toBeUndefined();
});
test("failed save retains draft for retry; successful save retains previous QR history", async () => {
  await act(async () => {
    tree = create(<SettingsPage />);
  });
  await act(async () => button("Import QR").props.onPress());
  patch.mockRejectedValueOnce(Error("disk"));
  await act(async () => button("Save").props.onPress());
  expect(button("Save")).toBeDefined();
  expect(removeImage).not.toHaveBeenCalled();
  expect(record.recipient?.payload).toBe(fixture());
  await act(async () => button("Save").props.onPress());
  expect(record.recipient?.payload).toBe(fresh().payload);
  expect(record.recipient?.image).toBeUndefined();
  expect(record.qrs).toHaveLength(2);
  expect(removeImage).not.toHaveBeenCalledWith("file:///old");
});
test("replacing and leaving preview discards strings without image operations", async () => {
  await act(async () => {
    tree = create(<SettingsPage />);
  });
  await act(async () => button("Import QR").props.onPress());
  (pickQR as jest.Mock).mockResolvedValue({
    ...fresh(),
    image: "file:///replacement",
  });
  await act(async () => button("Import QR").props.onPress());
  expect(removeImage).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
  expect(removeImage).not.toHaveBeenCalled();
});


test("delete waits for sheet confirmation and retains the entry on failure", async () => {
  await act(async () => { tree = create(<SettingsPage />); });
  await act(async () => { tree.root.findAllByType(SavedRow)[0].props.reveal(true); });
  await act(async () => { button("Delete").props.onPress(); });
  expect(patch).not.toHaveBeenCalled();
  const sheet = tree.root.findByType(DeleteSheet);
  expect(sheet.props.visible).toBe(true);
  await act(async () => { sheet.props.onCancel(); });
  expect(record.qrs).toHaveLength(1);
  expect(tree.root.findByType(DeleteSheet).props.visible).toBe(false);
  await act(async () => { tree.root.findAllByType(SavedRow)[0].props.reveal(true); });
  await act(async () => { button("Delete").props.onPress(); });
  patch.mockRejectedValueOnce(Error("disk"));
  await act(async () => { tree.root.findByType(DeleteSheet).props.onConfirm(); });
  expect(record.qrs).toHaveLength(1);
  expect(tree.root.findByType(DeleteSheet).props.visible).toBe(true);
  await act(async () => { tree.root.findByType(DeleteSheet).props.onConfirm(); });
  expect(record.qrs).toHaveLength(0);
  expect(record.recipient).toBeNull();
  expect(tree.root.findByType(DeleteSheet).props.visible).toBe(false);
});


test("active QR says Activated and the label editor keeps its Add/Edit title", async () => {
  await act(async () => { tree = create(<SettingsPage />); });
  expect(button("Activated").props.disabled).toBe(true);
  await act(async () => tree.root.findAllByType(SavedRow)[0].props.edit());
  const labelSheet = () => tree.root.findAllByType(BottomSheet).find(n => n.props.icon === "edit")!;
  expect(labelSheet().props.title).toBe("Add Label");
  await act(async () => labelSheet().props.children[0].props.onChangeText("Shop"));
  expect(labelSheet().props.title).toBe("Add Label");
  await act(async () => labelSheet().props.onClose());
  record.qrs![0].label = "Shop";
  await act(async () => tree.update(<SettingsPage />));
  await act(async () => tree.root.findAllByType(SavedRow)[0].props.edit());
  expect(labelSheet().props.title).toBe("Edit Label");
});


test("web exports an unselected QR directly without a sheet or selection change", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(Platform, "OS")!;
  Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
  const active = record.activeQR;
  const other = { ...fresh(), id: "other", label: "Other shop", date: new Date().toISOString() };
  record.qrs!.push(other);
  try {
    await act(async () => { tree = create(<SettingsPage />); });
    const otherRow = tree.root.findAllByType(SavedRow)[1];
    for (const [name, mode] of [["Download", "save"], ["Share QR", "share"]]) {
      await act(async () => otherRow.findAllByType(IconAction).find(n => n.props.name === name)!.props.onPress());
      expect(exportPaymentCard).toHaveBeenLastCalledWith(expect.objectContaining({ payload: other.payload, label: "Other shop", cents: 0 }), mode);
    }
    expect(record.activeQR).toBe(active);
    expect(patch).not.toHaveBeenCalled();
    expect(tree.root.findAllByType(BottomSheet).some(n => n.props.title === "QR export")).toBe(false);
  } finally { Object.defineProperty(Platform, "OS", descriptor); }
});
