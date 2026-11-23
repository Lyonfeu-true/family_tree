import type { Brand, FamilyTreeId } from '../shared/ids';
 
export type Base64 = Brand<string, 'Base64'>;
 
/** AES-256-GCM output. The GCM auth tag is appended to the ciphertext. */
export interface EncryptedPayload {
  readonly version: 1;
  readonly algorithm: 'AES-256-GCM';
  /** 96-bit random nonce, unique per encryption. */
  readonly iv: Base64;
  readonly ciphertext: Base64;
}
 
export type KdfParams =
  | {
      readonly kdf: 'argon2id';
      readonly salt: Base64;
      readonly memoryKiB: number;
      readonly iterations: number;
      readonly parallelism: number;
    }
  | {
      readonly kdf: 'pbkdf2-sha256';
      readonly salt: Base64;
      readonly iterations: number;
    };
 
/**
 * A secret key wrapped (encrypted) under a key derived from a password or recovery code.
 * Parameters are stored so they can be raised later without breaking old accounts.
 */
export interface KeyEnvelope {
  readonly kdf: KdfParams;
  readonly wrappedKey: EncryptedPayload;
}
 
/** A tree's data key, wrapped under the user's account key. `keyVersion` supports rotation. */
export interface TreeKeyGrant {
  readonly treeId: FamilyTreeId;
  readonly keyVersion: number;
  readonly wrappedTreeKey: EncryptedPayload;
}
 
