export const PACIFIC_TIME_ZONE = "America/Los_Angeles";
export const MAX_REQUESTS_PER_PACIFIC_DAY = 3;
export const MIN_REQUEST_GAP_MS = 30_000;

export type RequestBlockReason = "quota_blocked" | "no_key" | "free_tier_unconfirmed" | "cooldown" | "daily_limit";

export interface RequestPolicyInput {
  now: number;
  blockedUntil: number | null;
  dailyRequestDate: string | null;
  dailyRequestCount: number;
  lastRequestAt: number | null;
  hasActiveKey: boolean;
  freeTierConfirmed: boolean;
}

export function getPacificDayKey(timestamp: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function getPendingRequestBlockUntil(now: number, pendingRequestAt: number | null): number | null {
  if (pendingRequestAt === null || !Number.isFinite(pendingRequestAt) || pendingRequestAt <= 0) return null;
  if (getPacificDayKey(pendingRequestAt) !== getPacificDayKey(now)) return null;
  const blockUntil = nextPacificMidnight(pendingRequestAt);
  return now < blockUntil ? blockUntil : null;
}

function getPacificOffsetMs(timestamp: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const representedAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return representedAsUtc - Math.floor(timestamp / 1000) * 1000;
}

export function nextPacificMidnight(timestamp = Date.now()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const tomorrowUtc = new Date(Date.UTC(get("year"), get("month") - 1, get("day") + 1));
  const localMidnightAsUtc = Date.UTC(tomorrowUtc.getUTCFullYear(), tomorrowUtc.getUTCMonth(), tomorrowUtc.getUTCDate(), 0, 0, 0);
  const offset = getPacificOffsetMs(localMidnightAsUtc);
  return localMidnightAsUtc - offset;
}

export function getRequestPolicyBlock(input: RequestPolicyInput): { reason: RequestBlockReason; until?: number } | null {
  if (input.blockedUntil !== null && input.now < input.blockedUntil) {
    return { reason: "quota_blocked", until: input.blockedUntil };
  }
  if (!input.hasActiveKey) return { reason: "no_key" };
  if (!input.freeTierConfirmed) return { reason: "free_tier_unconfirmed" };
  if (input.lastRequestAt !== null && input.now - input.lastRequestAt < MIN_REQUEST_GAP_MS) {
    return { reason: "cooldown", until: input.lastRequestAt + MIN_REQUEST_GAP_MS };
  }
  if (input.dailyRequestDate === getPacificDayKey(input.now) && input.dailyRequestCount >= MAX_REQUESTS_PER_PACIFIC_DAY) {
    return { reason: "daily_limit", until: nextPacificMidnight(input.now) };
  }
  return null;
}

export function createSerialExecutor() {
  let tail: Promise<unknown> = Promise.resolve();
  return function execute<T>(operation: () => T | Promise<T>): Promise<T> {
    const result = tail.then(operation, operation);
    tail = result.then(() => undefined, () => undefined);
    return result;
  };
}
