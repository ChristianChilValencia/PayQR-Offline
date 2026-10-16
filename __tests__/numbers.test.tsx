import React from "react";
import { ScrollView } from "react-native";
import { act, create, ReactTestRenderer } from "react-test-renderer";
import { Settings } from "../src/screens/Settings";
import { BottomSheet } from "../src/screens/BottomSheet";
jest.mock("../src/services/launcher", () => ({ availableApps: jest.fn().mockResolvedValue([{ name: "GCash", target: "gcash://" }]), nativeAppPickerAvailable: () => false }));
import { Numbers } from "../src/screens/Numbers";
import { Action, Input } from "../src/screens/common";
import { copyNumber, copyAndOpen } from "../src/services/platform";
import { findPhones } from "../src/domain/core";
import {
  groupApps,
  packageTarget,
  PAYMENT_PACKAGES,
} from "../src/domain/launcher";
import { copyThenOpen } from "../src/domain/state";
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("../src/services/platform", () => ({
  copyNumber: jest.fn(),
  copyAndOpen: jest.fn(),
}));
afterEach(() => jest.clearAllMocks());
test("OCR number parsing normalizes and deduplicates complete numbers", () => {
  expect(findPhones("09 17-123-4567 / +63917 123 4567; 09181234567")).toEqual([
    "09171234567",
    "09181234567",
  ]);
  expect(findPhones("0917123456; 091712345678; +6391712345678")).toEqual([]);
});
test("even a single detected number requires selection, and correction remains available", async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <Numbers candidates={["09171234567"]} link="" report={jest.fn()} />,
    );
  });
  const action = (title: string) =>
    tree.root.findAllByType(Action).find((node) => node.props.title === title)!;
  expect(action("Copy Number").props.disabled).toBe(true);
  expect(copyNumber).not.toHaveBeenCalled();
  await act(async () => action("09171234567").props.onPress());
  expect(copyNumber).not.toHaveBeenCalled();
  expect(action("Copy Number").props.disabled).toBe(false);
  await act(async () => action("Copy Number").props.onPress());
  expect(copyNumber).toHaveBeenCalledWith("09171234567");
  await act(async () => tree.root.findAllByType(Input).find(n => n.props.accessibilityLabel === "Selected or manual number")!.props.onChangeText("123"));
  expect(action("Copy Number").props.disabled).toBe(true);
  expect(copyAndOpen).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
test("payment grouping uses exact packages, preserves targets and searches other apps", () => {
  const apps = PAYMENT_PACKAGES.map((pkg, i) => ({
    name: String(i),
    target: packageTarget(pkg, String(i)),
  })).reverse();
  const impostor = {
    name: "GCash",
    target: packageTarget("com.example.fake", "GCash"),
  };
  const grouped = groupApps([...apps, impostor]);
  expect(grouped[0].data.map((app) => app.name)).toEqual([
    "0",
    "1",
    "2",
    "3",
    "4",
  ]);
  expect(grouped[1].data).toEqual([impostor]);
  expect(groupApps([...apps, impostor], "example.fake")[1].data).toEqual([
    impostor,
  ]);
});
test("copy failure prevents launch; launch failure reports copied number", async () => {
  const copy = jest.fn().mockRejectedValue(new Error("Clipboard failed"));
  const open = jest.fn().mockRejectedValue(new Error("Uninstalled"));
  await expect(
    copyThenOpen("09171234567", "target", copy, open),
  ).rejects.toThrow("Clipboard failed");
  expect(open).not.toHaveBeenCalled();
  copy.mockResolvedValue(undefined);
  await expect(
    copyThenOpen("09171234567", "target", copy, open),
  ).rejects.toThrow("remains copied");
  expect(copy.mock.invocationCallOrder[1]).toBeLessThan(
    open.mock.invocationCallOrder[0],
  );
});

test("copy keeps other buttons visually enabled and ignores duplicate pending taps", async () => {
  let finish!: () => void;
  jest.mocked(copyNumber).mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Numbers selected="09171234567" link="gcash://" save={jest.fn()} report={jest.fn()} />); });
  const buttons = () => tree.root.findAllByType(Action);
  const copy = () => buttons().find(n => n.props.title === "Copy Number")!;
  const before = buttons().map(n => n.props.disabled);
  const calls = jest.mocked(copyNumber).mock.calls.length;
  await act(async () => copy().props.onPress());
  expect(buttons().map(n => n.props.disabled)).toEqual(before);
  await act(async () => copy().props.onPress());
  expect(copyNumber).toHaveBeenCalledTimes(calls + 1);
  await act(async () => finish());
  await act(async () => tree.unmount());
});

test("successful copy shows a check for two seconds then restores the copy icon", async () => {
  jest.useFakeTimers();
  jest.mocked(copyNumber).mockResolvedValueOnce(undefined);
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Numbers selected="09171234567" link="" report={jest.fn()} />); });
  const button = () => tree.root.findAllByType(Action).find(n => n.props.title === "Copy Number")!;
  await act(async () => button().props.onPress());
  expect(button().props.icon).toBe("check");
  await act(async () => jest.advanceTimersByTime(2000));
  expect(button().props.icon).toBe("copy");
  await act(async () => tree.unmount());
  jest.useRealTimers();
});

