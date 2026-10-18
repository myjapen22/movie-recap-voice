import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import {
  createSerialExecutor,
  getPacificDayKey,
  getPendingRequestBlockUntil,
  getRequestPolicyBlock,
  MAX_REQUESTS_PER_PACIFIC_DAY,
  MIN_REQUEST_GAP_MS,
  nextPacificMidnight,
} from "@/lib/quota-window";

const VAULT_KEY = "movie-recap.gemini-vault.v1";
const KEY_ITEM_PREFIX = "movie-recap.gemini-key.";
const QUOTA_BLOCK_KEY = "movie-recap.gemini-quota-block.v1";
const LOCAL_PENDING_REQUEST_KEY = "movie-recap.gemini-pending-request.v1";
export const MAX_KEYS = 10;

const withVaultLock = createSerialExecutor();
const secureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
let inMemoryQuotaBlockedUntil = 0;
let requestReservationActive = false;

export interface StoredGeminiKey {
  id: string;
  label: string;
  lastFour: string;
  freeTierConfirmed: boolean;
  createdAt: number;
}

interface VaultData {
  keys: StoredGeminiKey[];
  activeKeyId: string | null;
  quotaBlockedUntil: number | null;
  dailyRequestDate: string | null;
  dailyRequestCount: number;
  lastRequestAt: number | null;
  pendingRequestAt: number | null;
}

export interface GeminiKeySummary {
  id: string;
  label: string;
  masked: string;
  active: boolean;
  freeTierConfirmed: boolean;
  createdAt: number;
}

export type RequestGate =
  | { allowed: true; apiKey: string }
  | {
      allowed: false;
      reason: "unsupported" | "no_key" | "free_tier_unconfirmed" | "quota_blocked" | "daily_limit" | "cooldown";
      until?: number;
    };

const emptyVault = (): VaultData => ({
  keys: [],
  activeKeyId: null,
  quotaBlockedUntil: null,
  dailyRequestDate: null,
  dailyRequestCount: 0,
  lastRequestAt: null,
  pendingRequestAt: null,
});

function keyItemName(id: string) {
  return `${KEY_ITEM_PREFIX}${id}`;
}

export async function isSecureKeyStorageAvailable(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

async function writeVault(vault: VaultData): Promise<void> {
  if (!(await isSecureKeyStorageAvailable())) throw new Error("secure_store_unavailable");
  // Only labels, masked suffixes, and local rate-limit metadata live in this record.
  await SecureStore.setItemAsync(VAULT_KEY, JSON.stringify(vault), secureStoreOptions);
}

async function readVault(): Promise<VaultData> {
  if (!(await isSecureKeyStorageAvailable())) return emptyVault();
  const raw = await SecureStore.getItemAsync(VAULT_KEY);
  if (!raw) return emptyVault();
  try {
    const value = JSON.parse(raw) as Partial<VaultData>;
    const rawKeys = Array.isArray(value.keys) ? value.keys as Array<Partial<StoredGeminiKey> & { value?: string }> : [];
    const keys: StoredGeminiKey[] = [];
    let migratedLegacyValues = false;

    for (const candidate of rawKeys) {
      if (!candidate || typeof candidate.id !== "string" || typeof candidate.label !== "string") continue;
      const legacyValue = typeof candidate.value === "string" ? candidate.value : null;
      let lastFour = typeof candidate.lastFour === "string" ? candidate.lastFour : "";
      if (legacyValue !== null) {
        await SecureStore.setItemAsync(keyItemName(candidate.id), legacyValue, secureStoreOptions);
        lastFour = legacyValue.slice(-4);
        migratedLegacyValues = true;
      }
      if (!lastFour) continue;
      keys.push({
        id: candidate.id,
        label: candidate.label,
        lastFour,
        freeTierConfirmed: candidate.freeTierConfirmed === true,
        createdAt: typeof candidate.createdAt === "number" ? candidate.createdAt : Date.now(),
      });
      if (keys.length >= MAX_KEYS) break;
    }

    const activeKeyId = keys.some((key) => key.id === value.activeKeyId) ? value.activeKeyId ?? null : null;
    const vault: VaultData = {
      keys,
      activeKeyId,
      quotaBlockedUntil: typeof value.quotaBlockedUntil === "number" ? value.quotaBlockedUntil : null,
      dailyRequestDate: typeof value.dailyRequestDate === "string" ? value.dailyRequestDate : null,
      dailyRequestCount: Number.isInteger(value.dailyRequestCount) && (value.dailyRequestCount ?? 0) >= 0 ? value.dailyRequestCount ?? 0 : 0,
      lastRequestAt: typeof value.lastRequestAt === "number" ? value.lastRequestAt : null,
      pendingRequestAt: typeof value.pendingRequestAt === "number" ? value.pendingRequestAt : null,
    };
    if (migratedLegacyValues) await writeVault(vault);
    return vault;
  } catch {
    return emptyVault();
  }
}

async function readLocalQuotaBlock(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(QUOTA_BLOCK_KEY);
    const timestamp = raw === null ? NaN : Number(raw);
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
  } catch {
    return null;
  }
}

