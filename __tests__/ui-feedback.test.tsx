import React from "react";
import { act, create, ReactTestRenderer } from "react-test-renderer";
import { Modal, PanResponder, StyleSheet, Text } from "react-native";
import { Action, FeedbackPressable, Input } from "../src/screens/common";
import { BottomSheet } from "../src/screens/BottomSheet";
import { DeleteSheet } from "../src/screens/DeleteSheet";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test("buttons distinguish rest, pressed, hover, focus and disabled states", async () => {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Action title="Test" onPress={jest.fn()} />); });
  const button = () => tree.root.findAll(n => n.props.accessibilityLabel === "Test" && typeof n.props.style === "function")[0];
  const opacity = (pressed: boolean) => StyleSheet.flatten(button().props.style({ pressed })).opacity;
  expect(opacity(false)).toBe(1);
  expect(opacity(true)).toBe(0.65);
  await act(async () => button().props.onHoverIn({}));
  expect(opacity(false)).toBe(0.82);
  await act(async () => button().props.onHoverOut({}));
  await act(async () => button().props.onFocus({}));
  expect(opacity(false)).toBe(0.82);
  await act(async () => button().props.onBlur({}));
  expect(opacity(false)).toBe(1);
  await act(async () => tree.update(<Action title="Test" disabled onPress={jest.fn()} />));
  expect(opacity(true)).toBe(0.4);
  await act(async () => tree.unmount());
});

test("sheet animates before dismissing, supports downward drag and blocks busy dismissal", async () => {
  const spy = jest.spyOn(PanResponder, "create");
  const onClose = jest.fn();
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<BottomSheet visible title="Sheet" onClose={onClose}><Text>Contents</Text></BottomSheet>); });
  await act(async () => tree.root.findByType(Modal).props.onShow());
  await act(async () => { await jest.advanceTimersByTimeAsync(300); });
  const handlers = spy.mock.calls[spy.mock.calls.length - 1][0];
  expect(handlers.onMoveShouldSetPanResponder!({} as any, { dx: 60, dy: 4 } as any)).toBe(false);
  expect(handlers.onMoveShouldSetPanResponder!({} as any, { dx: 2, dy: 100 } as any)).toBe(true);
  await act(async () => handlers.onPanResponderRelease!({} as any, { dx: 2, dy: 110, vy: 1 } as any));
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => { await jest.advanceTimersByTimeAsync(300); });
  expect(onClose).toHaveBeenCalledTimes(1);
  await act(async () => tree.update(<BottomSheet visible title="Sheet" busy onClose={onClose}><Text>Contents</Text></BottomSheet>));
  await act(async () => tree.root.findByType(Modal).props.onRequestClose());
  await act(async () => { await jest.advanceTimersByTimeAsync(300); });
  expect(onClose).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
  spy.mockRestore();
});

test("delete cancel uses the translucent secondary color and 30/70 button layout", async () => {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<DeleteSheet visible label="Entry" busy={false} onCancel={jest.fn()} onConfirm={jest.fn()} />); });
  const actions = tree.root.findAllByType(Action);
  const cancel = actions.find(n => n.props.title === "Cancel")!;
  const remove = actions.find(n => n.props.title === "Delete")!;
  expect(cancel.props.variant).toBe("secondary");
  expect(cancel.parent!.props.style.flex).toBe(3);
  expect(remove.parent!.props.style.flex).toBe(7);
  expect(tree.root.findAllByType(FeedbackPressable).length).toBe(2);
  await act(async () => tree.unmount());
});


test("clear controls are hidden for empty inputs and clear a populated label", async () => {
  const change = jest.fn();
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Input value="" accessibilityLabel="Label" onChangeText={change} />); });
  expect(tree.root.findAllByType(FeedbackPressable)).toHaveLength(0);
  await act(async () => tree.update(<Input value="Shop" accessibilityLabel="Label" onChangeText={change} />));
  const clear = tree.root.findByType(FeedbackPressable);
  expect(clear.props.accessibilityLabel).toBe("Clear Label");
  await act(async () => clear.props.onPress());
  expect(change).toHaveBeenCalledWith("");
  await act(async () => tree.update(<Input value="" accessibilityLabel="Label" onChangeText={change} />));
  expect(tree.root.findAllByType(FeedbackPressable)).toHaveLength(0);
  await act(async () => tree.unmount());
});
