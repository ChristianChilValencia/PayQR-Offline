import React from "react";
import renderer, { act } from "react-test-renderer";
import { TextInput } from "react-native";
import { Payment, IconAction, StepButton } from "../src/screens/Payment";
import { Action, Input, FeedbackPressable } from "../src/screens/common";
import { AppIcon } from "../src/screens/icons";
import { initial } from "../src/domain/state";
import { validateQR, rewriteAmount } from "../src/domain/core";
import { fixture, fields } from "./fixture";
import { captureRef, releaseCapture } from "react-native-view-shot";
import { sharePNG } from "../src/services/platform";
jest.mock("../src/services/platform", () => ({
  savePNG: jest.fn(),
  sharePNG: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("react-native-view-shot", () => ({
  captureRef: jest.fn(),
  releaseCapture: jest.fn(),
}));
jest.mock("react-native-qrcode-svg", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  function QR(props: any) {
    React.useEffect(() => {
      props.getRef?.({});
    });
    return React.createElement("qr", props);
  }
  return { __esModule: true, default: QR };
});
test("non-whole inputs are rejected and zero permits original QR export", async () => {
  const payload = fixture(),
    update = jest.fn().mockResolvedValue(undefined);
  const props = {
    record: {
      ...initial,
      recipient: {
        image: "file:///a",
        payload,
        validation: validateQR(payload),
      },
    },
    update,
    importQR: jest.fn(),
    busy: false,
    cancel: jest.fn(),
    report: jest.fn(),
  };
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<Payment {...props} />);
  });
  expect(
    tree!.root.findAllByType(IconAction).find((a) => a.props.name === "Share QR")
      ?.props.disabled,
  ).toBe(false);
  await act(async () => {
    tree!.root.findByType(TextInput).props.onChangeText("1.555");
  });
  expect(tree!.root.findByType(TextInput).props.value).toBe("0");
  expect(update).not.toHaveBeenCalled();
  expect(
    tree!.root
      .findAllByType(Action)
      .filter((a) => ["+ ₱1", "− ₱1", "Share QR"].includes(a.props.title))
      .every((a) => a.props.disabled),
  ).toBe(true);
  await act(async () => {
    tree!.unmount();
  });
});
test("asynchronous export freezes QR and labels while active record changes", async () => {
  jest.useFakeTimers();
  const payload = fixture(),
    recipient = {
      image: "file:///a",
      payload,
      validation: validateQR(payload),
    };
  const props = {
    record: { ...initial, cents: 12300, recipient },
    update: jest.fn(),
    importQR: jest.fn(),
    busy: false,
    cancel: jest.fn(),
    report: jest.fn(),
  };
  let finish: (s: string) => void = () => {};
  jest.mocked(captureRef).mockImplementation(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  );
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<Payment {...props} />, {
      createNodeMock: () => ({}),
    });
  });
  await act(async () => {
    tree!.root
      .findAllByType(IconAction)
      .find((a) => a.props.name === "Share QR")!
      .props.onPress();
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(200);
  });
  expect(captureRef).toHaveBeenCalledTimes(1);
  const before = tree!.toJSON();
  const changed = fixture(
    fields.map((f) =>
      f.id === "59" ? { ...f, value: "ANOTHER RECIPIENT" } : f,
    ),
  );
  await act(async () => {
    tree!.update(
      <Payment
        {...props}
        record={{
          ...props.record,
          cents: 99900,
          recipient: { ...recipient, payload: changed },
        }}
      />,
    );
  });
  expect(JSON.stringify(tree!.toJSON())).toContain("₱123");
  expect(JSON.stringify(tree!.toJSON())).not.toContain("₱999.00");
  expect(tree!.root.findByType("qr" as any).props.value).toBe(rewriteAmount(payload, 12300));
  expect(JSON.stringify(tree!.toJSON())).not.toContain("ANOTHER RECIPIENT");
  expect(before).toBeTruthy();
  await act(async () => {
    finish("file:///capture.png");
  });
  expect(sharePNG).toHaveBeenCalledWith("file:///capture.png");
  expect(releaseCapture).toHaveBeenCalledWith("file:///capture.png");
  await act(async () => {
    tree!.unmount();
  });
  jest.useRealTimers();
});

