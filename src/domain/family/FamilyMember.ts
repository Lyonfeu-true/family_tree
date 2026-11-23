import type { FamilyMemberId, FamilyTreeId, PhotoId } from '../shared/ids';
import type { HlcTimestamp, LwwRecord } from '../shared/hlc';
import type { PartialDate } from './PartialDate';

export const RELATIONSHIP_STATUSES = [
  'single',
  'in_relationship',
  'engaged',
  'married',
  'divorced',
  'widowed',
] as const;

export type RelationshipStatus = (typeof RELATIONSHIP_STATUSES)[number];

/** User-editable attributes. Only `name` is required. */
export interface FamilyMemberFields {
  /** Non-empty after trimming. */
  readonly name: string;
  /** Reference to an encrypted photo blob stored separately, never inlined. */
  readonly photoId: PhotoId | null;
  readonly birthDate: PartialDate | null;
  readonly deathDate: PartialDate | null;
  /** Unlimited length. Empty string when unset. */
  readonly notes: string;
  readonly relationshipStatus: RelationshipStatus | null;
}

/** Plain view used by the UI and use cases. */
export interface FamilyMember extends FamilyMemberFields {
  readonly id: FamilyMemberId;
  readonly treeId: FamilyTreeId;
}

/** Replicated (synchronised) representation: every field is its own LWW register. */
export interface FamilyMemberRecord {
  readonly id: FamilyMemberId;
  readonly treeId: FamilyTreeId;
  readonly createdAt: HlcTimestamp;
  readonly fields: LwwRecord<FamilyMemberFields>;
  /** Tombstone. Delete wins over concurrent edits and is never undone. */
  readonly deletedAt: HlcTimestamp | null;
}
