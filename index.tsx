import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { CinematicScreen } from "@/components/cinematic-screen";
import { ActionButton, BrandMark, Card, Pill, ScreenHeading, palette } from "@/components/movie-ui";
import { useAppState } from "@/lib/app-state";
import { getCopy } from "@/lib/i18n";

export default function HomeScreen() {
  const router = useRouter();
  const { language, setDraft } = useAppState();
  const copy = getCopy(language);

  return (
    <CinematicScreen>
      <View style={styles.topline}>
        <View style={styles.brandRow}>
          <BrandMark size={40} />
          <View>
            <Text style={styles.brandName}>{copy.appName}</Text>
            <Text style={styles.brandSub}>{copy.onboardingLabel}</Text>
          </View>
        </View>
        <View style={styles.brandAccent} />
      </View>

      <View style={styles.hero}>
        <Pill tone="violet"><Text style={styles.pillText}>TEXT STORY STUDIO</Text></Pill>
        <ScreenHeading title={copy.tagline} subtitle={copy.intro} />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => { setDraft(null); router.push("/narrator"); }}
        style={({ pressed }) => [styles.featureCard, styles.narratorCard, pressed && styles.pressed]}
      >
        <View style={styles.featureIcon}><Ionicons name="film-outline" size={23} color="#C7BDFF" /></View>
        <View style={styles.featureText}>
          <Text style={styles.featureTitle}>{copy.movieNarrator}</Text>
          <Text style={styles.featureDesc}>{copy.movieNarratorDesc}</Text>
        </View>
        <Ionicons name="arrow-forward" size={18} color="#BFAEFF" />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/kikivoice")}
        style={({ pressed }) => [styles.featureCard, styles.kikiCard, pressed && styles.pressed]}
      >
        <View style={[styles.featureIcon, styles.kikiIcon]}><Ionicons name="open-outline" size={22} color="#9BC6FF" /></View>
        <View style={styles.featureText}>
          <Text style={styles.featureTitle}>{copy.kikiVoice}</Text>
          <Text style={styles.featureDesc}>{copy.kikiDesc}</Text>
        </View>
        <Ionicons name="arrow-forward" size={18} color="#9BC6FF" />
      </Pressable>

      <Card style={styles.localCard}>
        <View style={styles.localIcon}><Ionicons name="document-text-outline" size={18} color="#8BC2FF" /></View>
        <View style={styles.localText}>
          <Text style={styles.localTitle}>{copy.startWriting}</Text>
          <Text style={styles.localDesc}>{copy.textOnly}</Text>
        </View>
      </Card>

      <ActionButton
        label={copy.viewHistory}
        icon="time-outline"
        variant="quiet"
        onPress={() => router.push("/history")}
        style={styles.historyButton}
      />
      <Text style={styles.footerNote}>MOVIE RECAP VOICE · EN / မြန်မာ</Text>
    </CinematicScreen>
  );
}

const styles = StyleSheet.create({
  topline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 42 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  brandName: { color: palette.text, fontSize: 15, fontWeight: "800" },
  brandSub: { color: "#8791AE", fontSize: 9, letterSpacing: 1.7, marginTop: 4 },
  brandAccent: { width: 36, height: 2, borderRadius: 2, backgroundColor: palette.violet },
  hero: { marginBottom: 12 },
  pillText: { color: "#C7B9FF", fontSize: 9, letterSpacing: 1.5, fontWeight: "800" },
  featureCard: {
    minHeight: 106,
    borderRadius: 22,
    borderWidth: 1,
    padding: 17,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    marginTop: 14,
  },
  narratorCard: { backgroundColor: "rgba(31, 28, 67, 0.80)", borderColor: "rgba(151, 126, 255, 0.32)" },
  kikiCard: { backgroundColor: "rgba(21, 34, 57, 0.76)", borderColor: "rgba(93, 151, 235, 0.25)" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  featureIcon: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "rgba(139, 92, 255, 0.22)" },
  kikiIcon: { backgroundColor: "rgba(76, 141, 255, 0.18)" },
  featureText: { flex: 1, gap: 5 },
  featureTitle: { color: palette.text, fontSize: 17, fontWeight: "800" },
  featureDesc: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  localCard: { flexDirection: "row", alignItems: "center", gap: 13, marginTop: 21, paddingVertical: 14 },
  localIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(76, 141, 255, 0.13)" },
  localText: { flex: 1, gap: 4 },
  localTitle: { color: palette.text, fontSize: 13, fontWeight: "700" },
  localDesc: { color: palette.muted, fontSize: 11, lineHeight: 17 },
  historyButton: { marginTop: 12 },
  footerNote: { color: "#69728D", fontSize: 9, letterSpacing: 1.4, textAlign: "center", marginTop: 30 },
});