test("whole peso edits save automatically and keep a fixed decimal suffix", async () => {
  const update = jest.fn().mockResolvedValue(undefined);
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<Payment record={{ ...initial, cents: 10000 }} update={update} importQR={jest.fn()} busy={false} cancel={jest.fn()} report={jest.fn()} />);
  });
  await act(async () => {
    tree!.root.findByType(TextInput).props.onChangeText("250.00");
  });
  expect(tree!.root.findByType(TextInput).props.value).toBe("250.00");
  expect(tree!.root.findAllByType(Action).some(a => a.props.title === "Update Card")).toBe(false);
  expect(update).toHaveBeenCalledWith({ ...initial, cents: 25000 });
  for (const invalid of ["-1", "1.555", "2.001", "abc", "1e3", "1000000000"]) {
    await act(async () => { tree!.root.findByType(TextInput).props.onChangeText(invalid); });
    expect(tree!.root.findByType(TextInput).props.value).toBe("250.00");
  }
  expect(update).toHaveBeenCalledTimes(1);
  await act(async () => {
    tree!.root.findAllByType(StepButton).find(a => a.props.step === 1)!.props.adjust();
  });
  expect(update).toHaveBeenLastCalledWith({ ...initial, cents: 25100 });
  expect(tree!.root.findByType(TextInput).props.value).toBe("251");

  await act(async () => { tree!.unmount(); });
});

test("rapid decimal edits preserve incomplete input, regenerate QR, and report failed saves", async () => {
  const payload = fixture();
  const report = jest.fn();
  const update = jest.fn().mockResolvedValue(undefined);
  let tree: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<Payment record={{ ...initial, cents: 100, recipient: { image: "file:///a", payload, validation: validateQR(payload) } }} update={update} importQR={jest.fn()} busy={false} cancel={jest.fn()} report={report} />); });
  await act(async () => {
    const edit = tree!.root.findByType(TextInput).props.onChangeText;
    edit("250.5"); edit("250.51"); edit("250.");
  });
  expect(update.mock.calls.map(call => call[0].cents)).toEqual([25050, 25051, 25000]);
  expect(tree!.root.findByType(TextInput).props.value).toBe("250.");
  expect(JSON.stringify(tree!.toJSON())).not.toContain("Enter an amount");
  expect(tree!.root.findByType("qr" as any).props.value).toBe(rewriteAmount(payload, 25000));
  expect(tree!.root.findAllByType(IconAction).every(button => button.props.disabled)).toBe(false);
  update.mockRejectedValueOnce(new Error("disk"));
  await act(async () => { tree!.root.findByType(TextInput).props.onChangeText("5.01"); });
  expect(report).toHaveBeenCalledWith(expect.stringContaining("Could not save amount"));
  expect(tree!.root.findAllByType(IconAction).every(button => button.props.disabled)).toBe(false);
  await act(async () => { tree!.unmount(); });
});

test("hold repeats after 400ms every 150ms and release, cancellation and unmount stop it", async () => {
  jest.useFakeTimers();
  const adjust = jest.fn().mockReturnValue(true);
  let tree: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<StepButton step={1} disabled={false} adjust={adjust} />); });
  const button = () => tree!.root.findAll(node => node.props.accessibilityRole === "button" && typeof node.props.onPressIn === "function")[0].props;
  act(() => button().onPressIn());
  act(() => jest.advanceTimersByTime(399));
  expect(adjust).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(301));
  expect(adjust).toHaveBeenCalledTimes(3);
  act(() => { button().onPressOut(); button().onPress(); jest.advanceTimersByTime(1000); });
  expect(adjust).toHaveBeenCalledTimes(3);
  act(() => { button().onPressIn(); button().onTouchCancel(); button().onPress(); jest.advanceTimersByTime(1000); });
  expect(adjust).toHaveBeenCalledTimes(3);
  act(() => { button().onPressIn(); button().onPressOut(); button().onPress(); });
  expect(adjust).toHaveBeenCalledTimes(4);
  act(() => { button().onPressIn(); });
  act(() => { tree!.unmount(); });
  act(() => { jest.advanceTimersByTime(1000); });
  expect(adjust).toHaveBeenCalledTimes(4);
  jest.useRealTimers();
});

test("long press shows an icon tooltip without exporting", async () => {
  const onPress = jest.fn();
  let tree: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<IconAction name="Share QR" icon="share" disabled={false} onPress={onPress} />); });
  const button = tree!.root.findAll(node => node.props.accessibilityRole === "button" && typeof node.props.onPressIn === "function")[0];
  act(() => { button.props.onPressIn(); button.props.onLongPress(); });
  expect(JSON.stringify(tree!.toJSON())).toContain("Share QR");
  act(() => { button.props.onPressOut(); button.props.onPress(); });
  expect(onPress).not.toHaveBeenCalled();
  act(() => { tree!.unmount(); });
});


test("typing a digit replaces the initial zero and preserves decimal entry", async () => {
  const update = jest.fn().mockResolvedValue(undefined);
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<Payment record={initial} update={update} importQR={jest.fn()} busy={false} cancel={jest.fn()} report={jest.fn()} />);
  });
  await act(async () => { tree!.root.findByType(TextInput).props.onChangeText("05"); });
  expect(tree!.root.findByType(TextInput).props.value).toBe("5");
  expect(update).toHaveBeenLastCalledWith({ ...initial, cents: 500 });
  await act(async () => { tree!.root.findByType(TextInput).props.onChangeText("0"); });
  await act(async () => { tree!.root.findByType(TextInput).props.onChangeText("0."); });
  expect(tree!.root.findByType(TextInput).props.value).toBe("0.");
  await act(async () => { tree!.root.findByType(TextInput).props.onChangeText("0.50"); });
  expect(tree!.root.findByType(TextInput).props.value).toBe("0.50");
  expect(update).toHaveBeenLastCalledWith({ ...initial, cents: 50 });
  await act(async () => { tree!.unmount(); });
});


