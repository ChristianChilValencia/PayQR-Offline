import React from "react";
import { useApp } from "../../App";
import { Payment } from "../screens/Payment";
export default function PaymentRoute() {
  const app = useApp();
  return (
    <Payment
      record={app.record}
      update={(r) => app.patch((current) => ({ ...current, cents: r.cents }))}
      importQR={() => {
        void app.importQR();
      }}
      busy={app.busy}
      cancel={app.cancel}
      report={app.report}
    />
  );
}
