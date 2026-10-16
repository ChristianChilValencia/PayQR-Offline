import React from "react";
import { act, create, ReactTestRenderer } from "react-test-renderer";
import { RecordV1, initial, migrate, hydrate, saveNumber, SerialStore } from "../src/domain/state";
import { saveRecipient } from "../src/domain/import";
import { money, validateQR } from "../src/domain/core";
import { fixture } from "./fixture";
import { SavedList, SavedRow, pageBounds } from "../src/screens/SavedList";
import { Action } from "../src/screens/common";
import { paymentSnapshot, PaymentCard } from "../src/screens/Payment";
import { PanResponder, Text, View } from "react-native";
jest.mock("../src/services/platform", () => ({ savePNG: jest.fn(), sharePNG: jest.fn() }));

test("labels survive persistence, duplicate imports, legacy migration and rescanning", async () => {
  const payload = fixture();
  let record: RecordV1 = saveRecipient(initial, { payload, validation: validateQR(payload), label: "  Shop  " }).record;
  const active = record.activeQR;
  record = saveRecipient(record, { payload, validation: validateQR(payload) }).record;
  expect(record.qrs).toHaveLength(1);
  expect(record.recipient?.label).toBe("Shop");
  expect(record.activeQR).toBe(active);
  record = saveNumber(record, "09171234567", "manual", "  Owner  ");
  record = saveNumber(record, "09171234567", "scanned");
  let raw = "";
  await new SerialStore(async value => { raw = value; }).save(record);
  const restored = migrate(hydrate(raw));
  expect(restored.recipient?.label).toBe("Shop");
  expect(restored.recipient?.payload).toBe(payload);
  expect(restored.numbers?.[0].label).toBe("Owner");
  expect(saveNumber(restored, "09171234567", "manual", " ").numbers?.[0].label).toBeUndefined();
  expect(migrate({ ...initial, recipient: { payload, validation: validateQR(payload), image: "file:///legacy" } }).recipient?.label).toBeUndefined();
});

test("export hides only zero amounts while the Receive preview keeps its amount", async () => {
  const payload = fixture();
  const recipient = { payload, validation: validateQR(payload), label: "Shop" };
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<PaymentCard snapshot={paymentSnapshot(recipient, 0)} hideZeroAmount />); });
  const texts = () => tree.root.findAllByType(Text).map(n => n.props.children);
  expect(texts()).not.toContain(money(0));
  expect(texts()).toContain("Shop");
  await act(async () => tree.update(<PaymentCard snapshot={paymentSnapshot(recipient, 0)} />));
  expect(texts()).toContain(money(0));
  await act(async () => tree.update(<PaymentCard snapshot={paymentSnapshot(recipient, 102)} hideZeroAmount />));
  expect(texts()).toContain(money(102));
  await act(async () => tree.unmount());
});

test("zero export preserves original payload and renders label inside captured card", async () => {
  const payload = fixture();
  const snapshot = paymentSnapshot({ payload, validation: validateQR(payload), label: "Shop" }, 0);
  expect(snapshot.payload).toBe(payload);
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<PaymentCard snapshot={snapshot} />); });
  expect(tree.root.findAllByType(Text).some(n => n.props.children === "Shop")).toBe(true);
  await act(async () => tree.unmount());
});

test.each([0, 5, 6, 11])("pagination bounds for %i items", count => {
  expect(pageBounds(count, 99)).toEqual({ page: Math.max(0, Math.ceil(count / 5) - 1), pages: Math.max(1, Math.ceil(count / 5)) });
});

test("deleting last page clamps pagination and does not restore a stale page", async () => {
  let tree!: ReactTestRenderer;
  const render = (n: number) => <Text key={n}>{n}</Text>;
  await act(async () => { tree = create(<SavedList items={Array.from({ length: 11 }, (_, i) => i)} render={render} />); });
  const next = () => tree.root.findAllByType(Action).find(n => n.props.title === "Next")!;
  await act(async () => next().props.onPress());
  await act(async () => next().props.onPress());
  expect(tree.root.findAllByType(Text).some(n => n.props.children === 10)).toBe(true);
  await act(async () => tree.update(<SavedList items={Array.from({ length: 10 }, (_, i) => i)} render={render} />));
  expect(tree.root.findAllByType(Text).some(n => n.props.children === 5)).toBe(true);
  expect(next().props.disabled).toBe(true);
  await act(async () => tree.unmount());
});

test("saved rows ignore vertical drags and expose accessible edit/delete actions", async () => {
  const spy = jest.spyOn(PanResponder, "create");
  const reveal = jest.fn(), edit = jest.fn(), remove = jest.fn();
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<SavedRow open={false} reveal={reveal} edit={edit} remove={remove}><Text>Item</Text></SavedRow>); });
  const row = tree.root.findAllByType(View).find(n => n.props.accessibilityActions)!;
  await act(async () => row.props.onAccessibilityAction({ nativeEvent: { actionName: "edit" } }));
  await act(async () => row.props.onAccessibilityAction({ nativeEvent: { actionName: "delete" } }));
  expect(edit).toHaveBeenCalledTimes(1);
  expect(remove).toHaveBeenCalledTimes(1);
  const handlers = spy.mock.calls[spy.mock.calls.length - 1][0];
  expect(handlers.onMoveShouldSetPanResponder!({} as any, { dx: 10, dy: 100 } as any)).toBe(false);
  expect(handlers.onMoveShouldSetPanResponder!({} as any, { dx: -60, dy: 4 } as any)).toBe(true);
  await act(async () => handlers.onPanResponderRelease!({} as any, { dx: -60, dy: 4 } as any));
  expect(reveal).toHaveBeenCalledWith(true);
  spy.mockRestore();
  await act(async () => tree.unmount());
});

test.each([0, 1, 5, 6])("pagination remains visible for %i saved entries", async count => {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<SavedList items={Array.from({ length: count }, (_, i) => i)} render={n => <Text key={n}>{n}</Text>} />); });
  const actions = tree.root.findAllByType(Action);
  expect(actions.find(n => n.props.title === "Previous")!.props.disabled).toBe(true);
  expect(actions.find(n => n.props.title === "Previous")!.props.icon).toBe("previous");
  expect(actions.find(n => n.props.title === "Previous")!.props.variant).toBe("outline");
  expect(actions.find(n => n.props.title === "Next")!.props.iconRight).toBe("next");
  expect(actions.find(n => n.props.title === "Next")!.props.variant).toBe("outline");
  expect(actions.find(n => n.props.title === "Next")!.props.disabled).toBe(count <= 5);
  await act(async () => tree.unmount());
});

test("swipe actions are full-height icon tiles with no three-dot control", async () => {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<SavedRow open reveal={jest.fn()} edit={jest.fn()} remove={jest.fn()} label="Shop"><Text>Item</Text></SavedRow>); });
  const actions = tree.root.findAllByType(Action);
  expect(actions.map(n => [n.props.title, n.props.icon, n.props.layout])).toEqual([["Edit Label", "edit", "tile"], ["Delete", "trash", "tile"]]);
  expect(tree.root.findAll(n => n.props.accessibilityLabel === "Show saved item actions" || n.props.accessibilityLabel === "Hide saved item actions")).toHaveLength(0);
  await act(async () => tree.unmount());
});
