import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { CinematicScreen } from "@/components/cinematic-screen";
import { ActionButton, Card, Pill, ScreenHeading, palette } from "@/components/movie-ui";
import { useAppState } from "@/lib/app-state";
import { getCopy } from "@/lib/i18n";

export default function HistoryScreen() {
  const router = useRouter();
  const { language, history, setDraft, removeHistoryItem, clearHistory } = useAppState();
  const copy = getCopy(language);
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <CinematicScreen>
      <View style={styles.headerRow}>
        <View style={styles.headerIcon}><Ionicons name="time-outline" size={22} color="#B7A7FF" /></View>
        {history.length > 0 ? (
          <ActionButton label={copy.clearHistory} icon="trash-outline" variant="quiet" compact onPress={() => setConfirmClear(true)} />
        ) : null}
      </View>
      <ScreenHeading title={copy.history} subtitle={`${history.length} ${language === "my" ? "သိမ်းထားသော ဇာတ်လမ်းများ" : "saved retellings on this device"}`} />

      {confirmClear ? (
        <Card style={styles.confirmCard}>
          <Text style={styles.confirmText}>{copy.clearHistoryConfirm}</Text>
          <View style={styles.confirmActions}>
            <ActionButton label={copy.cancel} variant="quiet" compact onPress={() => setConfirmClear(false)} style={styles.confirmButton} />
            <ActionButton label={copy.delete} variant="danger" compact onPress={async () => { await clearHistory(); setConfirmClear(false); }} style={styles.confirmButton} />
          </View>
        </Card>
      ) : null}

      {history.length === 0 ? (
        <Card style={styles.emptyCard}>
          <View style={styles.emptyIcon}><Ionicons name="book-outline" size={24} color="#8E9ABB" /></View>
          <Text style={styles.emptyTitle}>{copy.historyEmpty}</Text>
          <Text style={styles.emptyDesc}>{language === "my" ? "သင်ဖန်တီးထားသော နမူနာနှင့် ဇာတ်လမ်းများကို ဤစက်တွင် သိမ်းထားမည်။" : "Your samples and generated stories are saved locally on this device."}</Text>
          <ActionButton label={copy.startWriting} icon="create-outline" variant="secondary" onPress={() => router.push("/narrator")} style={styles.emptyAction} />
        </Card>
      ) : (
        <View style={styles.list}>
          {history.map((item) => (
            <Card key={item.id} style={styles.historyCard}>
              <View style={styles.cardTop}>
                <View style={styles.historyIcon}><Ionicons name="document-text-outline" size={17} color="#9DBBFF" /></View>
                <View style={styles.titleColumn}>
                  <Text numberOfLines={2} style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.dateText}>{new Date(item.createdAt).toLocaleDateString(language === "my" ? "my-MM" : "en", { year: "numeric", month: "short", day: "numeric" })}</Text>
                </View>
                <Pill tone={item.mode === "sample" ? "neutral" : "violet"}>
                  <Text style={styles.modeText}>{item.mode === "sample" ? (language === "my" ? "နမူနာ" : "SAMPLE") : "GEMINI"}</Text>
                </Pill>
              </View>
              <Text numberOfLines={3} style={styles.snippet}>{item.retelling}</Text>
              <View style={styles.itemActions}>
                <ActionButton label={copy.reopen} icon="open-outline" variant="secondary" compact onPress={() => { setDraft(item); router.push("/narrator"); }} style={styles.openButton} />
                <Pressable accessibilityRole="button" accessibilityLabel={copy.removeKey} onPress={() => removeHistoryItem(item.id)} style={styles.removeButton}>
                  <Ionicons name="trash-outline" size={17} color="#C78B9A" />
                </Pressable>
              </View>
            </Card>
          ))}
        </View>
      )}
      <Text style={styles.localNote}>{language === "my" ? "မှတ်တမ်းသည် ဤစက်တွင်သာ သိမ်းဆည်းထားသည်။" : "History is stored locally on this device."}</Text>
    </CinematicScreen>
  );
}

const styles = StyleSheet.create({
  headerRow: { minHeight: 42, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  headerIcon: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(139, 92, 255, 0.16)" },
  confirmCard: { marginBottom: 15, borderColor: "rgba(255, 128, 153, 0.25)" },
  confirmText: { color: palette.text, fontSize: 14, lineHeight: 21 },
  confirmActions: { flexDirection: "row", gap: 8, marginTop: 14 },
  confirmButton: { flex: 1 },
  emptyCard: { alignItems: "center", paddingVertical: 28, marginTop: 10 },
  emptyIcon: { width: 56, height: 56, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(114, 138, 199, 0.13)" },
  emptyTitle: { color: palette.text, fontSize: 16, fontWeight: "800", textAlign: "center", marginTop: 15 },
  emptyDesc: { color: palette.muted, fontSize: 12, lineHeight: 19, textAlign: "center", marginTop: 7 },
  emptyAction: { marginTop: 18, minWidth: 180 },
  list: { gap: 12 },
  historyCard: { padding: 15 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  historyIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(76, 141, 255, 0.13)" },
  titleColumn: { flex: 1, gap: 4 },
  itemTitle: { color: palette.text, fontSize: 14, fontWeight: "700" },
  dateText: { color: "#7D88A3", fontSize: 10 },
  modeText: { color: "#BFC6D8", fontSize: 8, fontWeight: "800", letterSpacing: 0.5 },
  snippet: { color: "#AEB7CD", fontSize: 12, lineHeight: 19, marginTop: 13 },
  itemActions: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 14 },
  openButton: { flex: 1 },
  removeButton: { width: 42, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, borderWidth: 1, borderColor: "rgba(199, 139, 154, 0.20)" },
  localNote: { color: "#6F7893", fontSize: 10, textAlign: "center", marginVertical: 18 },
});
