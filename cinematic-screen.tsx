import { ScrollView, StyleSheet, View, useWindowDimensions, type ScrollViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from "react-native-svg";

export function CinematicBackdrop() {
  const { width, height } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height} viewBox={`0 0 ${Math.max(width, 1)} ${Math.max(height, 1)}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="cinema-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#0B1020" />
            <Stop offset="52%" stopColor="#090C18" />
            <Stop offset="100%" stopColor="#111024" />
          </LinearGradient>
          <LinearGradient id="cinema-glow" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#4C8DFF" stopOpacity="0.22" />
            <Stop offset="100%" stopColor="#8B5CFF" stopOpacity="0.05" />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#cinema-bg)" />
        <Circle cx={width * 0.92} cy={height * 0.08} r={width * 0.52} fill="url(#cinema-glow)" />
        <Circle cx={width * 0.04} cy={height * 0.65} r={width * 0.38} fill="#5140A6" fillOpacity="0.08" />
      </Svg>
    </View>
  );
}

interface CinematicScreenProps {
  children: React.ReactNode;
  contentContainerStyle?: ScrollViewProps["contentContainerStyle"];
  scroll?: boolean;
}

export function CinematicScreen({ children, contentContainerStyle, scroll = true }: CinematicScreenProps) {
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width - 36, 640);
  return (
    <View style={styles.root}>
      <CinematicBackdrop />
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.content,
              { width: contentWidth, alignSelf: "center" },
              contentContainerStyle,
            ]}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, { width: contentWidth, alignSelf: "center" }, contentContainerStyle]}>
            {children}
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#090C18" },
  safe: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 104 },
});
