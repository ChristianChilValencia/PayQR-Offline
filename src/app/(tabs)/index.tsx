import React from "react";
import { router } from "expo-router";
import { useApp } from "../../../App";
import { Payment } from "../../screens/Payment";
export default function QRRoute() {
  const app = useApp();
  return (
    <Payment
      record={app.record}
      update={(r) => app.patch((current) => ({ ...current, cents: r.cents }))}
      importQR={() => router.navigate("/settings")}
      busy={false}
      cancel={app.cancel}
      report={app.report}
    />
  );
}
