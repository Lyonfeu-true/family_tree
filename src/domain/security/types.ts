import type { Brand, FamilyTreeId, UserId } from "../shared/ids";

export type Base64 = Brand<string, "Base64">;

/** AES-256-GCM output. The 128-bit GCM auth tag is appended to the ciphertext. */
export interface EncryptedPayload {
  readonly version: 1;
  readonly algorithm: "AES-256-GCM";
  /** 96-bit random nonce, unique per encryption. */
  readonly iv: Base64;
  readonly ciphertext: Base64;
}

export type KdfParams =
  | {
      readonly kdf: "argon2id";
      readonly salt: Base64;
      readonly memoryKiB: number;
      readonly iterations: number;
      readonly parallelism: number;
    }
  | {
      readonly kdf: "pbkdf2-sha256";
      readonly salt: Base64;
      readonly iterations: number;
    }
  /** Only for high-entropy secrets (the recovery code). Never for passwords. */
  | {
      readonly kdf: "hkdf-sha256";
      readonly salt: Base64;
    };

/**
 * A key wrapped under a key derived from a secret. The KDF parameters travel with it
 * so they can be strengthened later without breaking existing accounts.
 */
export interface KeyEnvelope {
  readonly kdf: KdfParams;
  readonly wrappedKey: EncryptedPayload;
}

/**
 * A key encrypted to a recipient's public key (ECIES-style "sealed box"):
 * ephemeral ECDH P-256 -> HKDF-SHA256 -> AES-256-GCM.
 * Anyone holding the key can seal it to any public key; only the recipient can open it.
 */
export interface SealedKey {
  readonly version: 1;
  readonly algorithm: "ECDH-P256+HKDF-SHA256+AES-256-GCM";
  /** SPKI DER, Base64. */
  readonly ephemeralPublicKey: Base64;
  readonly iv: Base64;
  readonly ciphertext: Base64;
}

/** Gives one user access to one version of one tree key. Written once, never edited. */
export interface TreeKeyGrant {
  readonly treeId: FamilyTreeId;
  readonly keyVersion: number;
  readonly recipientId: UserId;
  readonly grantedBy: UserId;
  readonly sealedTreeKey: SealedKey;
}
