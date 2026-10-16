import React from "react";
import { DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { AppProvider } from "../../App";
import { styles } from "../screens/common";
const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: styles.page.backgroundColor } };
export default function RootLayout() {
  return (
    <AppProvider>
      <ThemeProvider value={theme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="scan" />
        </Stack>
      </ThemeProvider>
    </AppProvider>
  );
}
