# Movie Recap Voice — implementation plan

## Scope and implementation approach

Build on the existing Expo Router / React Native / TypeScript mobile starter. Keep the fixed Metro/API ports and managed Mobile capabilities unchanged; the template auto-starts its built-in API listener for Preview, but this app adds no Gemini endpoint, server credential, or app-side API client to it. Add no billing or production deployment. The Android app calls Google's Gemini Developer API directly only after a user explicitly chooses a locally stored key and confirms it is from a Free-tier project with billing not linked. The app uses only the fixed model `gemini-3.8-flash` through standard text generation. It never switches models or automatically rotates keys. A pre-request marker is persisted before network I/O; if a request is interrupted before a non-429 completion clears that marker, the remaining marker fails closed until the next Pacific midnight. After any upstream 429, all key-based generation is blocked on the device until the next Pacific midnight, respecting Google's project-level limits rather than treating a second key as new quota.

The user approved storing and managing up to 10 user-supplied Gemini API keys in Android SecureStore. Store values only in Android SecureStore, mask them in the UI, never log them, and allow one explicitly selected key at a time. SecureStore protects keys at rest but cannot prevent extraction from a rooted/compromised device or from the running app. Google recommends keeping keys out of production mobile clients and using a backend proxy; the user chose the no-server BYOK design with that limitation understood. The UI must remind users to restrict keys to Gemini API and use only a Free-tier project with billing disabled. The app cannot verify a key's billing tier and will not enable billing. A missing key or unavailable quota leaves a clearly labeled deterministic local sample-preview flow.

Google's official model catalog and pricing checked 2026-10-18: `gemini-3.8-flash` is stable, with Standard Free-tier input and output listed as free of charge. The same model has paid-tier prices, so a key attached to a billing-enabled project is not acceptable for this prototype. Google says limits vary by project/model, are applied per project (not API key), and RPD resets at midnight Pacific. Free-tier text may be used to improve Google products. Do not use paid-only grounding, batch, priority, or any other paid feature. This product's live API request contains only manually pasted text; no audio, TTS, transcription model, video scraping, or caption-access workaround is used. Use the `x-goog-api-key` header, not a URL query parameter.

Users can optionally paste a YouTube, RedNote, or Telegram URL as a reference and manually paste the transcript/subtitles they are permitted to use. The app will not fetch platform media or subtitles in this no-server prototype. The UI explains that URL access depends on authorization and official API access; manual text remains usable. Gemini supports detailed chronological retelling, concise summarization, and faithful rewriting in Burmese or English. All results are text only. Copy, edit, TXT export, and transcript history are available; history stays on-device in AsyncStorage, while API keys stay in separate SecureStore entries.

## Project structure

- `app/(tabs)/index.tsx`: cinematic home screen and navigation cards.
- `app/(tabs)/narrator.tsx`: optional source URL, manual transcript, language selection, direct Gemini action, offline sample preview, editable text result, copy/export actions.
- `app/(tabs)/history.tsx`: device-local history and reopen/edit flow.
- `app/(tabs)/settings.tsx`: Burmese/English preference, 10-key vault, explicit Free-tier confirmation, and privacy limitations.
- `app/(tabs)/kikivoice.tsx`: browser-only external link to KikiVoice, with no in-app API or audio integration.
- `app/(tabs)/_layout.tsx`: responsive bottom navigation for Home, Narrator, History, and Settings.
- `components/`: shared cinematic background, header, card, and button primitives.
- `lib/app-state.tsx`: app language and local history persistence.
- `lib/gemini-client.ts`: fixed model ID, direct client request, user-triggered network call, and localized error handling.
- `lib/key-vault.ts`: per-key Android SecureStore CRUD, masked-only vault metadata, manual key selection, atomic request reservation, crash-safe pending marker, and persisted 429 block with a non-secret AsyncStorage fallback.
- `lib/quota-window.ts`: Pacific-day reset, local cooldown/daily cap, serialized reservation helper, pending-request lockout, and quota-gate rules.
- `lib/recap.ts`: supported reference URL validation, local deterministic sample preview, and history-title helpers.
- `lib/export-text.ts`: Web download plus Android share-sheet and Storage Access Framework folder-picker export for TXT.
- `tests/`: deterministic tests for free-only model selection, no automatic retry/rotation, interrupted-request lockout, and local sample behavior; tests mock network calls and never spend quota.

## Design system

**Design Movement:** a restrained neo-noir cinema-writing studio, using the user's requested dark cinematic blue-and-purple direction.

**Core Principles:** cinematic but legible; one-handed phone use; text remains the focal content; paid or audio functionality is never implied.

**Color Philosophy:** near-black navy reduces glare and gives long text room; electric blue signals focus and safety; violet is the creative signature; muted cool gray supports quiet secondary information.

**Layout Paradigm:** a vertical, scrollable writing workspace with stacked cards, generous textarea space, and a compact persistent bottom navigation instead of a dense dashboard grid.

**Signature Elements:** a soft blue-violet horizon glow; subtle film-frame corner marks; a numbered story timeline motif for chronological structure.

**Interaction Philosophy:** every network action is explicit, has a visible pending/disabled state, and can never auto-retry or rotate keys after a 429. Offline sample mode is visibly distinguished from Gemini output.

**Animation:** restrained 160–220 ms opacity/translate transitions for screen and result changes; no sound, waveform, or audio-player motion.

**Typography System:** system sans-serif for Latin text; Android system Myanmar-capable fallback for Burmese; short display headings, high-contrast body copy, and comfortable line height for transcript reading.

**Brand Essence:** a beginner-friendly, device-local text studio that turns permitted transcript text into chronological movie recaps; clear, cinematic, careful.

**Brand Voice:** concise, calm, and explicit about data flow. Example lines: “A story, in sequence.” “Your transcript stays on this device unless you ask Gemini to retell it.”

**Wordmark & Logo:** a compact film-frame outline enclosing a folded text page and a violet story dot; no microphone or waveform imagery.

**Signature Brand Color:** violet `#8B5CFF`, balanced by deep navy `#090C18` and electric blue `#4C8DFF`.

## Research sources

- Google's [Gemini model catalog](https://ai.google.dev/gemini-api/docs/models) lists `gemini-3.8-flash` as stable.
- Google's [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) lists Standard Free-tier input and output as free of charge and also lists paid-tier pricing; it states that Free-tier content may be used to improve Google products.
- Google's [rate-limit documentation](https://ai.google.dev/gemini-api/docs/rate-limits) says limits are per project, not per API key, and daily RPD resets at midnight Pacific. Active limits vary and are shown in AI Studio.
- Google's [API key guidance](https://ai.google.dev/gemini-api/docs/api-key) says production mobile/web clients should not expose keys and recommends a backend proxy; the app displays this risk because the user selected a no-server personal-use prototype.
- Google's [API key best practices](https://docs.cloud.google.com/docs/authentication/api-keys-best-practices) recommend restrictions, avoiding URL query parameters, and retaining only keys in use.