async function readLocalPendingRequest(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_PENDING_REQUEST_KEY);
    const timestamp = raw === null ? NaN : Number(raw);
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
  } catch {
    return null;
  }
}

function toKeySummary({ id, label, lastFour, freeTierConfirmed, createdAt }: StoredGeminiKey, activeKeyId: string | null): GeminiKeySummary {
  return {
    id,
    label,
    masked: `•••• ${lastFour}`,
    active: id === activeKeyId,
    freeTierConfirmed: freeTierConfirmed === true,
    createdAt,
  };
}

export async function getGeminiKeySummaries(): Promise<GeminiKeySummary[]> {
  const vault = await readVault();
  return vault.keys.map((key) => toKeySummary(key, vault.activeKeyId));
}

export async function getVaultStatus() {
  const supported = await isSecureKeyStorageAvailable();
  if (!supported) {
    return { supported: false, keys: [] as GeminiKeySummary[], activeKeyId: null, quotaBlockedUntil: null, dailyRequestCount: 0 };
  }
  const [vault, localQuotaBlock, localPendingRequest] = await Promise.all([readVault(), readLocalQuotaBlock(), readLocalPendingRequest()]);
  const now = Date.now();
  const pendingRequestAt = Math.max(vault.pendingRequestAt ?? 0, localPendingRequest ?? 0) || null;
  const pendingBlockUntil = requestReservationActive ? 0 : getPendingRequestBlockUntil(now, pendingRequestAt) ?? 0;
  const blockedUntil = Math.max(vault.quotaBlockedUntil ?? 0, localQuotaBlock ?? 0, pendingBlockUntil, inMemoryQuotaBlockedUntil);
  return {
    supported: true,
    keys: vault.keys.map((key) => toKeySummary(key, vault.activeKeyId)),
    activeKeyId: vault.activeKeyId,
    quotaBlockedUntil: blockedUntil > now ? blockedUntil : null,
    dailyRequestCount: vault.dailyRequestDate === getPacificDayKey(now) ? vault.dailyRequestCount : 0,
  };
}

