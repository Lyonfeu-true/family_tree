import type {
  FamilyMemberId,
  FamilyTreeId,
  RelationshipId,
} from "../shared/ids";
import type { HlcTimestamp, LwwRecord } from "../shared/hlc";
import type { FamilyMemberRecord } from "./FamilyMember";
import type { RelationshipRecord } from "./Relationship";

export interface FamilyTreeFields {
  readonly name: string;
  /**
   * The root / center person. Stored on the TREE (one register), not as a flag on
   * each person, so two concurrent "make X root" edits can never leave two roots:
   * LWW picks exactly one.
   */
  readonly rootPersonId: FamilyMemberId | null;
}

/** Plain view used by the UI and use cases. */
export interface FamilyTree extends FamilyTreeFields {
  readonly id: FamilyTreeId;
}

export interface FamilyTreeRecord {
  readonly id: FamilyTreeId;
  readonly createdAt: HlcTimestamp;
  readonly fields: LwwRecord<FamilyTreeFields>;
  readonly deletedAt: HlcTimestamp | null;
}

/**
 * Complete replicated state of one tree. This is what IndexedDB persists and what
 * snapshots encrypt. Keys are the entity ids (plain strings so it serialises to JSON).
 *
 * Projection rules (applied when building the plain views, not when merging):
 *  - a relationship whose endpoint is tombstoned is hidden, not deleted, so
 *    "add relationship to X" and "delete X" converge regardless of arrival order;
 *  - a root that points at a tombstoned/unknown person is treated as null.
 */
export interface FamilyTreeState {
  readonly tree: FamilyTreeRecord;
  readonly members: Readonly<Record<string, FamilyMemberRecord>>;
  readonly relationships: Readonly<Record<string, RelationshipRecord>>;
}

export type { RelationshipId };
