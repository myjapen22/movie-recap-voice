import type { AppLanguage } from "@/lib/i18n";

const SUPPORTED_HOSTS = [
  "youtube.com",
  "youtu.be",
  "rednote.com",
  "xiaohongshu.com",
  "xhslink.com",
  "t.me",
  "telegram.me",
  "telegram.dog",
];

export function isSupportedSourceUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return SUPPORTED_HOSTS.some((supported) => host === supported || host.endsWith(`.${supported}`));
  } catch {
    return false;
  }
}

function splitSentences(transcript: string): string[] {
  return transcript
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .flatMap((line) => line.match(/[^.!?။]+(?:[.!?။]+|$)/gu) ?? [line])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function chooseChronologicalSamples(sentences: string[], max = 5): string[] {
  if (sentences.length <= max) return sentences;
  const picks = new Set<number>();
  for (let i = 0; i < max; i += 1) {
    picks.add(Math.round((i * (sentences.length - 1)) / (max - 1)));
  }
  return [...picks].sort((a, b) => a - b).map((index) => sentences[index]);
}

export function makeOfflineSamplePreview(transcript: string, language: AppLanguage): string {
  const sentences = chooseChronologicalSamples(splitSentences(transcript));
  const lines = sentences.map((sentence, index) => `${index + 1}. ${sentence}`);
  if (language === "my") {
    return [
      "အော့ဖ်လိုင်းနမူနာပြသမှု (AI မဟုတ်ပါ)",
      "ဤနမူနာသည် ကူးထည့်ထားသော စာသားမှ အစဉ်လိုက်ရွေးပြထားခြင်းသာ ဖြစ်သည်။",
      "",
      ...lines,
    ].join("\n");
  }
  return [
    "Offline sample preview (not AI-generated)",
    "This only selects sample sentences in order from your pasted text.",
    "",
    ...lines,
  ].join("\n");
}

export function makeHistoryTitle(transcript: string, sourceUrl: string): string {
  if (sourceUrl.trim()) {
    try {
      return new URL(sourceUrl).hostname.replace(/^www\./, "");
    } catch {
      // Fall through to a transcript-derived title.
    }
  }
  const firstSentence = splitSentences(transcript)[0] ?? "Movie recap";
  return firstSentence.length > 52 ? `${firstSentence.slice(0, 49).trimEnd()}…` : firstSentence;
}
