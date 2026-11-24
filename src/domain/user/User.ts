import type { UserId } from '../shared/ids';
import type { Base64, EncryptedPayload, KeyEnvelope } from '../security/types';

/** Sensitive, user-editable data. Stored ONLY encrypted inside `UserAccountRecord`. */
export interface UserProfile {
  /** Email or username. Changeable. Compared after normalisation (see login.ts). */
  readonly login: string;
  readonly displayName: string;
}

/** Decrypted view used by the UI once someone is logged in. */
export interface User extends UserProfile {
  readonly id: UserId;
  readonly publicKey: Base64;
}

/**
 * What is stored locally and in the repository (`vault/accounts/<id>.json`).
 * Written only by its owner. Contains no login, no password and no password hash.
 *
 *   password ──KDF──▶ passwordKey ──unwraps──▶ AccountKey
 *   AccountKey ──decrypts──▶ privateKey, profile
 *
 * Login = unwrap succeeds AND decrypted profile.login matches what was typed.
 * Both failures show the same generic error.
 */
export interface UserAccountRecord {
  readonly id: UserId;
  /** ISO-8601 instant. */
  readonly createdAt: string;
  /** ECDH P-256 public key, SPKI DER. Public by design; used by others to share keys. */
  readonly publicKey: Base64;
  readonly passwordEnvelope: KeyEnvelope;
  /** The same AccountKey wrapped under the recovery code. Null if the user opted out. */
  readonly recoveryEnvelope: KeyEnvelope | null;
  /** PKCS#8 private key encrypted under the AccountKey. */
  readonly encryptedPrivateKey: EncryptedPayload;
  /** `UserProfile` JSON encrypted under the AccountKey. */
  readonly encryptedProfile: EncryptedPayload;
}
