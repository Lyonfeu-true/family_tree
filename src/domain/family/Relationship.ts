import type { FamilyMemberId, FamilyTreeId, RelationshipId } from '../shared/ids';
import type { HlcTimestamp, LwwRecord } from '../shared/hlc';
import type { PartialDate } from './PartialDate';

export const BUILTIN_RELATIONSHIP_TYPES = [
  // family
  'father',
  'mother',
  'son',
  'daughter',
  'brother',
  'sister',
  // romantic
  'married',
  'engaged',
  'relationship',
  'former_relationship',
  'divorced',
  // other
  'other',
] as const;

export type BuiltinRelationshipType = (typeof BUILTIN_RELATIONSHIP_TYPES)[number];

export type RelationshipCategory = 'family' | 'romantic' | 'other';

/** A built-in type, or a user-defined label with an optional colour override. */
export type RelationshipKind =
  | { readonly kind: 'builtin'; readonly type: BuiltinRelationshipType }
  | { readonly kind: 'custom'; readonly label: string; readonly colorHex: string | null };

/**
 * Edge semantics: a relationship from A to B reads "A is the {type} of B".
 * Example: from=Anna, to=Ben, type=mother means Anna is Ben's mother.
 */
export interface RelationshipTypeDefinition {
  readonly category: RelationshipCategory;
  /** Generation of `from` relative to `to`: -1 = one generation above, 0 = same, 1 = below. */
  readonly generationOffset: -1 | 0 | 1;
  /** True if "A type B" implies "B type A" (spouses, siblings). */
  readonly symmetric: boolean;
}

/**
 * Behavioural metadata used by layout and validation.
 * Colours are deliberately NOT here: they are a presentation concern
 * (presentation/tree/relationshipColors.ts).
 */
export const RELATIONSHIP_TYPE_DEFINITIONS: Readonly<
  Record<BuiltinRelationshipType, RelationshipTypeDefinition>
> = {
  father: { category: 'family', generationOffset: -1, symmetric: false },
  mother: { category: 'family', generationOffset: -1, symmetric: false },
  son: { category: 'family', generationOffset: 1, symmetric: false },
  daughter: { category: 'family', generationOffset: 1, symmetric: false },
  brother: { category: 'family', generationOffset: 0, symmetric: true },
  sister: { category: 'family', generationOffset: 0, symmetric: true },
  married: { category: 'romantic', generationOffset: 0, symmetric: true },
  engaged: { category: 'romantic', generationOffset: 0, symmetric: true },
  relationship: { category: 'romantic', generationOffset: 0, symmetric: true },
  former_relationship: { category: 'romantic', generationOffset: 0, symmetric: true },
  divorced: { category: 'romantic', generationOffset: 0, symmetric: true },
  other: { category: 'other', generationOffset: 0, symmetric: true },
};

/** User-facing, editable attributes of a relationship (plain view). */
export interface RelationshipFields {
  readonly kind: RelationshipKind;
  readonly startDate: PartialDate | null;
  readonly endDate: PartialDate | null;
}

/** Plain view used by the UI and use cases. */
export interface Relationship extends RelationshipFields {
  readonly id: RelationshipId;
  readonly treeId: FamilyTreeId;
  readonly fromId: FamilyMemberId;
  readonly toId: FamilyMemberId;
}

/** Replicated (synchronised) representation. `fromId`/`toId` are immutable identity. */
export interface RelationshipRecord {
  readonly id: RelationshipId;
  readonly treeId: FamilyTreeId;
  readonly fromId: FamilyMemberId;
  readonly toId: FamilyMemberId;
  readonly createdAt: HlcTimestamp;
  readonly fields: LwwRecord<RelationshipFields>;
  /** Tombstone. Delete wins over concurrent edits and is never undone. */
  readonly deletedAt: HlcTimestamp | null;
}
