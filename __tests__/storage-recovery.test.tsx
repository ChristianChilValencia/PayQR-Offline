import React from "react";
import { Text } from "react-native";
import { act, create, ReactTestRenderer } from "react-test-renderer";
import { AppProvider } from "../App";
import { load } from "../src/services/platform";
import { initial, migrate } from "../src/domain/state";

jest.mock("expo-font", () => ({ useFonts: () => [true, null] }));
jest.mock("../src/services/platform", () => ({ load: jest.fn(), store: { save: jest.fn() }, removeImage: jest.fn() }));
jest.mock("react-native-safe-area-context", () => {
  const View = jest.requireActual("react-native").View;
  return { SafeAreaProvider: View, SafeAreaView: View };
});
jest.mock("../src/screens/common", () => ({
  styles: { page: {}, text: {} },
  Action: ({ title, onPress }: { title: string; onPress: () => void }) =>
    jest.requireActual("react").createElement(jest.requireActual("react-native").Pressable, { accessibilityLabel: title, onPress }),
}));

test("failed history load blocks editing until a successful retry", async () => {
  jest.mocked(load).mockRejectedValueOnce(new Error("Key unavailable"))
    .mockResolvedValueOnce(migrate(initial));
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<AppProvider><Text>Editable payment screen</Text></AppProvider>);
  });
  expect(JSON.stringify(tree.toJSON())).not.toContain("Editable payment screen");
  expect(JSON.stringify(tree.toJSON())).toContain("Your data has been retained");
  await act(async () => {
    tree.root.findByProps({ accessibilityLabel: "Retry loading history" }).props.onPress();
  });
  expect(JSON.stringify(tree.toJSON())).toContain("Editable payment screen");
  await act(async () => tree.unmount());
});