test("full-number input normalizes pasted country codes and rejects malformed or excess digits", async () => {
  let tree!: ReactTestRenderer;
  const report = jest.fn();
  await act(async () => {
    tree = create(<Numbers link="" report={report} />);
  });
  const input = () => tree.root.findAllByType(Input).find(n => n.props.accessibilityLabel === "Selected or manual number")!;
  for (const full of [
    "09171234567",
    "639171234567",
    "+639171234567",
    "09 17-123-4567",
  ]) {
    await act(async () => input().props.onChangeText(full));
    expect(input().props.value).toBe("09171234567");
  }
  for (const bad of [
    "091712345678",
    "123456789012",
    "-123",
    "1.2",
    "abc",
    "-09171234567",
  ]) {
    await act(async () => input().props.onChangeText(bad));
    expect(input().props.value).toBe("09171234567");
  }
  expect(report).not.toHaveBeenCalled();
  await act(async () => input().props.onChangeText("123"));
  expect(input().props.value).toBe("09123");
  expect(
    tree.root.findAllByType(Action).find((n) => n.props.title === "Copy Number")
      ?.props.disabled,
  ).toBe(true);
  await act(async () => input().props.onChangeText(""));
  expect(input().props.value).toBe("");
  await act(async () => tree.unmount());
});

test("partial prefixes resume after blur and non-9 digits acquire the mobile prefix", async () => {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Numbers link="" report={jest.fn()} />); });
  const input = () => tree.root.findAllByType(Input).find(n => n.props.accessibilityLabel === "Selected or manual number")!;
  for (const prefix of ["+6", "+63"]) {
    await act(async () => input().props.onChangeText(""));
    await act(async () => input().props.onChangeText(prefix));
    await act(async () => input().props.onBlur());
    expect(input().props.value).toBe("09");
    await act(async () => input().props.onChangeText(input().props.value + "7"));
    expect(input().props.value).toBe("097");
    await act(async () => input().props.onChangeText(prefix));
    await act(async () => input().props.onChangeText(prefix + "7"));
    expect(input().props.value).toBe("097");
  }
  await act(async () => input().props.onChangeText("0"));
  await act(async () => input().props.onChangeText("01"));
  expect(input().props.value).toBe("091");
  for (const digit of "71234567") await act(async () => input().props.onChangeText(input().props.value + digit));
  expect(input().props.value).toBe("09171234567");
  await act(async () => tree.unmount());
});

test("typing +63 or a leading 9 converts automatically to the local 09 format", async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<Numbers link="" report={jest.fn()} />);
  });
  const input = () => tree.root.findAllByType(Input).find(n => n.props.accessibilityLabel === "Selected or manual number")!;
  for (const char of "+639171234567")
    await act(async () =>
      input().props.onChangeText(input().props.value + char),
    );
  expect(input().props.value).toBe("09171234567");
  await act(async () => input().props.onChangeText(""));
  for (const char of "9171234567")
    await act(async () =>
      input().props.onChangeText(input().props.value + char),
    );
  expect(input().props.value).toBe("09171234567");
  await act(async () => tree.unmount());
});

test("Scan and Copy & Open App share a footer outside the scrolling keypad", async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<Numbers link="" report={jest.fn()} />);
  });
  const actions = tree.root.findAllByType(Action);
  const scan = actions.find((n) => n.props.title === "Scan")!;
  const open = actions.find((n) => n.props.title === "Copy & Open App")!;
  expect(
    tree.root
      .findByProps({ testID: "number-actions" })
      .findAllByType(Action)
      .map((n) => n.props.title),
  ).toEqual(["Scan", "Copy & Open App"]);
  expect(scan.props.icon).toBe("camera");
  expect(open.props.icon).toBe("open");
  expect(tree.root.findAllByType(ScrollView)).toHaveLength(1);
  await act(async () => tree.unmount());
});


test("saved numbers disable save while keeping copy available", async () => {
  const save = jest.fn().mockResolvedValue(undefined);
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<Numbers selected="+639171234567" savedNumbers={["09171234567"]} save={save} link="" report={jest.fn()} />);
  });
  const action = (title: string) => tree.root.findAllByType(Action).find(node => node.props.title === title)!;
  expect(action("Already Saved").props.disabled).toBe(true);
  expect(action("Already Saved").props.icon).toBe("check");
  expect(action("Copy Number").props.disabled).toBe(false);
  await act(async () => { action("Already Saved").props.onPress(); });
  expect(save).not.toHaveBeenCalled();
  await act(async () => { tree.root.findAllByType(Input).find(n => n.props.accessibilityLabel === "Selected or manual number")!.props.onChangeText("09181234567"); });
  expect(action("Save Number").props.disabled).toBe(false);
  expect(action("Copy Number").props.disabled).toBe(false);
  await act(async () => { tree.unmount(); });
});


