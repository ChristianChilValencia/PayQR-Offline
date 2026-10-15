import React from "react";
import { Tabs } from "expo-router";
import { Text } from "react-native";
import { AppProvider } from "../../App";
export default function RootLayout() {
  return (
    <AppProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          lazy: false,
          freezeOnBlur: false,
          tabBarActiveTintColor: "#ffffff",
          tabBarInactiveTintColor: "#b8cbe7",
          tabBarActiveBackgroundColor: "#075cce",
          tabBarStyle: { backgroundColor: "#11274a", height: 64 },
          tabBarLabelStyle: { fontFamily: "RobotoMedium", fontSize: 13 },
          tabBarItemStyle: { minHeight: 56 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Payment QR",
            tabBarIcon: ({ color }) => (
              <Text style={{ color, fontSize: 22 }}>▦</Text>
            ),
          }}
        />
        <Tabs.Screen
          name="numbers"
          options={{
            title: "Scan Number",
            tabBarIcon: ({ color }) => (
              <Text style={{ color, fontSize: 22 }}>09</Text>
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color }) => (
              <Text style={{ color, fontSize: 22 }}>⚙</Text>
            ),
          }}
        />
      </Tabs>
    </AppProvider>
  );
}
