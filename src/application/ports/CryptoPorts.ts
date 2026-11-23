import type { Result } from "@shared/result";
import type {
  Base64,
  EncryptedPayload,
  KdfParams,
  SealedKey,
} from "@domain/security/types";

/**
 * Opaque key handles. The application layer never sees raw key bytes or `CryptoKey`;
 * the infrastructure adapter owns the representation (non-extractable by default).
 */
declare const handle: unique symbol;
export interface SymmetricKey {
  readonly [handle]: "SymmetricKey";
}
export interface PrivateKey {
  readonly [handle]: "PrivateKey";
}

export type CryptoError =
  "DECRYPTION_FAILED" | "INVALID_PARAMS" | "UNSUPPORTED";

/**
 * Sensitive operations (change password, share a tree, rotate keys, show recovery code)
 * need the raw key to re-wrap it, so the caller asks for `extractable: true` after the user
 * re-enters their password. Everything else uses the default `false`.
 */
export interface UnwrapOptions {
  readonly extractable: boolean;
}

export interface KdfPort {
  /** Fresh random salt. Falls back to PBKDF2 when WASM is unavailable. */
  createParams(preferred: "argon2id" | "pbkdf2-sha256"): Promise<KdfParams>;
  /** Derives a non-extractable key-wrapping key. Rejects params outside the policy bounds. */
  deriveWrappingKey(
    secret: string,
    params: KdfParams,
  ): Promise<Result<SymmetricKey, CryptoError>>;
}

export interface CipherPort {
  generateKey(): Promise<SymmetricKey>;
  encrypt(
    key: SymmetricKey,
    plaintext: Uint8Array,
    aad: string,
  ): Promise<EncryptedPayload>;
  decrypt(
    key: SymmetricKey,
    payload: EncryptedPayload,
    aad: string,
  ): Promise<Result<Uint8Array, CryptoError>>;
  /** `key` must have been created/unwrapped as extractable. */
  wrapKey(
    wrappingKey: SymmetricKey,
    key: SymmetricKey,
    aad: string,
  ): Promise<EncryptedPayload>;
  unwrapKey(
    wrappingKey: SymmetricKey,
    payload: EncryptedPayload,
    aad: string,
    options: UnwrapOptions,
  ): Promise<Result<SymmetricKey, CryptoError>>;
}

export interface KeyExchangePort {
  /** The private key is returned extractable only so it can be wrapped once at creation. */
  generateKeyPair(): Promise<{
    readonly publicKey: Base64;
    readonly privateKey: PrivateKey;
  }>;
  wrapPrivateKey(
    privateKey: PrivateKey,
    wrappingKey: SymmetricKey,
    aad: string,
  ): Promise<EncryptedPayload>;
  unwrapPrivateKey(
    wrappingKey: SymmetricKey,
    payload: EncryptedPayload,
    aad: string,
  ): Promise<Result<PrivateKey, CryptoError>>;
  sealKey(
    key: SymmetricKey,
    recipientPublicKey: Base64,
    aad: string,
  ): Promise<SealedKey>;
  openSealedKey(
    privateKey: PrivateKey,
    sealed: SealedKey,
    aad: string,
    options: UnwrapOptions,
  ): Promise<Result<SymmetricKey, CryptoError>>;
  /** Short human-comparable code, e.g. `K7QM2-X9PD4-TT8RA-WN3VB`, from SHA-256 of the key. */
  fingerprint(publicKey: Base64): Promise<string>;
}

export interface RecoveryCodePort {
  /** 160 random bits as 8 groups of 4 Base32 characters. Shown once, never stored. */
  generate(): string;
  /** Strips spaces and dashes, upper-cases, validates the alphabet and length. */
  normalize(input: string): Result<string, "INVALID_RECOVERY_CODE">;
}
