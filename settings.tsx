import { useCallback, useEffect, useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { CinematicScreen } from "@/components/cinematic-screen";
import { ActionButton, Card, Pill, ScreenHeading, palette } from "@/components/movie-ui";
import { useAppState } from "@/lib/app-state";
import { GEMINI_MODEL_ID } from "@/lib/gemini-client";
import { getCopy } from "@/lib/i18n";
import { addGeminiKey, getVaultStatus, removeGeminiKey, selectGeminiKey, type GeminiKeySummary } from "@/lib/key-vault";

const AI_STUDIO_KEYS_URL = "https://aistudio.google.com/apikey";

export default function SettingsScreen() {
  const { language, setLanguage, history } = useAppState();
  const copy = getCopy(language);
  const [supported, setSupported] = useState(false);
  const [keys, setKeys] = useState<GeminiKeySummary[]>([]);
  const [quotaBlockedUntil, setQuotaBlockedUntil] = useState<number | null>(null);
  const [keyLabel, setKeyLabel] = useState("");
  const [keyValue, setKeyValue] = useState("");
  const [freeTierConfirmed, setFreeTierConfirmed] = useState(false);
  const [notice, setNotice] = useState("");

  const refreshVault = useCallback(async () => {
    try {
      const status = await getVaultStatus();
      setSupported(status.supported);
      setKeys(status.keys);
      setQuotaBlockedUntil(status.quotaBlockedUntil);
    } catch {
      setSupported(Platform.OS !== "web");
      setKeys([]);
      setQuotaBlockedUntil(null);
      setNotice(copy.keyStorageError);
    }
  }, [copy.keyStorageError]);

  useEffect(() => {
    const timer = setTimeout(() => { void refreshVault(); }, 0);
    return () => clearTimeout(timer);
  }, [refreshVault]);

  const submitKey = async () => {
    const result = await addGeminiKey({ label: keyLabel, value: keyValue, freeTierConfirmed });
    if (result === "added") {
      setKeyValue("");
      setKeyLabel("");
      setFreeTierConfirmed(false);
      setNotice(copy.keyAdded);
      await refreshVault();
    } else if (result === "duplicate") setNotice(copy.keyDuplicate);
    else if (result === "limit") setNotice(copy.keyLimit);
    else if (result === "invalid") setNotice(copy.keyInvalid);
    else if (result === "unconfirmed") setNotice(copy.keyNeedsConfirmation);
    else setNotice(Platform.OS === "web" ? copy.unsupportedKeyStorage : copy.keyStorageError);
  };

  const chooseKey = async (id: string) => {
    const selected = await selectGeminiKey(id);
    setNotice(selected ? "" : Platform.OS === "web" ? copy.unsupportedKeyStorage : copy.keyStorageError);
    await refreshVault();
  };

  const removeKey = async (id: string) => {
    try {
      await removeGeminiKey(id);
      setNotice(copy.keyRemoved);
      await refreshVault();
    } catch {
      setNotice(copy.keyStorageError);
    }
  };

  const changeLanguage = async (next: "en" | "my") => {
    setNotice("");
    await setLanguage(next);
  };

  return (
    <CinematicScreen>
      <View style={styles.headerIcon}><Ionicons name="options-outline" size={22} color="#B7A7FF" /></View>
      <ScreenHeading title={copy.settings} subtitle={language === "my" ? "ဘာသာစကား၊ Gemini key နှင့် ကိုယ်ရေးလုံခြုံမှုကို စီမံပါ။" : "Manage language, Gemini keys, and privacy on this device."} />

      <Card style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{copy.chooseLanguage}</Text>
        <View style={styles.languageRow}>
          <ActionButton label={copy.english} variant={language === "en" ? "primary" : "secondary"} compact onPress={() => changeLanguage("en")} style={styles.languageButton} />
          <ActionButton label={copy.burmese} variant={language === "my" ? "primary" : "secondary"} compact onPress={() => changeLanguage("my")} style={styles.languageButton} />
        </View>
      </Card>

      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeadingRow}>
          <View style={styles.sectionIcon}><Ionicons name="key-outline" size={18} color="#B7A7FF" /></View>
          <View style={styles.sectionTitleWrap}>
            <Text style={styles.sectionTitle}>{copy.keyManager}</Text>
            <Text style={styles.sectionCaption}>{copy.keyCount.replace("{count}", String(keys.length))}</Text>
          </View>
        </View>
        {!supported ? (
          <View style={styles.noticePanel}>
            <Text style={styles.noticeText}>{copy.unsupportedKeyStorage}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.warningText}>{copy.freeOnlyWarning}</Text>
            {quotaBlockedUntil ? (
              <View style={styles.lockPanel}>
                <Ionicons name="time-outline" size={16} color="#FFD39A" />
                <Text style={styles.lockText}>{copy.quotaLockedUntil}</Text>
              </View>
            ) : null}
            {keys.map((key) => (
              <View key={key.id} style={[styles.keyRow, key.active && styles.activeKeyRow]}>
                <Pressable accessibilityRole="button" onPress={() => chooseKey(key.id)} style={styles.keySelect}>
                  <View style={styles.radioOuter}>{key.active ? <View style={styles.radioInner} /> : null}</View>
                  <View style={styles.keyInfo}>
                    <Text numberOfLines={1} style={styles.keyLabel}>{key.label}</Text>
                    <Text style={styles.keyMask}>{key.masked}</Text>
                  </View>
                  <Pill tone={key.active ? "violet" : "neutral"}><Text style={key.active ? styles.activeText : styles.selectText}>{key.active ? copy.activeKey : copy.selectKey}</Text></Pill>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={copy.removeKey} onPress={() => removeKey(key.id)} style={styles.removeKeyButton}>
                  <Ionicons name="trash-outline" size={17} color="#C78B9A" />
                </Pressable>
              </View>
            ))}
            {keys.length < 10 ? (
              <View style={styles.addKeyForm}>
                <Text style={styles.fieldLabel}>{copy.keyLabel}</Text>
                <TextInput value={keyLabel} onChangeText={setKeyLabel} placeholder={copy.keyLabelPlaceholder} placeholderTextColor="#727D98" maxLength={40} style={styles.textInput} />
                <Text style={[styles.fieldLabel, styles.keyValueLabel]}>{copy.keyValue}</Text>
                <TextInput value={keyValue} onChangeText={setKeyValue} placeholder={copy.keyPlaceholder} placeholderTextColor="#727D98" autoCapitalize="none" autoCorrect={false} secureTextEntry style={styles.textInput} />
                <View style={styles.confirmRow}>
                  <Switch value={freeTierConfirmed} onValueChange={setFreeTierConfirmed} trackColor={{ false: "#30364D", true: "#6D55CE" }} thumbColor={freeTierConfirmed ? "#E8E0FF" : "#A2A9BC"} />
                  <Text style={styles.confirmText}>{copy.freeTierConfirm}</Text>
                </View>
                <ActionButton label={copy.addKey} icon="add-outline" onPress={submitKey} disabled={!freeTierConfirmed || keyValue.trim().length < 20 || keys.length >= 10} style={styles.addButton} />
              </View>
            ) : null}
            {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
            <ActionButton label={language === "my" ? "AI Studio key စာမျက်နှာဖွင့်ရန်" : "Open Google AI Studio keys"} icon="open-outline" variant="quiet" compact onPress={() => Linking.openURL(AI_STUDIO_KEYS_URL)} style={styles.docsButton} />
          </>
        )}
      </Card>

      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeadingRow}>
          <View style={styles.sectionIcon}><Ionicons name="shield-checkmark-outline" size={18} color="#8DBBFF" /></View>
          <View style={styles.sectionTitleWrap}>
            <Text style={styles.sectionTitle}>{copy.keySecurityTitle}</Text>
            <Text style={styles.sectionCaption}>{copy.modelLabel}: {GEMINI_MODEL_ID}</Text>
          </View>
        </View>
        <Text style={styles.bodyText}>{copy.keySecurity}</Text>
        <Text style={[styles.bodyText, styles.warningText]}>{copy.freeOnlyWarning}</Text>
        <Text style={[styles.bodyText, styles.warningText]}>{copy.privacyNotice}</Text>
      </Card>

      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeadingRow}>
          <View style={[styles.sectionIcon, styles.historyIcon]}><Ionicons name="archive-outline" size={18} color="#8DBBFF" /></View>
          <View style={styles.sectionTitleWrap}>
            <Text style={styles.sectionTitle}>{copy.history}</Text>
            <Text style={styles.sectionCaption}>{language === "my" ? `${history.length} ခု · ဤစက်တွင်သာ` : `${history.length} items · stored on this device only`}</Text>
          </View>
        </View>
        <Text style={styles.bodyText}>{language === "my" ? "မှတ်တမ်းတွင် ဇာတ်ညွှန်းနှင့် အထွက်စာသား ပါဝင်ပါသည်။" : "History contains your pasted transcript and retelling text."}</Text>
      </Card>

      <Text style={styles.footer}>{Platform.OS === "web" ? copy.unsupportedKeyStorage : copy.keyLimit}</Text>
    </CinematicScreen>
  );
}