test("zero-amount history export captures its own labeled original without updating selection", async () => {
  jest.useFakeTimers();
  jest.mocked(captureRef).mockClear().mockResolvedValue("file:///zero.png");
  jest.mocked(sharePNG).mockClear();
  const payload = fixture();
  const update = jest.fn();
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<Payment history initialExport="share" record={{ ...initial, cents: 0, activeQR: "another", recipient: { payload, validation: validateQR(payload), label: "Shop export" } }} update={update} importQR={jest.fn()} busy={false} cancel={jest.fn()} report={jest.fn()} />, { createNodeMock: () => ({}) }); });
  await act(async () => { await jest.advanceTimersByTimeAsync(1); });
  await act(async () => { await jest.advanceTimersByTimeAsync(300); });
  expect(tree.root.findByType("qr" as any).props.value).toBe(payload);
  expect(JSON.stringify(tree.toJSON())).toContain("Shop export");
  expect(captureRef).toHaveBeenCalledTimes(1);
  expect(sharePNG).toHaveBeenCalledWith("file:///zero.png");
  expect(update).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
  jest.useRealTimers();
});


test("export buttons stay enabled while a complete amount is being saved", async () => {
  let finish!: () => void;
  const update = jest.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const payload = fixture();
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<Payment record={{ ...initial, cents: 0, recipient: { payload, validation: validateQR(payload) } }} update={update} importQR={jest.fn()} busy={false} cancel={jest.fn()} report={jest.fn()} />); });
  await act(async () => tree.root.findByType(TextInput).props.onChangeText("25"));
  expect(tree.root.findAllByType(IconAction).map(button => button.props.name)).toEqual(["Share QR", "Download"]);
  expect(tree.root.findAllByType(IconAction).every(button => !button.props.disabled)).toBe(true);
  expect(tree.root.findByType("qr" as any).props.value).toBe(rewriteAmount(payload, 2500));
  await act(async () => finish());
  expect(tree.root.findAllByType(IconAction).every(button => !button.props.disabled)).toBe(true);
  await act(async () => tree.unmount());
});


test("saved-number copy icon confirms success and returns to copy", async () => {
  jest.useFakeTimers();
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<IconAction name="Copy" icon="copy" disabled={false} onPress={jest.fn().mockResolvedValue(undefined)} />); });
  await act(async () => tree.root.findByType(FeedbackPressable).props.onPress());
  expect(tree.root.findByType(AppIcon).props.name).toBe("check");
  await act(async () => jest.advanceTimersByTime(2000));
  expect(tree.root.findByType(AppIcon).props.name).toBe("copy");
  await act(async () => tree.unmount());
  jest.useRealTimers();
});

test("amount clear resets the QR to zero and trailing decimals keep actions enabled", async () => {
  const payload = fixture();
  const update = jest.fn().mockResolvedValue(undefined);
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<Payment record={{ ...initial, cents: 2500, recipient: { payload, validation: validateQR(payload) } }} update={update} importQR={jest.fn()} busy={false} cancel={jest.fn()} report={jest.fn()} />); });
  const input = () => tree.root.findByType(Input);
  for (const value of ["25.", "25.02", "."]) {
    await act(async () => input().props.onChangeText(value));
    expect(tree.root.findAllByType(IconAction).every(n => !n.props.disabled)).toBe(true);
  }
  await act(async () => input().props.onClear());
  expect(input().props.value).toBe("0");
  expect(input().props.clearable).toBe(false);
  expect(update.mock.calls.at(-1)[0].cents).toBe(0);
  expect(tree.root.findAllByType(IconAction).every(n => !n.props.disabled)).toBe(true);
  await act(async () => tree.unmount());
});

test("Receive has a wide Share button, no Reset, and an amount clear control", async () => {
  const payload = fixture();
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<Payment record={{ ...initial, recipient: { payload, validation: validateQR(payload) } }} update={jest.fn()} importQR={jest.fn()} busy={false} cancel={jest.fn()} report={jest.fn()} />); });
  expect(tree.root.findAllByType(Action).some(n => n.props.title === "Reset")).toBe(false);
  expect(tree.root.findAllByType(IconAction).find(n => n.props.name === "Share QR")!.props.expanded).toBe(true);
  expect(tree.root.findByType(Input).props.clearable).toBe(false);
  expect(tree.root.findByType(Input).props.clearLabel).toBe("Clear amount");
  await act(async () => tree.unmount());
});
