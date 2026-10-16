import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Animated, Easing, Keyboard, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppIcon, IconName } from "./icons";
import { styles as s } from "./common";

export type BottomSheetHandle = { close: () => void };

/** Only translation and backdrop opacity animate; dismissal finishes before hiding the Modal. */
export function BottomSheet({ visible, onClose, busy = false, title, children, tall = false, backdropLabel = "Dismiss sheet", icon = "settings", ref }: {
  icon?: IconName; ref?: React.Ref<BottomSheetHandle>; visible: boolean; onClose: () => void; busy?: boolean; title: string; children: React.ReactNode; tall?: boolean; backdropLabel?: string;
}) {
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(false);
  const [offset] = useState(() => new Animated.Value(height));
  const [shade] = useState(() => new Animated.Value(0));
  const closing = useRef(false);
  const shown = useRef(false);
  const latestClose = useRef(onClose);
  const latestHeight = useRef(height);
  useEffect(() => { latestClose.current = onClose; latestHeight.current = height; }, [onClose, height]);
  const close = useCallback((notify: boolean) => {
    if (closing.current) return;
    closing.current = true;
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(offset, { toValue: latestHeight.current, duration: 190, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(shade, { toValue: 0, duration: 190, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (!finished) return;
      shown.current = false;
      setMounted(false);
      closing.current = false;
      if (notify) latestClose.current();
    });
  }, [offset, shade]);
  useEffect(() => {
    if (!visible && mounted) close(false);
  }, [visible, mounted, close]);
  useEffect(() => () => { offset.stopAnimation(); shade.stopAnimation(); }, [offset, shade]);
  useImperativeHandle(ref, () => ({ close: () => close(true) }), [close]);
  function dismiss() { if (!busy) close(true); }
  function settle() { Animated.spring(offset, { toValue: 0, damping: 24, stiffness: 260, mass: 0.8, useNativeDriver: true }).start(); }
  // PanResponder stores these callbacks; ref reads occur only in later gesture events.
  // eslint-disable-next-line react-hooks/refs
  const drag = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => !busy && g.dy > 8 && g.dy > Math.abs(g.dx) * 1.3,
    onPanResponderGrant: () => offset.stopAnimation(),
    onPanResponderMove: (_, g) => offset.setValue(Math.max(0, g.dy)),
    onPanResponderRelease: (_, g) => { if (g.dy > 90 || (g.dy > 24 && g.vy > 0.8)) dismiss(); else settle(); },
    onPanResponderTerminate: settle,
  });
  return <Modal transparent visible={visible || mounted} animationType="none" hardwareAccelerated statusBarTranslucent onRequestClose={dismiss} onShow={() => {
    if (shown.current) return;
    shown.current = true;
    closing.current = false;
    setMounted(true);
    offset.setValue(height);
    shade.setValue(0);
    Animated.parallel([
      Animated.timing(offset, { toValue: 0, duration: 230, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(shade, { toValue: 1, duration: 230, useNativeDriver: true }),
    ]).start();
  }}>
    <KeyboardAvoidingView style={{ flex: 1, justifyContent: "flex-end" }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#000", opacity: shade.interpolate({ inputRange: [0, 1], outputRange: [0, 0.42] }) }]} />
      <Pressable accessibilityRole="button" accessibilityLabel={backdropLabel} disabled={busy} onPress={dismiss} style={StyleSheet.absoluteFill} />
      <Animated.View {...drag.panHandlers} style={{ height: tall ? "85%" : undefined, maxHeight: "92%", backgroundColor: "#EBEBEC", borderTopLeftRadius: 24, borderTopRightRadius: 24, transform: [{ translateY: offset }] }}>
        <SafeAreaView edges={["bottom"]} style={{ padding: 18, gap: 14, ...(tall ? { flex: 1 } : {}) }}>
          <View testID="sheet-drag-handle" accessibilityLabel="Swipe down to dismiss" style={{ minHeight: 60, gap: 14, paddingTop: 4 }}>
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: "#9bb1cd", alignSelf: "center" }} />
            <View style={s.row}><AppIcon name={icon} size={26} color="#075cce" /><Text style={[s.sectionTitle, { flex: 1 }]}>{title}</Text></View>
          </View>
          {children}
        </SafeAreaView>
      </Animated.View>
    </KeyboardAvoidingView>
  </Modal>;
}
