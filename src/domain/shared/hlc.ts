import type { Brand } from './ids';

/**
 * Hybrid Logical Clock timestamp, serialised as a fixed-width string:
 *
 *   `<wallMs: 15 digits>:<counter: 4 hex>:<deviceId>`
 *   e.g. `001767225600000:0003:5b0c...`
 *
 * Fixed width means plain string comparison (`<`, `>`) orders timestamps
 * chronologically, ties broken by counter, then by deviceId. That gives a
 * deterministic total order on every device, which is what makes the merge
 * commutative. Tick/receive/compare helpers arrive in the synchronization phase.
 */
export type HlcTimestamp = Brand<string, 'HlcTimestamp'>;

/** Last-writer-wins register: a value plus the clock of the write that set it. */
export interface Lww<T> {
  readonly value: T;
  readonly hlc: HlcTimestamp;
}

/** Maps every field of T to an LWW register of that field's type. */
export type LwwRecord<T> = { readonly [K in keyof T]: Lww<T[K]> };
