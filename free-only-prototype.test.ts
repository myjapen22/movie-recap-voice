import { describe, expect, it } from "vitest";

import { generateRetelling, GEMINI_MODEL_ID } from "../lib/gemini-client";
import { createSerialExecutor, getPacificDayKey, getPendingRequestBlockUntil, getRequestPolicyBlock, nextPacificMidnight } from "../lib/quota-window";
import { isSupportedSourceUrl, makeOfflineSamplePreview } from "../lib/recap";

const NOW = Date.parse("2026-10-18T05:00:00.000Z");

function allowedPolicyOverrides(overrides: Partial<Parameters<typeof getRequestPolicyBlock>[0]> = {}) {
  return {
    now: NOW,
    blockedUntil: null,
    dailyRequestDate: getPacificDayKey(NOW),
    dailyRequestCount: 0,
    lastRequestAt: null,
    hasActiveKey: true,
    freeTierConfirmed: true,
    ...overrides,
  };
}

describe("free-only Gemini client", () => {
  it("pins the sole model to the verified Free-tier text model", () => {
    expect(GEMINI_MODEL_ID).toBe("gemini-3.8-flash");
  });

  it("uses one explicit request, places the key in the header, and returns text only", async () => {
    let calls = 0;
    let requestedUrl = "";
    let requestedInit: RequestInit | undefined;
    const fetcher: typeof fetch = async (input, init) => {
      calls += 1;
      requestedUrl = String(input);
      requestedInit = init;
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Chronological retelling." }] } }] }), { status: 200 });
    };

    const result = await generateRetelling({ apiKey: "AIza-test-free-key-1234567890", transcript: "Opening. Ending.", language: "en", fetcher });

    expect(result).toEqual({ ok: true, text: "Chronological retelling." });
    expect(calls).toBe(1);
    expect(requestedUrl).toContain(`/models/${GEMINI_MODEL_ID}:generateContent`);
    expect(requestedUrl).not.toContain("AIza-test-free-key");
    expect(new Headers(requestedInit?.headers).get("x-goog-api-key")).toBe("AIza-test-free-key-1234567890");
    const body = JSON.parse(String(requestedInit?.body)) as { contents: Array<{ parts: Array<{ text: string }> }>; generationConfig: { maxOutputTokens: number } };
    expect(body.contents[0]?.parts[0]?.text).toContain("chronological order");
    expect(body.contents[0]?.parts[0]?.text).toContain("English");
    expect(body.generationConfig.maxOutputTokens).toBeGreaterThan(0);
  });

  it("offers concise summary and faithful rewrite prompts without changing model or request path", async () => {
    for (const [task, expected] of [["summarize", "Summarize the movie story"], ["rewrite", "Rewrite the source"]] as const) {
      let prompt = "";
      let requestedUrl = "";
      const fetcher: typeof fetch = async (input, init) => {
        requestedUrl = String(input);
        const body = JSON.parse(String(init?.body)) as { contents: Array<{ parts: Array<{ text: string }> }> };
        prompt = body.contents[0]?.parts[0]?.text ?? "";
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Text result." }] } }] }), { status: 200 });
      };
      const result = await generateRetelling({ apiKey: "AIza-test-free-key-1234567890", transcript: "Start. End.", language: "en", task, fetcher });
      expect(result.ok).toBe(true);
      expect(prompt).toContain(expected);
      expect(prompt).toContain("chronological order");
      expect(requestedUrl).toContain(`/models/${GEMINI_MODEL_ID}:generateContent`);
    }
  });

  it("stops after a single 429 response and exposes no retry or key-rotation path", async () => {
    let calls = 0;
    const fetcher: typeof fetch = async () => {
      calls += 1;
      return new Response("quota", { status: 429 });
    };
    const result = await generateRetelling({ apiKey: "AIza-test-free-key-1234567890", transcript: "A story.", language: "my", fetcher });
    expect(result).toEqual({ ok: false, error: "quota_exhausted" });
    expect(calls).toBe(1);
  });

  it("does not retry temporary upstream errors automatically", async () => {
    let calls = 0;
    const fetcher: typeof fetch = async () => {
      calls += 1;
      return new Response("temporary", { status: 503 });
    };
    const result = await generateRetelling({ apiKey: "AIza-test-free-key-1234567890", transcript: "A story.", language: "en", fetcher });
    expect(result).toEqual({ ok: false, error: "temporary_error" });
    expect(calls).toBe(1);
  });

  it("does not call any network for empty or oversized manual input", async () => {
    let calls = 0;
    const fetcher: typeof fetch = async () => {
      calls += 1;
      return new Response("unexpected", { status: 200 });
    };
    const empty = await generateRetelling({ apiKey: "AIza-test-free-key-1234567890", transcript: "   ", language: "en", fetcher });
    const oversized = await generateRetelling({ apiKey: "AIza-test-free-key-1234567890", transcript: "x".repeat(20_001), language: "en", fetcher });
    expect(empty).toEqual({ ok: false, error: "invalid_input" });
    expect(oversized).toEqual({ ok: false, error: "invalid_input" });
    expect(calls).toBe(0);
  });
});