export async function addGeminiKey(input: {
  label: string;
  value: string;
  freeTierConfirmed: boolean;
  now?: number;
}): Promise<"added" | "duplicate" | "limit" | "invalid" | "unconfirmed" | "unsupported"> {
  if (!(await isSecureKeyStorageAvailable())) return "unsupported";
  const value = input.value.trim();
  const label = input.label.trim() || `Gemini key ${Date.now()}`;
  if (value.length < 20 || value.length > 256) return "invalid";
  if (!input.freeTierConfirmed) return "unconfirmed";

  try {
    return await withVaultLock(async () => {
      const vault = await readVault();
      for (const stored of vault.keys) {
        const storedValue = await SecureStore.getItemAsync(keyItemName(stored.id));
        if (storedValue === value) return "duplicate";
      }
      if (vault.keys.length >= MAX_KEYS) return "limit";
      const id = `${input.now ?? Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const key: StoredGeminiKey = {
        id,
        label: label.slice(0, 40),
        lastFour: value.slice(-4),
        freeTierConfirmed: true,
        createdAt: input.now ?? Date.now(),
      };
      await SecureStore.setItemAsync(keyItemName(id), value, secureStoreOptions);
      try {
        await writeVault({ ...vault, keys: [...vault.keys, key], activeKeyId: vault.activeKeyId });
      } catch (error) {
        await SecureStore.deleteItemAsync(keyItemName(id)).catch(() => undefined);
        throw error;
      }
      return "added";
    });
  } catch {
    return "unsupported";
  }
}

export async function selectGeminiKey(id: string): Promise<boolean> {
  if (!(await isSecureKeyStorageAvailable())) return false;
  try {
    return await withVaultLock(async () => {
      const vault = await readVault();
      if (!vault.keys.some((key) => key.id === id)) return false;
      await writeVault({ ...vault, activeKeyId: id });
      return true;
    });
  } catch {
    return false;
  }
}

export async function removeGeminiKey(id: string): Promise<void> {
  if (!(await isSecureKeyStorageAvailable())) return;
  await withVaultLock(async () => {
    const vault = await readVault();
    const key = vault.keys.find((entry) => entry.id === id);
    if (!key) return;
    const itemName = keyItemName(id);
    const storedValue = await SecureStore.getItemAsync(itemName);
    await SecureStore.deleteItemAsync(itemName);
    const keys = vault.keys.filter((entry) => entry.id !== id);
    const activeKeyId = vault.activeKeyId === id ? null : vault.activeKeyId;
    try {
      await writeVault({ ...vault, keys, activeKeyId });
    } catch (error) {
      if (storedValue) await SecureStore.setItemAsync(itemName, storedValue, secureStoreOptions).catch(() => undefined);
      throw error;
    }
  });
}

function getCountForToday(vault: VaultData, now: number): number {
  return vault.dailyRequestDate === getPacificDayKey(now) ? vault.dailyRequestCount : 0;
}

export async function reserveGeminiRequest(now = Date.now()): Promise<RequestGate> {
  if (!(await isSecureKeyStorageAvailable())) return { allowed: false, reason: "unsupported" };
  return withVaultLock(async () => {
    try {
      const [vault, localQuotaBlock, localPendingRequest] = await Promise.all([readVault(), readLocalQuotaBlock(), readLocalPendingRequest()]);
      const active = vault.keys.find((key) => key.id === vault.activeKeyId);
      const pendingRequestAt = Math.max(vault.pendingRequestAt ?? 0, localPendingRequest ?? 0) || null;
      const pendingBlockUntil = requestReservationActive ? 0 : getPendingRequestBlockUntil(now, pendingRequestAt) ?? 0;
      const blockedUntil = Math.max(vault.quotaBlockedUntil ?? 0, localQuotaBlock ?? 0, pendingBlockUntil, inMemoryQuotaBlockedUntil) || null;
      const block = getRequestPolicyBlock({
        now,
        blockedUntil,
        dailyRequestDate: vault.dailyRequestDate,
        dailyRequestCount: getCountForToday(vault, now),
        lastRequestAt: vault.lastRequestAt,
        hasActiveKey: !!active,
        freeTierConfirmed: active?.freeTierConfirmed === true,
      });
      if (block) return { allowed: false, reason: block.reason, until: block.until };
      if (!active) return { allowed: false, reason: "no_key" };
      if (requestReservationActive) {
        return { allowed: false, reason: "cooldown", until: Math.max(now + 1_000, (vault.lastRequestAt ?? now) + MIN_REQUEST_GAP_MS) };
      }

      const apiKey = await SecureStore.getItemAsync(keyItemName(active.id));
      if (!apiKey) return { allowed: false, reason: "no_key" };
      const today = getPacificDayKey(now);
      const count = vault.dailyRequestDate === today ? vault.dailyRequestCount : 0;
      await writeVault({ ...vault, dailyRequestDate: today, dailyRequestCount: count + 1, lastRequestAt: now, pendingRequestAt: now });
      await AsyncStorage.setItem(LOCAL_PENDING_REQUEST_KEY, String(now)).catch(() => undefined);
      requestReservationActive = true;
      return { allowed: true, apiKey };
    } catch {
      return { allowed: false, reason: "unsupported" };
    }
  });
}

export function releaseGeminiRequestReservation(): void {
  requestReservationActive = false;
}

export async function completeGeminiRequestReservation(): Promise<void> {
  let clearedInAtLeastOneStore = false;
  await withVaultLock(async () => {
    const outcomes = await Promise.allSettled([
      readVault().then((vault) => writeVault({ ...vault, pendingRequestAt: null })),
      AsyncStorage.removeItem(LOCAL_PENDING_REQUEST_KEY),
    ]);
    clearedInAtLeastOneStore = outcomes.some((outcome) => outcome.status === "fulfilled");
  });
  requestReservationActive = false;
  if (!clearedInAtLeastOneStore) {
    inMemoryQuotaBlockedUntil = Math.max(inMemoryQuotaBlockedUntil, nextPacificMidnight(Date.now()));
  }
}

export async function blockAllKeysUntilPacificReset(now = Date.now()): Promise<number> {
  return withVaultLock(async () => {
    const blockedUntil = nextPacificMidnight(now);
    inMemoryQuotaBlockedUntil = blockedUntil;

    const secureWrite = readVault().then((vault) => writeVault({ ...vault, quotaBlockedUntil: blockedUntil }));
    const localWrite = AsyncStorage.setItem(QUOTA_BLOCK_KEY, String(blockedUntil));
    const outcomes = await Promise.allSettled([secureWrite, localWrite]);
    if (outcomes.every((outcome) => outcome.status === "rejected")) {
      throw new Error("quota_block_persistence_failed");
    }
    return blockedUntil;
  });
}

export const LOCAL_REQUEST_LIMIT = MAX_REQUESTS_PER_PACIFIC_DAY;
