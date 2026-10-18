import { useState } from "react";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";

import { CinematicScreen } from "@/components/cinematic-screen";
import { ActionButton, Card, ScreenHeading, palette } from "@/components/movie-ui";
import { useAppState } from "@/lib/app-state";
import { getCopy } from "@/lib/i18n";

const KIKI_URL = "https://kikivoice.ai/";

export default function KikiVoiceScreen() {
  const router = useRouter();
  const { language } = useAppState();
  const copy = getCopy(language);
  const [error, setError] = useState(false);

  const openWebsite = async () => {
    try {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") window.open(KIKI_URL, "_blank", "noopener,noreferrer");
      } else {
        await WebBrowser.openBrowserAsync(KIKI_URL);
      }
      setError(false);
    } catch {
      setError(true);
      await Linking.openURL(KIKI_URL).catch(() => undefined);
    }
  };

  return (
    <CinematicScreen>
      <ActionButton label={copy.home} icon="arrow-back-outline" variant="quiet" compact onPress={() => router.back()} style={styles.backButton} />
      <View style={styles.heroIcon}><Ionicons name="open-outline" size={30} color="#9CC5FF" /></View>
      <ScreenHeading title={copy.kikiVoice} subtitle={copy.kikiDesc} />
      <Card style={styles.infoCard}>
        <Text style={styles.infoTitle}>{copy.externalSite}</Text>
        <Text style={styles.infoText}>{language === "my" ? "ဤခလုတ်သည် kikivoice.ai ကို သင့်ဘရောက်ဇာတွင် ဖွင့်ပေးမည်။ ဤအက်ပ်ထဲသို့ key သို့မဟုတ် စာသား မပေးပို့ပါ။ ပြင်ပဝန်ဆောင်မှု၏ စည်းကမ်းနှင့် စျေးနှုန်းများ သက်ဆိုင်ပါသည်။" : "This button opens kikivoice.ai in your browser. No key or transcript is sent from this app. The external service has its own terms and pricing."}</Text>
        <Text style={styles.infoText}>{copy.textOnly}</Text>
        <ActionButton label={copy.openKiki} icon="open-outline" onPress={openWebsite} style={styles.openButton} />
        {error ? <Text style={styles.errorText}>{language === "my" ? "ဝက်ဘ်ဆိုက်ကို မဖွင့်နိုင်ပါ။ လင့်ခ်ကို ကူးယူ၍ ဘရောက်ဇာတွင် ဖွင့်ပါ။" : "Could not open the website. Copy the link and open it in your browser."}</Text> : null}
      </Card>
      <Text style={styles.url}>{KIKI_URL}</Text>
    </CinematicScreen>
  );
}

const styles = StyleSheet.create({
  backButton: { alignSelf: "flex-start", marginBottom: 24 },
  heroIcon: { width: 68, height: 68, borderRadius: 24, backgroundColor: "rgba(76, 141, 255, 0.16)", borderWidth: 1, borderColor: "rgba(114, 161, 239, 0.27)", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  infoCard: { gap: 10 },
  infoTitle: { color: palette.text, fontSize: 14, fontWeight: "800" },
  infoText: { color: "#A9B2C8", fontSize: 12, lineHeight: 19 },
  openButton: { marginTop: 7 },
  errorText: { color: "#FFC7B7", fontSize: 11, lineHeight: 17 },
  url: { color: "#71809D", fontSize: 11, textAlign: "center", marginTop: 14 },
});