describe("offline sample and source references", () => {
  it("creates a clearly labeled, chronological local preview", () => {
    const preview = makeOfflineSamplePreview("The hero wakes. They find a map. The family escapes.", "en");
    expect(preview).toContain("not AI-generated");
    expect(preview.indexOf("The hero wakes.")).toBeLessThan(preview.indexOf("They find a map."));
    expect(preview.indexOf("They find a map.")).toBeLessThan(preview.indexOf("The family escapes."));
  });

  it("supports YouTube, RedNote, and Telegram reference URLs without fetching them", () => {
    expect(isSupportedSourceUrl("https://youtu.be/abc123")).toBe(true);
    expect(isSupportedSourceUrl("https://www.xiaohongshu.com/explore/123")).toBe(true);
    expect(isSupportedSourceUrl("https://t.me/movie_channel/9")).toBe(true);
    expect(isSupportedSourceUrl("https://example.com/video")).toBe(false);
    expect(isSupportedSourceUrl("javascript:alert(1)")).toBe(false);
    expect(isSupportedSourceUrl("")).toBe(true);
  });
});

describe("local free quota gate", () => {
  it("uses the Pacific calendar day and calculates the daily reset", () => {
    expect(getPacificDayKey(NOW)).toBe("2026-10-17");
    expect(nextPacificMidnight(NOW)).toBe(Date.parse("2026-10-18T07:00:00.000Z"));
  });

  it("honors a 429 lockout before any active-key or alternate-key decision", () => {
    const blockedUntil = nextPacificMidnight(NOW);
    expect(getRequestPolicyBlock(allowedPolicyOverrides({ blockedUntil }))).toEqual({ reason: "quota_blocked", until: blockedUntil });
  });

  it("fails closed until Pacific midnight when a request reservation is left unfinished", () => {
    expect(getPendingRequestBlockUntil(NOW, NOW)).toBe(nextPacificMidnight(NOW));
    const previousPacificDay = Date.parse("2026-10-17T05:00:00.000Z");
    expect(getPendingRequestBlockUntil(NOW, previousPacificDay)).toBeNull();
  });

  it("enforces the local daily limit and minimum request gap", () => {
    expect(getRequestPolicyBlock(allowedPolicyOverrides({ dailyRequestCount: 3 }))).toMatchObject({ reason: "daily_limit" });
    expect(getRequestPolicyBlock(allowedPolicyOverrides({ lastRequestAt: NOW - 5_000 }))).toMatchObject({ reason: "cooldown" });
  });

  it("serializes concurrent daily reservations so only three can be accepted", async () => {
    const execute = createSerialExecutor();
    let reservations = 0;
    const reserve = () => execute(async () => {
      if (reservations >= 3) return false;
      reservations += 1;
      return true;
    });

    const outcomes = await Promise.all(Array.from({ length: 10 }, () => reserve()));

    expect(outcomes.filter(Boolean)).toHaveLength(3);
    expect(reservations).toBe(3);
  });
});
