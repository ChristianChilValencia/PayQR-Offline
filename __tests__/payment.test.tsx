import React from "react";
import renderer, { act } from "react-test-renderer";
import { TextInput } from "react-native";
import { Payment } from "../src/screens/Payment";
import { Action } from "../src/screens/common";
import { initial } from "../src/domain/state";
import { validateQR } from "../src/domain/core";
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
test("invalid pasted amount stays visible, retains amount and disables adjustments/export; zero disables export", async () => {
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
    tree!.root.findAllByType(Action).find((a) => a.props.title === "Share PNG")
      ?.props.disabled,
  ).toBe(true);
  await act(async () => {
    tree!.root.findByType(TextInput).props.onChangeText("1.5");
  });
  expect(tree!.root.findByType(TextInput).props.value).toBe("1.5");
  expect(update).not.toHaveBeenCalled();
  expect(
    tree!.root
      .findAllByType(Action)
      .filter((a) => ["+ ₱1", "− ₱1", "Share PNG"].includes(a.props.title))
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
      .findAllByType(Action)
      .find((a) => a.props.title === "Share PNG")!
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
  expect(JSON.stringify(tree!.toJSON())).toContain("₱123.00");
  expect(JSON.stringify(tree!.toJSON())).not.toContain("₱999.00");
  expect(tree!.root.findByType("qr" as any).props.value).toBe(payload);
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
