import React from "react";
import { act, create, ReactTestRenderer } from "react-test-renderer";
import { Modal } from "react-native";
import { Settings } from "../src/screens/Settings";
import { Action, Input } from "../src/screens/common";
jest.mock("../src/services/launcher", () => ({
  availableApps: jest
    .fn()
    .mockResolvedValue([{ name: "GCash", target: "gcash://" }]),
  nativeAppPickerAvailable: () => false,
}));
jest.mock("../src/services/platform", () => ({ openLink: jest.fn() }));
let tree: ReactTestRenderer;
const button = (title: string) =>
  tree.root.findAllByType(Action).find((n) => n.props.title === title)!;
const visible = () => tree.root.findByType(Modal).props.visible;
beforeEach(() => jest.useFakeTimers());
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  jest.useRealTimers();
});
test("chooser supports backdrop, system back and Cancel dismissal", async () => {
  await act(async () => {
    tree = create(<Settings link="" save={jest.fn()} report={jest.fn()} />);
  });
  for (const close of [
    () => button("Cancel").props.onPress(),
    () => tree.root.findByType(Modal).props.onRequestClose(),
    () =>
      tree.root
        .findByProps({ accessibilityLabel: "Dismiss app chooser" })
        .props.onPress(),
  ]) {
    await act(async () => button("Choose app").props.onPress());
    expect(visible()).toBe(true);
    await act(async () => close());
    expect(visible()).toBe(true);
    await act(async () => { await jest.advanceTimersByTimeAsync(300); });
    expect(visible()).toBe(false);
  }
});
test("custom form stays inside chooser, validates links, and blocks dismissal while saving", async () => {
  let resolve!: () => void;
  const save = jest.fn(
    () =>
      new Promise<void>((r) => {
        resolve = r;
      }),
  );
  await act(async () => {
    tree = create(<Settings link="" save={save} report={jest.fn()} />);
  });
  expect(button("Use custom link")).toBeUndefined();
  await act(async () => button("Choose app").props.onPress());
  await act(async () => button("Use custom link").props.onPress());
  expect(visible()).toBe(true);
  const input = () =>
    tree.root
      .findAllByType(Input)
      .find((n) => n.props.accessibilityLabel === "Launch link")!;
  await act(async () => input().props.onChangeText("javascript:alert(1)"));
  expect(button("Save").props.disabled).toBe(true);
  await act(async () => input().props.onChangeText("gcash://"));
  expect(button("Save").props.disabled).toBe(false);
  await act(async () => button("Save").props.onPress());
  expect(save).toHaveBeenCalledWith("gcash://");
  expect(button("Cancel").props.disabled).toBe(true);
  await act(async () => tree.root.findByType(Modal).props.onRequestClose());
  expect(visible()).toBe(true);
  await act(async () => resolve());
  await act(async () => { await jest.advanceTimersByTimeAsync(300); });
  expect(visible()).toBe(false);
});
