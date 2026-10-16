import React, { useState } from "react";
import { AppIcon, IconName } from "./icons";
import {
  Pressable,
  PressableProps,
  Text,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
/** One feedback treatment for touch, mouse and keyboard focus. */
export function FeedbackPressable({ style, onHoverIn, onHoverOut, onFocus, onBlur, ...props }: PressableProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  return <Pressable {...props}
    onHoverIn={(e) => { setHovered(true); onHoverIn?.(e); }}
    onHoverOut={(e) => { setHovered(false); onHoverOut?.(e); }}
    onFocus={(e) => { setFocused(true); onFocus?.(e); }}
    onBlur={(e) => { setFocused(false); onBlur?.(e); }}
    style={(state) => [typeof style === "function" ? style(state) : style, !props.disabled && { opacity: state.pressed ? 0.65 : hovered || focused ? 0.82 : 1 }]} />;
}

export function Action({
  title,
  onPress,
  disabled = false,
  variant = "primary",
  icon,
  layout = "row",
  iconRight,
}: {
  title: string;
  icon?: IconName;
  iconRight?: IconName;
  layout?: "row" | "tile";
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "outline" | "plain";
}) {
  return (
    <FeedbackPressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        { flexDirection: "row", gap: 7 },
        layout === "tile" && { flex: 1, borderRadius: 0, flexDirection: "column", gap: 10 },
        variant === "outline" && { backgroundColor: "transparent", borderWidth: 1, borderColor: "#9bb1cd" },
        variant === "plain" && { backgroundColor: "transparent" },
        variant === "secondary" && { backgroundColor: "rgba(7, 92, 206, 0.16)" },
        variant === "danger" && { backgroundColor: "#c52b3e" },
        disabled && { opacity: 0.4 },
      ]}
    >
      {icon && (
        <AppIcon
          name={icon}
          size={layout === "tile" ? 34 : 20}
          color={variant === "secondary" || variant === "outline" || variant === "plain" ? "#1955a6" : "white"}
        />
      )}
      <Text
        numberOfLines={layout === "tile" ? 2 : 1}
        adjustsFontSizeToFit
        style={[
          styles.buttonText,
          layout === "tile" && { textAlign: "center" },
          (variant === "secondary" || variant === "outline" || variant === "plain") && { color: "#1955a6" },
        ]}
      >
        {title}
      </Text>
      {iconRight && <AppIcon name={iconRight} size={20} color={variant === "secondary" || variant === "outline" ? "#1955a6" : "white"} />}
    </FeedbackPressable>
  );
}
export function Input({ clearLabel, clearable = true, onClear, ...props }: TextInputProps & { clearLabel?: string; clearable?: boolean; onClear?: () => void }) {
  return (
    <View style={[styles.input, { flexDirection: "row", alignItems: "center", padding: 0 }, props.style]}>
      <TextInput placeholderTextColor="#63748c" {...props} clearButtonMode="never"
        style={[styles.input, props.style, { flex: 1, minWidth: 0, borderWidth: 0, backgroundColor: "transparent", paddingHorizontal: 12 }]} />
      {clearable && !!props.value && props.onChangeText && props.editable !== false && <FeedbackPressable accessibilityRole="button" accessibilityLabel={clearLabel ?? `Clear ${props.accessibilityLabel ?? "input"}`} onPress={() => onClear ? onClear() : props.onChangeText?.("")} style={{ width: 44, minHeight: 44, flexShrink: 0, justifyContent: "center", alignItems: "center", borderRadius: 10 }}><AppIcon name="close" size={20} color="#63748c" /></FeedbackPressable>}
    </View>
  );
}
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#EBEBEC" },
  body: {
    padding: 18,
    gap: 20,
    paddingBottom: 24,
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
  },
  title: { fontFamily: "RobotoBold", fontSize: 30, color: "#11274a" },
  sectionTitle: { fontFamily: "RobotoBold", fontSize: 22, color: "#11274a" },
  subtitle: { fontFamily: "RobotoMedium", fontSize: 19, color: "#11274a" },
  text: {
    fontFamily: "RobotoRegular",
    fontSize: 16,
    lineHeight: 24,
    color: "#344b69",
  },
  card: { backgroundColor: "white", padding: 18, borderRadius: 22, gap: 14 },
  button: {
    minHeight: 48,
    borderRadius: 14,
    padding: 10,
    backgroundColor: "#075cce",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "white",
    fontFamily: "RobotoMedium",
    fontSize: 14,
    flexShrink: 1,
  },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: "#9bb1cd",
    borderRadius: 12,
    padding: 12,
    fontFamily: "RobotoRegular",
    fontSize: 18,
    color: "#11274a",
    backgroundColor: "white",
  },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  badge: {
    color: "#18744e",
    backgroundColor: "#e9f7ef",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    fontFamily: "RobotoMedium",
    fontSize: 12,
    alignSelf: "flex-start",
  },
  caption: {
    fontFamily: "RobotoRegular",
    fontSize: 12,
    lineHeight: 18,
    color: "#63748c",
  },
  empty: { alignItems: "center", paddingVertical: 28, gap: 12 },
  dock: {
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#e0e7f0",
    padding: 12,
    gap: 10,
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
  },
  error: {
    color: "#ad213d",
    fontFamily: "RobotoMedium",
    fontSize: 15,
    lineHeight: 22,
  },
});

export function SectionTitle({ children, icon = "qr" }: { children: React.ReactNode; icon?: IconName }) {
  return <View style={styles.row}><AppIcon name={icon} size={28} /><Text style={styles.sectionTitle}>{children}</Text></View>;
}
