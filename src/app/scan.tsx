import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Scan } from "../screens/Scan";
export default function ScanRoute() {
  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1 }}>
      <Scan />
    </SafeAreaView>
  );
}
