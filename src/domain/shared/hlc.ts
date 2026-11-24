import type { Brand, DeviceId } from './ids';

/**
 * Hybrid Logical Clock timestamp, serialised as a fixed-width string:
 *
 *   `<wallMs: 15 digits>:<counter: 4 hex>:<deviceId>`
 *   e.g. `001767225600000:0003:5b0c...`
 *
 * Fixed width means plain string comparison orders timestamps chronologically, ties
 * broken by counter, then by deviceId. Every device therefore agrees on one total
 * order, which is what makes merging commutative.
 */
export type HlcTimestamp = Brand<string, 'HlcTimestamp'>;

export interface HlcParts {
  readonly wallMs: number;
  readonly counter: number;
  readonly deviceId: DeviceId;
}

/** The mutable part of a device's clock. Kept by the sync layer between operations. */
export interface HlcState {
  readonly wallMs: number;
  readonly counter: number;
}

export const MAX_COUNTER = 0xffff;
/** Remote timestamps further ahead than this are quarantined (SECURITY.md, limitation 7). */
export const MAX_CLOCK_DRIFT_MS = 24 * 60 * 60 * 1000;

const WALL_DIGITS = 15;
const PATTERN = /^(\d{15}):([0-9a-f]{4}):(.+)$/;

export function formatHlc(parts: HlcParts): HlcTimestamp {
  const { wallMs, counter, deviceId } = parts;
  if (!Number.isSafeInteger(wallMs) || wallMs < 0 || wallMs >= 10 ** WALL_DIGITS) {
    throw new RangeError(`HLC wall time out of range: ${wallMs}`);
  }
  if (!Number.isInteger(counter) || counter < 0 || counter > MAX_COUNTER) {
    throw new RangeError(`HLC counter out of range: ${counter}`);
  }
  const wall = String(wallMs).padStart(WALL_DIGITS, '0');
  return `${wall}:${counter.toString(16).padStart(4, '0')}:${deviceId}` as HlcTimestamp;
}

/** Returns null for malformed input, so untrusted remote data never throws. */
export function parseHlc(timestamp: string): HlcParts | null {
  const match = PATTERN.exec(timestamp);
  if (!match) return null;
  const [, wall, counter, deviceId] = match;
  if (wall === undefined || counter === undefined || deviceId === undefined) return null;
  return { wallMs: Number(wall), counter: parseInt(counter, 16), deviceId: deviceId as DeviceId };
}

export function compareHlc(a: HlcTimestamp, b: HlcTimestamp): -1 | 0 | 1 {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function maxHlc(a: HlcTimestamp, b: HlcTimestamp): HlcTimestamp {
  return compareHlc(a, b) >= 0 ? a : b;
}

export function minHlc(a: HlcTimestamp, b: HlcTimestamp): HlcTimestamp {
  return compareHlc(a, b) <= 0 ? a : b;
}

const increment = (state: HlcState): HlcState =>
  state.counter >= MAX_COUNTER
    ? { wallMs: state.wallMs + 1, counter: 0 }
    : { wallMs: state.wallMs, counter: state.counter + 1 };

/** Advance the clock for a local event. Never moves backwards, even if the wall clock does. */
export function tickHlc(state: HlcState, nowMs: number): HlcState {
  return nowMs > state.wallMs ? { wallMs: nowMs, counter: 0 } : increment(state);
}

/** Advance the clock after observing a remote timestamp, so later local events sort after it. */
export function receiveHlc(state: HlcState, remote: HlcParts, nowMs: number): HlcState {
  const wallMs = Math.max(state.wallMs, remote.wallMs, nowMs);
  let counter = 0;
  if (wallMs === state.wallMs && wallMs === remote.wallMs) {
    counter = Math.max(state.counter, remote.counter) + 1;
  } else if (wallMs === state.wallMs) {
    counter = state.counter + 1;
  } else if (wallMs === remote.wallMs) {
    counter = remote.counter + 1;
  }
  return counter > MAX_COUNTER ? { wallMs: wallMs + 1, counter: 0 } : { wallMs, counter };
}

export function stampHlc(state: HlcState, deviceId: DeviceId): HlcTimestamp {
  return formatHlc({ ...state, deviceId });
}

export function isExcessiveClockSkew(
  remote: HlcParts,
  nowMs: number,
  maxDriftMs: number = MAX_CLOCK_DRIFT_MS,
): boolean {
  return remote.wallMs - nowMs > maxDriftMs;
}
