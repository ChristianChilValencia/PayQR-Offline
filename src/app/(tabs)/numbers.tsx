import React from "react";
import { useLocalSearchParams } from "expo-router";
import { useApp } from "../../../App";
import { Numbers } from "../../screens/Numbers";
import { saveApp, saveNumber } from "../../domain/state";
export default function NumberRoute() {
  const app = useApp();
  const { number, selection } = useLocalSearchParams<{
    number?: string;
    selection?: string;
  }>();
  return (
    <Numbers
      savedNumbers={app.record.numbers?.map((n) => n.number)}
      savedEntries={app.record.numbers}
      saveApp={(link) => app.patch((r) => saveApp(r, link))}
      selectionKey={selection}
      selected={number}
      link={app.record.link}
      report={app.report}
      save={(n, label) => app.patch((r) => saveNumber(r, n, "manual", label))}
    />
  );
}
