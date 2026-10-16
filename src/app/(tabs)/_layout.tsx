import React, { createRef, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { BlurTargetView, BlurView } from "expo-blur";
import { AppIcon, IconName } from "../../screens/icons";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FooterInsetContext } from "../../screens/footerInset";
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 12);
  const targets = useMemo<Record<string, React.RefObject<View | null>>>(() => ({
    index: createRef<View>(), numbers: createRef<View>(), settings: createRef<View>(),
  }), []);
  return (
    <Tabs
      initialRouteName="index"
      screenLayout={({ children, route }) => (
        <BlurTargetView ref={targets[route.name]} style={{ flex: 1 }}>
          <FooterInsetContext.Provider value={64 + bottom + 12}>{children}</FooterInsetContext.Provider>
        </BlurTargetView>
      )}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: "#075cce",
        tabBarBackground: () => (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.65)" }]}>
            <BlurView blurTarget={targets[route.name]} blurMethod="dimezisBlurViewSdk31Plus" tint="light" intensity={35} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.28)" }]} />
          </View>
        ),
        tabBarStyle: {
          position: "absolute",
          left: 14,
          right: 14,
          bottom,
          height: 64,
          paddingBottom: 6,
          paddingTop: 6,
          borderRadius: 24,
          borderTopWidth: 0,
          backgroundColor: "transparent",
          elevation: 0,
          shadowColor: "#11274a",
          shadowOpacity: 0.12,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
        },
      })}
    >
      {[
        ["index", "Receive", "qr"],
        ["numbers", "Pay", "pay"],
        ["settings", "Settings", "settings"],
      ].map(([name, title, icon]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color }) => (
              <AppIcon name={icon as IconName} color={color} size={24} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
