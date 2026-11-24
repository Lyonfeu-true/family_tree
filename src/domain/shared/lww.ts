import { compareHlc } from './hlc';
import type { HlcTimestamp } from './hlc';

/** Last-writer-wins register: a value plus the clock of the write that set it. */
export interface Lww<T> {
  readonly value: T;
  readonly hlc: HlcTimestamp;
}

/** Maps every field of T to an LWW register of that field's type. */
export type LwwRecord<T> = { readonly [K in keyof T]: Lww<T[K]> };

export const lww = <T>(value: T, hlc: HlcTimestamp): Lww<T> => ({ value, hlc });

/** The register with the later clock wins. Commutative, associative and idempotent. */
export function mergeLww<T>(current: Lww<T>, incoming: Lww<T>): Lww<T> {
  return compareHlc(incoming.hlc, current.hlc) > 0 ? incoming : current;
}

/** Wraps every field of `values` in a register stamped with `hlc`. */
export function lwwRecordOf<T extends object>(values: T, hlc: HlcTimestamp): LwwRecord<T> {
  const entries = Object.entries(values).map(([key, value]) => [key, lww(value, hlc)] as const);
  return Object.fromEntries(entries) as LwwRecord<T>;
}

/** Merges only the keys present in `patch`; undefined values mean "not touched". */
export function mergePatch<T extends object>(
  current: LwwRecord<T>,
  patch: Partial<T>,
  hlc: HlcTimestamp,
): LwwRecord<T> {
  const next: Record<string, Lww<unknown>> = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const existing = next[key];
    next[key] = existing ? mergeLww(existing, lww(value, hlc)) : lww(value, hlc);
  }
  return next as LwwRecord<T>;
}

/** Reads the plain values out of a register record. */
export function unwrapLww<T extends object>(record: LwwRecord<T>): T {
  const entries = Object.entries(record).map(([key, reg]) => [key, (reg as Lww<unknown>).value]);
  return Object.fromEntries(entries) as T;
}
