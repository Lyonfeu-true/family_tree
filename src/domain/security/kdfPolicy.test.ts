import { describe, expect, it } from "vitest";

import {
  ARGON2ID_DEFAULTS,
  PBKDF2_DEFAULT_ITERATIONS,
  isKdfParamsAcceptable,
} from "./kdfPolicy";
import type { Base64, KdfParams } from "./types";

const salt = "A".repeat(22) as Base64;

const argon = (
  overrides: Partial<Extract<KdfParams, { kdf: "argon2id" }>> = {},
): KdfParams => ({
  kdf: "argon2id",
  salt,
  ...ARGON2ID_DEFAULTS,
  ...overrides,
});

describe("isKdfParamsAcceptable", () => {
  it("accepts the defaults used for new envelopes", () => {
    expect(isKdfParamsAcceptable(argon())).toBe(true);
    expect(
      isKdfParamsAcceptable({
        kdf: "pbkdf2-sha256",
        salt,
        iterations: PBKDF2_DEFAULT_ITERATIONS,
      }),
    ).toBe(true);
    expect(isKdfParamsAcceptable({ kdf: "hkdf-sha256", salt })).toBe(true);
  });

  it("rejects weakened argon2id parameters", () => {
    expect(isKdfParamsAcceptable(argon({ memoryKiB: 1024 }))).toBe(false);
    expect(isKdfParamsAcceptable(argon({ iterations: 1 }))).toBe(false);
  });

  it("rejects memory-bomb parameters", () => {
    expect(isKdfParamsAcceptable(argon({ memoryKiB: 64 * 1024 * 1024 }))).toBe(
      false,
    );
    expect(isKdfParamsAcceptable(argon({ iterations: 1_000_000 }))).toBe(false);
  });

  it("rejects weak or absurd PBKDF2 iteration counts", () => {
    expect(
      isKdfParamsAcceptable({ kdf: "pbkdf2-sha256", salt, iterations: 1000 }),
    ).toBe(false);
    expect(
      isKdfParamsAcceptable({
        kdf: "pbkdf2-sha256",
        salt,
        iterations: 2 ** 40,
      }),
    ).toBe(false);
  });

  it("rejects non-integer parameters and short salts", () => {
    expect(isKdfParamsAcceptable(argon({ iterations: 2.5 }))).toBe(false);
    expect(isKdfParamsAcceptable(argon({ iterations: Number.NaN }))).toBe(
      false,
    );
    expect(
      isKdfParamsAcceptable({ kdf: "hkdf-sha256", salt: "short" as Base64 }),
    ).toBe(false);
  });
});