const styles = StyleSheet.create({
  headerIcon: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(139, 92, 255, 0.16)", marginBottom: 14 },
  sectionCard: { marginBottom: 13, padding: 16 },
  sectionHeadingRow: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 13 },
  sectionIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(139, 92, 255, 0.16)" },
  historyIcon: { backgroundColor: "rgba(76, 141, 255, 0.14)" },
  sectionTitleWrap: { flex: 1, gap: 3 },
  sectionTitle: { color: palette.text, fontSize: 14, fontWeight: "800" },
  sectionCaption: { color: "#8E98B2", fontSize: 10, lineHeight: 15 },
  languageRow: { flexDirection: "row", gap: 9 },
  languageButton: { flex: 1 },
  warningText: { color: "#D9C9A8", fontSize: 11, lineHeight: 18, marginBottom: 12 },
  noticePanel: { backgroundColor: "rgba(76, 141, 255, 0.11)", borderRadius: 13, padding: 12 },
  noticeText: { color: "#B7C9E8", fontSize: 11, lineHeight: 18, marginTop: 8 },
  lockPanel: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "rgba(125, 83, 30, 0.20)", borderRadius: 12, padding: 10, marginBottom: 10 },
  lockText: { flex: 1, color: "#FFD39A", fontSize: 11, lineHeight: 17 },
  keyRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, borderColor: "rgba(160, 175, 220, 0.12)", padding: 10, marginBottom: 8, backgroundColor: "rgba(8, 12, 24, 0.35)" },
  activeKeyRow: { borderColor: "rgba(139, 92, 255, 0.45)", backgroundColor: "rgba(51, 40, 94, 0.30)" },
  keySelect: { flex: 1, minHeight: 42, flexDirection: "row", alignItems: "center", gap: 10 },
  radioOuter: { width: 17, height: 17, borderRadius: 9, borderWidth: 1.5, borderColor: "#9884E8", alignItems: "center", justifyContent: "center" },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#A990FF" },
  keyInfo: { flex: 1, gap: 3 },
  keyLabel: { color: palette.text, fontSize: 12, fontWeight: "700" },
  keyMask: { color: "#8791AA", fontSize: 10, letterSpacing: 1 },
  activeText: { color: "#D3C6FF", fontSize: 8, fontWeight: "800" },
  selectText: { color: "#AEB8D1", fontSize: 8, fontWeight: "700" },
  removeKeyButton: { width: 34, height: 36, alignItems: "center", justifyContent: "center" },
  addKeyForm: { marginTop: 12, paddingTop: 13, borderTopColor: "rgba(160, 175, 220, 0.12)", borderTopWidth: 1 },
  fieldLabel: { color: "#DCE0EE", fontSize: 11, fontWeight: "700", marginBottom: 7 },
  keyValueLabel: { marginTop: 12 },
  textInput: { height: 44, backgroundColor: "rgba(6, 9, 20, 0.54)", borderRadius: 12, paddingHorizontal: 12, color: palette.text, fontSize: 12, borderWidth: 1, borderColor: "rgba(145, 162, 205, 0.14)" },
  confirmRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 13 },
  confirmText: { flex: 1, color: "#AEB7CC", fontSize: 10, lineHeight: 16 },
  addButton: { marginTop: 13 },
  docsButton: { marginTop: 12 },
  bodyText: { color: "#A9B2C8", fontSize: 11, lineHeight: 18, marginBottom: 10 },
  footer: { color: "#737E99", fontSize: 10, lineHeight: 16, textAlign: "center", marginVertical: 14 },
});
