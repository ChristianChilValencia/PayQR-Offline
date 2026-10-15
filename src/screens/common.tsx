import React from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  TextInput,
  TextInputProps,
} from "react-native";
export function Action({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && { opacity: 0.4 }]}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}
export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor="#63748c"
      {...props}
      style={[styles.input, props.style]}
    />
  );
}
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#eef4fc" },
  body: { padding: 18, gap: 14, paddingBottom: 30 },
  title: { fontFamily: "RobotoBold", fontSize: 30, color: "#11274a" },
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
    padding: 12,
    backgroundColor: "#075cce",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "white", fontFamily: "RobotoMedium", fontSize: 16 },
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
  error: {
    color: "#ad213d",
    fontFamily: "RobotoMedium",
    fontSize: 15,
    lineHeight: 22,
  },
});
