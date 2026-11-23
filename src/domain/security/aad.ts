import type { DeviceId, FamilyTreeId, PhotoId, UserId } from "../shared/ids";

/**
 * Additional Authenticated Data builders.
 *
 * AES-GCM authenticates the AAD without encrypting it. Binding every ciphertext to
 * its purpose and location means a repository writer cannot move a valid ciphertext
 * to another file, tree, user or key version: decryption fails instead.
 * Every call site uses these builders, never ad-hoc strings.
 */
const P = "ft1"; // format prefix, bump when the AAD scheme changes

export const aad = {
  accountKey: (user: UserId): string => `${P}|account-key|${user}`,
  recoveryKey: (user: UserId): string => `${P}|recovery-key|${user}`,
  privateKey: (user: UserId): string => `${P}|private-key|${user}`,
  profile: (user: UserId): string => `${P}|profile|${user}`,
  syncConfig: (user: UserId): string => `${P}|sync-config|${user}`,
  grant: (tree: FamilyTreeId, version: number, recipient: UserId): string =>
    `${P}|grant|${tree}|${version}|${recipient}`,
  opsBatch: (
    tree: FamilyTreeId,
    version: number,
    device: DeviceId,
    firstSeq: number,
    lastSeq: number,
  ): string => `${P}|ops|${tree}|${version}|${device}|${firstSeq}-${lastSeq}`,
  snapshot: (tree: FamilyTreeId, version: number, snapshotId: string): string =>
    `${P}|snapshot|${tree}|${version}|${snapshotId}`,
  photo: (tree: FamilyTreeId, version: number, photo: PhotoId): string =>
    `${P}|photo|${tree}|${version}|${photo}`,
  roster: (tree: FamilyTreeId, version: number, member: UserId): string =>
    `${P}|roster|${tree}|${version}|${member}`,
  localState: (tree: FamilyTreeId, version: number): string =>
    `${P}|local-state|${tree}|${version}`,
} as const;
