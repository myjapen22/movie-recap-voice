import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

import { CinematicScreen } from "@/components/cinematic-screen";
import { ActionButton, Card, Pill, ScreenHeading, palette } from "@/components/movie-ui";
import { useAppState, type HistoryItem, type RetellingMode } from "@/lib/app-state";
import { exportRetellingTxt } from "@/lib/export-text";
import { generateRetelling, MAX_TRANSCRIPT_CHARACTERS, type RetellingTask } from "@/lib/gemini-client";
import { getCopy } from "@/lib/i18n";
import { blockAllKeysUntilPacificReset, completeGeminiRequestReservation, releaseGeminiRequestReservation, reserveGeminiRequest } from "@/lib/key-vault";
import { isSupportedSourceUrl, makeHistoryTitle, makeOfflineSamplePreview } from "@/lib/recap";

export default function NarratorScreen() {
  const { language, history, addHistory, updateHistoryText, draft, setDraft, setLanguage } = useAppState();
  const copy = getCopy(language);
  const [sourceUrl, setSourceUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [output, setOutput] = useState("");
  const [mode, setMode] = useState<RetellingMode>("sample");
  const [isEditing, setIsEditing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const loadedDraftId = useRef<string | null>(null);

  useEffect(() => {
    const nextId = draft?.id ?? null;
    if (nextId === loadedDraftId.current) return;
    loadedDraftId.current = nextId;
    const timer = setTimeout(() => {
      if (draft) {
        setSourceUrl(draft.sourceUrl);
        setTranscript(draft.transcript);
        setOutput(draft.retelling);
        setMode(draft.mode);
      } else {
        setSourceUrl("");
        setTranscript("");
        setOutput("");
        setMode("sample");
      }
      setIsEditing(false);
      setMessage("");
    }, 0);
    return () => clearTimeout(timer);
  }, [draft]);

  const saveResult = async (text: string, resultMode: RetellingMode) => {
    const now = Date.now();
    const item: HistoryItem = {
      id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      title: makeHistoryTitle(transcript, sourceUrl),
      language,
      sourceUrl: sourceUrl.trim(),
      transcript: transcript.trim(),
      retelling: text,
      mode: resultMode,
    };
    setOutput(text);
    setMode(resultMode);
    setIsEditing(false);
    setDraft(item);
    await addHistory(item);
  };

  const onGenerate = async (task: RetellingTask = "detailed") => {
    const cleanTranscript = transcript.trim();
    if (!cleanTranscript) { setMessage(copy.noTranscript); return; }
    if (cleanTranscript.length > MAX_TRANSCRIPT_CHARACTERS) { setMessage(copy.transcriptTooLong); return; }
    if (!isSupportedSourceUrl(sourceUrl)) { setMessage(copy.invalidSource); return; }

    setIsGenerating(true);
    let reserved = false;
    let preservePendingForQuotaLock = false;
    try {
      const gate = await reserveGeminiRequest();
      if (!gate.allowed) {
        if (gate.reason === "quota_blocked") setMessage(copy.quotaMessage);
        else if (gate.reason === "daily_limit") setMessage(copy.dailyLimit);
        else if (gate.reason === "cooldown") setMessage(copy.cooldown);
        else if (gate.reason === "unsupported") setMessage(copy.unsupportedKeyStorage);
        else if (gate.reason === "free_tier_unconfirmed") setMessage(copy.freeTierRequired);
        else setMessage(copy.noKeyMessage);
        return;
      }

      reserved = true;
      setMessage("");
      const result = await generateRetelling({ apiKey: gate.apiKey, transcript: cleanTranscript, language, task });
      if (!result.ok) {
        if (result.error === "quota_exhausted") {
          preservePendingForQuotaLock = true;
          setMessage(copy.quotaMessage);
          await blockAllKeysUntilPacificReset().catch(() => undefined);
          return;
        } else if (result.error === "invalid_key") {
          setMessage(copy.invalidKey);
        } else if (result.error === "network_error") {
          setMessage(copy.networkError);
        } else if (result.error === "empty_response") {
          setMessage(copy.emptyResponse);
        } else {
          setMessage(copy.temporaryError);
        }
        return;
      }
      await saveResult(result.text, "gemini");
    } catch {
      setMessage(copy.networkError);
    } finally {
      if (reserved) {
        if (preservePendingForQuotaLock) releaseGeminiRequestReservation();
        else await completeGeminiRequestReservation();
      }
      setIsGenerating(false);
    }
  };

  const onSamplePreview = async () => {
    const cleanTranscript = transcript.trim();
    if (!cleanTranscript) { setMessage(copy.noTranscript); return; }
    if (cleanTranscript.length > MAX_TRANSCRIPT_CHARACTERS) { setMessage(copy.transcriptTooLong); return; }
    if (!isSupportedSourceUrl(sourceUrl)) { setMessage(copy.invalidSource); return; }
    setMessage("");
    await saveResult(makeOfflineSamplePreview(cleanTranscript, language), "sample");
  };

  const onCopy = async () => {
    if (!output.trim()) return;
    try {
      await Clipboard.setStringAsync(output);
      setMessage(copy.copied);
    } catch {
      setMessage(copy.networkError);
    }
  };

  const onExport = async () => {
    if (!output.trim()) return;
    try {
      const result = await exportRetellingTxt(output);
      if (result === "cancelled") setMessage(copy.txtExportCancelled);
      else if (result === "shared") setMessage(copy.txtShared);
      else setMessage(copy.txtSaved);
    } catch {
      setMessage(copy.txtExportError);
    }
  };

  const finishEditing = async () => {
    setIsEditing(false);
    if (draft?.id) {
      await updateHistoryText(draft.id, output);
      setDraft({ ...draft, retelling: output });
    }
  };

  const canEdit = !!output.trim();

  return (
    <CinematicScreen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.topRow}>
          <Pill tone="violet"><Text style={styles.pillLabel}>{copy.textOnly}</Text></Pill>
          <Text style={styles.modelTag}>GEMINI 3.8 FLASH</Text>
        </View>
        <ScreenHeading title={copy.movieNarrator} subtitle={copy.intro} />

        <Card style={styles.sourceCard}>
          <View style={styles.fieldHeader}>
            <Ionicons name="link-outline" size={16} color="#8DBBFF" />
            <Text style={styles.fieldLabel}>{copy.sourceReference}</Text>
          </View>
          <TextInput
            value={sourceUrl}
            onChangeText={setSourceUrl}
            placeholder={copy.sourcePlaceholder}
            placeholderTextColor="#727D98"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.singleInput}
          />
          <Text style={styles.helperText}>{copy.sourceHelp} {copy.urlNotFetched}</Text>
        </Card>

        <Card style={styles.transcriptCard}>
          <View style={styles.fieldHeader}>
            <Ionicons name="document-text-outline" size={16} color="#B8A4FF" />
            <Text style={styles.fieldLabel}>{copy.transcriptLabel}</Text>
          </View>
          <TextInput
            value={transcript}
            onChangeText={setTranscript}
            placeholder={copy.transcriptPlaceholder}
            placeholderTextColor="#727D98"
            multiline
            textAlignVertical="top"
            maxLength={MAX_TRANSCRIPT_CHARACTERS + 1}
            style={styles.transcriptInput}
          />
          <View style={styles.counterRow}>
            <Text style={styles.helperText}>{copy.transcriptHelp}</Text>
            <Text style={styles.counter}>{transcript.length.toLocaleString()} / {MAX_TRANSCRIPT_CHARACTERS.toLocaleString()}</Text>
          </View>
        </Card>

        <View style={styles.languageCard}>
          <Text style={styles.fieldLabel}>{copy.language}</Text>
          <View style={styles.languageButtons}>
            <ActionButton label={copy.english} variant={language === "en" ? "primary" : "secondary"} compact onPress={() => void setLanguage("en")} style={styles.languageButton} />
            <ActionButton label={copy.burmese} variant={language === "my" ? "primary" : "secondary"} compact onPress={() => void setLanguage("my")} style={styles.languageButton} />
          </View>
        </View>

        <View style={styles.actions}>
          <ActionButton label={isGenerating ? copy.working : copy.generate} icon="sparkles-outline" onPress={() => void onGenerate("detailed")} disabled={isGenerating} style={styles.primaryAction} />
          <View style={styles.secondaryActions}>
            <ActionButton label={copy.summarize} icon="list-outline" variant="secondary" onPress={() => void onGenerate("summarize")} disabled={isGenerating} style={styles.secondaryAction} />
            <ActionButton label={copy.rewrite} icon="create-outline" variant="secondary" onPress={() => void onGenerate("rewrite")} disabled={isGenerating} style={styles.secondaryAction} />
          </View>
          <ActionButton label={copy.samplePreview} icon="eye-outline" variant="secondary" onPress={onSamplePreview} disabled={isGenerating} style={styles.primaryAction} />
        </View>

        <Card style={styles.privacyCard}>
          <View style={styles.noticeTitleRow}>
            <Ionicons name="shield-checkmark-outline" size={17} color="#91B8FF" />
            <Text style={styles.noticeTitle}>{copy.privacyTitle}</Text>
          </View>
          <Text style={styles.noticeText}>{copy.privacyNotice}</Text>
          <Text style={[styles.noticeText, styles.noticeSmall]}>{copy.sourceAccess}</Text>
        </Card>

        {isGenerating ? (
          <View style={styles.progressRow}><ActivityIndicator color="#B59FFF" /><Text style={styles.progressText}>{copy.working}</Text></View>
        ) : null}
        {message ? <Card style={styles.messageCard}><Text style={styles.messageText}>{message}</Text></Card> : null}

        {output ? (
          <Card style={styles.outputCard}>
            <View style={styles.outputHeader}>
              <View style={styles.outputTitleWrap}>
                <Text style={styles.outputTitle}>{copy.outputTitle}</Text>
                {mode === "sample" ? <Pill tone="neutral"><Text style={styles.sampleTag}>{copy.sampleBadge}</Text></Pill> : null}
              </View>
              <Text style={styles.outputCount}>{output.length.toLocaleString()}</Text>
            </View>
            {mode === "sample" ? <Text style={styles.sampleDisclaimer}>{copy.sampleDisclaimer}</Text> : null}
            <TextInput
              value={output}
              onChangeText={setOutput}
              editable={isEditing}
              multiline
              textAlignVertical="top"
              style={[styles.outputInput, isEditing && styles.outputEditing]}
              placeholder={copy.outputPlaceholder}
              placeholderTextColor="#727D98"
            />
            <View style={styles.outputActions}>
              <ActionButton label={copy.copy} icon="copy-outline" variant="quiet" compact onPress={onCopy} disabled={!canEdit} style={styles.outputAction} />
              <ActionButton label={isEditing ? copy.done : copy.edit} icon={isEditing ? "checkmark-outline" : "create-outline"} variant="secondary" compact onPress={isEditing ? finishEditing : () => setIsEditing(true)} disabled={!canEdit} style={styles.outputAction} />
              <ActionButton label={copy.exportTxt} icon="download-outline" variant="quiet" compact onPress={onExport} disabled={!canEdit} style={styles.outputAction} />
            </View>
          </Card>
        ) : null}
        <Text style={styles.historyHint}>{copy.history}: {history.length}</Text>
      </KeyboardAvoidingView>
    </CinematicScreen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 10 },
  pillLabel: { color: "#C9BFFF", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  modelTag: { color: "#8793B3", fontSize: 9, letterSpacing: 1.2, fontWeight: "800" },
  sourceCard: { marginBottom: 13, padding: 16 },
  transcriptCard: { padding: 16 },
  fieldHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  fieldLabel: { color: palette.text, fontSize: 13, fontWeight: "700" },
  singleInput: { minHeight: 46, backgroundColor: "rgba(6, 9, 20, 0.54)", borderRadius: 13, paddingHorizontal: 13, color: palette.text, fontSize: 13, borderWidth: 1, borderColor: "rgba(145, 162, 205, 0.13)" },
  helperText: { color: "#939DB7", fontSize: 11, lineHeight: 17, flex: 1 },
  transcriptInput: { minHeight: 160, backgroundColor: "rgba(6, 9, 20, 0.54)", borderRadius: 15, padding: 14, color: "#F2F3FC", fontSize: 14, lineHeight: 22, borderWidth: 1, borderColor: "rgba(145, 162, 205, 0.15)" },
  counterRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginTop: 10, alignItems: "flex-start" },
  counter: { color: "#727D98", fontSize: 10, fontVariant: ["tabular-nums"] },
  languageCard: { marginTop: 17, gap: 9 },
  languageButtons: { flexDirection: "row", gap: 9 },
  languageButton: { flex: 1 },
  actions: { gap: 9, marginTop: 16 },
  secondaryActions: { flexDirection: "row", gap: 9 },
  secondaryAction: { flex: 1 },
  primaryAction: { width: "100%" },
  privacyCard: { marginTop: 16, padding: 15, backgroundColor: "rgba(17, 25, 47, 0.7)" },
  noticeTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 7 },
  noticeTitle: { color: "#DCE7FF", fontSize: 12, fontWeight: "800" },
  noticeText: { color: "#A9B2C8", fontSize: 11, lineHeight: 17 },
  noticeSmall: { marginTop: 7, color: "#8792AE" },
  progressRow: { marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  progressText: { color: "#B8A4FF", fontSize: 12, fontWeight: "700" },
  messageCard: { marginTop: 12, borderColor: "rgba(255, 157, 109, 0.28)", backgroundColor: "rgba(76, 34, 35, 0.30)", padding: 13 },
  messageText: { color: "#FFD7C7", fontSize: 12, lineHeight: 19 },
  outputCard: { marginTop: 18, padding: 16 },
  outputHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  outputTitleWrap: { flex: 1, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  outputTitle: { color: palette.text, fontSize: 17, fontWeight: "800" },
  outputCount: { color: "#7D88A3", fontSize: 10 },
  sampleTag: { color: "#B5BED2", fontSize: 8, letterSpacing: 0.5, fontWeight: "800" },
  sampleDisclaimer: { marginTop: 8, color: "#9CA7C2", fontSize: 11, lineHeight: 17 },
  outputInput: { minHeight: 230, marginTop: 13, backgroundColor: "rgba(5, 8, 18, 0.62)", borderRadius: 15, padding: 14, color: "#E9ECF8", fontSize: 14, lineHeight: 23, borderWidth: 1, borderColor: "rgba(145, 162, 205, 0.14)" },
  outputEditing: { borderColor: "rgba(139, 92, 255, 0.58)" },
  outputActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  outputAction: { flexGrow: 1 },
  historyHint: { color: "#6F7893", fontSize: 10, textAlign: "center", marginTop: 20, marginBottom: 8 },
});
