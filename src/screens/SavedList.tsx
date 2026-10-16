import React, { useEffect, useState } from "react";
import { Animated, PanResponder, Text, View } from "react-native";
import { Action, styles as s } from "./common";

export function SavedRow({ children, open, reveal, remove, edit, label }: { children: React.ReactNode; open: boolean; reveal: (open: boolean) => void; remove: () => void; edit?: () => void; label?: string }) {
  const width = edit ? 196 : 98;
  const [offset] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.spring(offset, { toValue: open ? -width : 0, damping: 26, stiffness: 290, mass: 0.8, useNativeDriver: true }).start();
    return () => offset.stopAnimation();
  }, [open, width, offset]);
  const pan = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderGrant: () => offset.stopAnimation(),
    onPanResponderMove: (_, g) => offset.setValue(Math.max(-width, Math.min(0, (open ? -width : 0) + g.dx))),
    onPanResponderRelease: (_, g) => {
      const next = open ? g.dx < 45 : g.dx < -45;
      reveal(next);
      Animated.spring(offset, { toValue: next ? -width : 0, damping: 26, stiffness: 290, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => Animated.spring(offset, { toValue: open ? -width : 0, useNativeDriver: true }).start(),
  });
  return <View style={{ overflow: "hidden", borderRadius: 22 }} accessibilityActions={[{ name: "delete", label: "Delete" }, ...(edit ? [{ name: "edit", label: label ? "Edit Label" : "Add Label" }] : [])]} onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === "delete") remove(); else if (e.nativeEvent.actionName === "edit") edit?.(); }}>
    <View pointerEvents={open ? "auto" : "none"} accessibilityElementsHidden={!open} importantForAccessibility={open ? "auto" : "no-hide-descendants"} style={{ position: "absolute", top: 0, right: 0, bottom: 0, width, flexDirection: "row", alignItems: "stretch", backgroundColor: "#e2eaf5" }}>
      {edit && <View style={{ flex: 1 }}><Action icon="edit" layout="tile" title={label ? "Edit Label" : "Add Label"} variant="secondary" onPress={edit} /></View>}
      <View style={{ flex: 1 }}><Action layout="tile" title="Delete" icon="trash" variant="danger" onPress={remove} /></View>
    </View>
    <Animated.View {...pan.panHandlers} style={{ backgroundColor: "white", transform: [{ translateX: offset }] }}>
      {children}

    </Animated.View>
  </View>;
}

export function pageBounds(count: number, requested: number) {
  const pages = Math.max(1, Math.ceil(count / 5));
  return { page: Math.max(0, Math.min(requested, pages - 1)), pages };
}
export function SavedList<T>({ items, render }: { items: T[]; render: (item: T) => React.ReactNode }) {
  const [requested, setPage] = useState(0);
  const { page, pages } = pageBounds(items.length, requested);
  if (page !== requested) setPage(page);
  return <View style={{ gap: 12 }}>{items.slice(page * 5, page * 5 + 5).map(render)}{<View style={s.row}><View style={{ flex: 1 }}><Action title="Previous" icon="previous" variant="outline" disabled={page === 0} onPress={() => setPage(page - 1)} /></View><Text style={s.caption}>{page + 1} / {pages}</Text><View style={{ flex: 1 }}><Action title="Next" iconRight="next" variant="outline" disabled={page === pages - 1} onPress={() => setPage(page + 1)} /></View></View>}</View>;
}
