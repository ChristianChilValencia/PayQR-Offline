import React from "react";
import { useApp } from "../../App";
import { Settings } from "../screens/Settings";
export default function SettingsRoute() {
  const app = useApp();
  return (
    <Settings
      link={app.record.link}
      save={(link) => app.patch((r) => ({ ...r, link }))}
      report={app.report}
    />
  );
}
