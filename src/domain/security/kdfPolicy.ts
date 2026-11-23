import type { KdfParams } from './types';

/** Parameters used for NEW envelopes. Chosen above the OWASP minimums. */
export const ARGON2ID_DEFAULTS = {
  memoryKiB: 64 * 1024,
  iterations: 3,
  parallelism: 1,
} as const;

/** OWASP (2023) guidance for PBKDF2-HMAC-SHA256. Used only if WASM is unavailable. */
export const PBKDF2_DEFAULT_ITERATIONS = 600_000;

/** 16 random bytes encode to at least 22 Base64 characters. */
const MIN_SALT_BASE64_LENGTH = 22;

/**
 * Accepted range for envelopes READ from storage.
 * Lower bound: reject weakened parameters. Upper bound: a tampered envelope must not
 * be able to make the tab allocate gigabytes or hang for minutes (denial of service).
 */
export const KDF_BOUNDS = {
  argon2id: {
    memoryKiB: { min: 19 * 1024, max: 256 * 1024 },
    iterations: { min: 2, max: 10 },
    parallelism: { min: 1, max: 4 },
  },
  pbkdf2: { iterations: { min: 600_000, max: 5_000_000 } },
} as const;

const inRange = (value: number, range: { readonly min: number; readonly max: number }): boolean =>
  Number.isInteger(value) && value >= range.min && value <= range.max;

export function isKdfParamsAcceptable(params: KdfParams): boolean {
  if (params.salt.length < MIN_SALT_BASE64_LENGTH) return false;
  switch (params.kdf) {
    case 'argon2id':
      return (
        inRange(params.memoryKiB, KDF_BOUNDS.argon2id.memoryKiB) &&
        inRange(params.iterations, KDF_BOUNDS.argon2id.iterations) &&
        inRange(params.parallelism, KDF_BOUNDS.argon2id.parallelism)
      );
    case 'pbkdf2-sha256':
      return inRange(params.iterations, KDF_BOUNDS.pbkdf2.iterations);
    case 'hkdf-sha256':
      return true;
  }
}
