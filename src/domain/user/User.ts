import type { UserId } from '../shared/ids';
import type { KeyEnvelope, TreeKeyGrant } from '../security/types';
 
/**
 * There is no server, so an "account" is a vault entry, not a password record.
 *  - No password or password hash is stored anywhere.
 *  - "Login" = deriving a key from the password and successfully unwrapping
 *    `passwordEnvelope` (AES-GCM authentication fails on a wrong password).
 *  - "Change password" = re-wrap the account key under a new envelope.
 *  - "Change login" = update `login` only; the key material is unaffected.
 *  - "Delete account" = remove this entry and its grants.
 *
 * PROVISIONAL: how a login is located on a fresh device, and how entries are
 * shared across devices, is finalised in Phase 3 (security design).
 */
export interface UserAccount {
  readonly id: UserId;
  /** Email or username. Changeable. */
  readonly login: string;
  readonly displayName: string;
  /** ISO-8601 instant. */
  readonly createdAt: string;
  /** Wraps the account key; unlocked by the password. */
  readonly passwordEnvelope: KeyEnvelope;
  /** Optional wrap of the same account key under a printed recovery code. */
  readonly recoveryEnvelope: KeyEnvelope | null;
  readonly treeKeyGrants: readonly TreeKeyGrant[];
}
 
