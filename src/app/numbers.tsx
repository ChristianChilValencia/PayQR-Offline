import React from "react";
import { useApp } from "../../App";
import { Numbers } from "../screens/Numbers";
export default function NumbersRoute() {
  const app = useApp();
  return <Numbers link={app.record.link} report={app.report} />;
}