test("keypad limits digits, backspaces, clears and saves a trimmed label", async () => {
  const save = jest.fn().mockResolvedValue(undefined);
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Numbers link="" report={jest.fn()} save={save} />); });
  const key = (label: string) => tree.root.findAll(n => n.props.accessibilityLabel === label && !!n.props.onPress)[0];
  const phone = () => tree.root.findAllByType(Input).find(n => n.props.accessibilityLabel === "Selected or manual number")!;
  const action = (title: string) => tree.root.findAllByType(Action).find(n => n.props.title === title)!;
  expect(phone().props.showSoftInputOnFocus).toBe(false);
  for (const digit of "09171234567") await act(async () => key(digit).props.onPress());
  await act(async () => key("8").props.onPress());
  expect(phone().props.value).toBe("09171234567");
  await act(async () => key("Backspace").props.onPress());
  expect(phone().props.value).toBe("0917123456");
  expect(action("Copy Number").props.disabled).toBe(true);
  await act(async () => key("7").props.onPress());
  await act(async () => tree.root.findAllByType(Input).find(n => n.props.accessibilityLabel === "Number label (optional)")!.props.onChangeText("  Shop  "));
  await act(async () => action("Save Number").props.onPress());
  expect(save).toHaveBeenCalledWith("09171234567", "Shop");
  expect(action("Saved").props.disabled).toBe(true);
  expect(action("Copy Number").props.disabled).toBe(false);
  await act(async () => key("Clear number").props.onPress());
  expect(phone().props.value).toBe("");
  await act(async () => key("9").props.onPress());
  await act(async () => key("Clear").props.onPress());
  expect(phone().props.value).toBe("");
  await act(async () => tree.unmount());
});


test("saved labels stay visible and disabled after saving and when re-entering an existing number", async () => {
  let tree!: ReactTestRenderer;
  const save = jest.fn().mockResolvedValue(undefined);
  await act(async () => { tree = create(<Numbers link="" selected="09171234567" save={save} report={jest.fn()} />); });
  const label = () => tree.root.findAllByType(Input).find(n => n.props.accessibilityLabel === "Number label (optional)")!;
  const phone = () => tree.root.findAllByType(Input).find(n => n.props.accessibilityLabel === "Selected or manual number")!;
  await act(async () => label().props.onChangeText("  Shop  "));
  await act(async () => tree.root.findAllByType(Action).find(n => n.props.title === "Save Number")!.props.onPress());
  expect(label().props.value).toBe("Shop");
  expect(label().props.editable).toBe(false);
  await act(async () => phone().props.onChangeText(""));
  expect(label().props.value).toBe("");
  await act(async () => phone().props.onChangeText("09171234567"));
  expect(label().props.value).toBe("Shop");
  expect(label().props.editable).toBe(false);
  expect(label().props.accessibilityState.disabled).toBe(true);
  await act(async () => tree.update(<Numbers link="" savedEntries={[{ number: "09181234567", label: "Existing shop", date: "2026-01-01", source: "manual" }]} save={save} report={jest.fn()} />));
  await act(async () => phone().props.onChangeText("09181234567"));
  expect(label().props.value).toBe("Existing shop");
  expect(label().props.editable).toBe(false);
  expect(tree.root.findAllByType(Action).find(n => n.props.title === "Already Saved")!.props.disabled).toBe(true);
  await act(async () => phone().props.onChangeText(""));
  expect(label().props.value).toBe("");
  expect(label().props.editable).toBe(true);
  await act(async () => phone().props.onChangeText("712345678"));
  expect(phone().props.value).toBe("09712345678");
  expect(label().props.editable).toBe(true);
  await act(async () => tree.unmount());
});

test("Copy & Open opens the chooser without a configured app, then saves before copying and opening", async () => {
  let tree!: ReactTestRenderer;
  const saveApp = jest.fn().mockResolvedValue(undefined);
  await act(async () => { tree = create(<Numbers link="" saveApp={saveApp} report={jest.fn()} />); });
  const open = () => tree.root.findAllByType(Action).find(n => n.props.title === "Copy & Open App")!;
  expect(open().props.disabled).toBe(false);
  await act(async () => open().props.onPress());
  expect(tree.root.findAllByType(BottomSheet).find(n => n.props.title === "Choose app")!.props.visible).toBe(true);
  expect(copyAndOpen).not.toHaveBeenCalled();
  await act(async () => tree.root.findAllByType(Input).find(n => n.props.accessibilityLabel === "Selected or manual number")!.props.onChangeText("9171234567"));
  await act(async () => tree.root.findByType(Settings).props.save("gcash://"));
  expect(saveApp).toHaveBeenCalledWith("gcash://");
  expect(copyAndOpen).toHaveBeenCalledWith("09171234567", "gcash://");
  expect(saveApp.mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(copyAndOpen).mock.invocationCallOrder[0]);
  await act(async () => tree.unmount());
});
