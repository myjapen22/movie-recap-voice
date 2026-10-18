import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type PressableProps, type TextStyle, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const colors = {
  ink: "#090C18",
  card: "rgba(18, 23, 43, 0.86)",
  border: "rgba(160, 175, 220, 0.15)",
  text: "#F5F6FC",
  muted: "#A4ACC1",
  blue: "#4C8DFF",
  violet: "#8B5CFF",
};

export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <View style={[styles.brandMark, { width: size, height: size, borderRadius: size * 0.3 }]}>
      <Ionicons name="film-outline" size={size * 0.56} color="#E8E3FF" />
      <View style={styles.brandDot} />
    </View>
  );
}

export function ScreenHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.headingWrap}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text> : null}
      <Text style={styles.heading}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export type ActionIconName = ComponentProps<typeof Ionicons>["name"];

interface ActionButtonProps extends Omit<PressableProps, "style"> {
  label: string;
  icon?: ActionIconName;
  variant?: "primary" | "secondary" | "quiet" | "danger";
  compact?: boolean;
  style?: ViewStyle;
  labelStyle?: TextStyle;
}

export function ActionButton({
  label,
  icon,
  variant = "primary",
  compact = false,
  style,
  labelStyle,
  disabled,
  ...props
}: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        styles[`button_${variant}`],
        compact && styles.buttonCompact,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
        style,
      ]}
      {...props}
    >
      {icon ? <Ionicons name={icon} size={compact ? 16 : 18} color={variant === "primary" ? "#FFFFFF" : colors.text} /> : null}
      <Text style={[styles.buttonLabel, variant === "quiet" && styles.buttonQuietLabel, labelStyle]}>{label}</Text>
    </Pressable>
  );
}

export function Pill({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "violet" | "neutral" }) {
  return <View style={[styles.pill, styles[`pill_${tone}`]]}>{children}</View>;
}

export const palette = colors;

const styles = StyleSheet.create({
  brandMark: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(121, 94, 255, 0.22)",
    borderWidth: 1,
    borderColor: "rgba(186, 169, 255, 0.36)",
  },
  brandDot: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    right: 6,
    top: 6,
    backgroundColor: colors.violet,
  },
  headingWrap: { marginBottom: 22, gap: 7 },
  eyebrow: { color: "#9CA8CE", fontSize: 10, letterSpacing: 2.2, fontWeight: "800" },
  heading: { color: colors.text, fontSize: 27, lineHeight: 34, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 18,
  },
  button: {
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: "transparent",
  },
  button_primary: { backgroundColor: "#694FE0", borderColor: "rgba(203, 189, 255, 0.24)" },
  button_secondary: { backgroundColor: "rgba(25, 34, 62, 0.94)", borderColor: "rgba(111, 145, 221, 0.30)" },
  button_quiet: { backgroundColor: "transparent", borderColor: colors.border },
  button_danger: { backgroundColor: "rgba(114, 38, 61, 0.30)", borderColor: "rgba(255, 128, 153, 0.28)" },
  buttonCompact: { minHeight: 40, paddingHorizontal: 13, borderRadius: 13 },
  buttonDisabled: { opacity: 0.48 },
  buttonPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  buttonLabel: { color: colors.text, fontSize: 14, fontWeight: "700" },
  buttonQuietLabel: { color: "#D6DAE8" },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, alignSelf: "flex-start" },
  pill_blue: { backgroundColor: "rgba(76, 141, 255, 0.15)" },
  pill_violet: { backgroundColor: "rgba(139, 92, 255, 0.18)" },
  pill_neutral: { backgroundColor: "rgba(166, 176, 203, 0.12)" },
});
