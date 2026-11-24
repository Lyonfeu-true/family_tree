import type { FamilyMemberFields } from '../family/FamilyMember';
import type {
  BuiltinRelationshipType,
  RelationshipFields,
  RelationshipKind,
} from '../family/Relationship';
import { parseHlc, receiveHlc, stampHlc, tickHlc } from '../shared/hlc';
import type { HlcState } from '../shared/hlc';
import type {
  DeviceId,
  FamilyMemberId,
  FamilyTreeId,
  OperationId,
  RelationshipId,
  UserId,
} from '../shared/ids';
import type { Operation } from '../sync/Operation';

export const TREE = 'tree-1' as FamilyTreeId;
export const USER = 'user-1' as UserId;
export const deviceId = (name: string): DeviceId => name as DeviceId;
export const memberId = (name: string): FamilyMemberId => name as FamilyMemberId;
export const relationshipId = (name: string): RelationshipId => name as RelationshipId;
export const builtin = (type: BuiltinRelationshipType): RelationshipKind => ({ kind: 'builtin', type });

export function memberFields(
  name: string,
  overrides: Partial<FamilyMemberFields> = {},
): FamilyMemberFields {
  return {
    name,
    photoId: null,
    birthDate: null,
    deathDate: null,
    notes: '',
    relationshipStatus: null,
    ...overrides,
  };
}

export function relationshipFields(
  kind: RelationshipKind,
  overrides: Partial<RelationshipFields> = {},
): RelationshipFields {
  return { kind, startDate: null, endDate: null, ...overrides };
}

/** Simulates one device: keeps its own clock and sequence and stamps operations. */
export function createWriter(device: DeviceId, treeId: FamilyTreeId = TREE, authorId: UserId = USER) {
  let clock: HlcState = { wallMs: 0, counter: 0 };
  let seq = 0;
  const base = (nowMs: number) => {
    clock = tickHlc(clock, nowMs);
    seq += 1;
    return {
      id: `${device}:${seq}` as OperationId,
      treeId,
      authorId,
      deviceId: device,
      seq,
      hlc: stampHlc(clock, device),
    };
  };
  return {
    /** Tell this device about another device's operation, as syncing would. */
    observe(op: Operation, nowMs: number): void {
      const parts = parseHlc(op.hlc);
      if (parts) clock = receiveHlc(clock, parts, nowMs);
    },
    createTree: (name: string, nowMs: number) => ({ ...base(nowMs), type: 'tree.create' as const, name }),
    renameTree: (name: string, nowMs: number) => ({ ...base(nowMs), type: 'tree.rename' as const, name }),
    setRoot: (rootPersonId: FamilyMemberId | null, nowMs: number) => ({
      ...base(nowMs),
      type: 'tree.setRoot' as const,
      rootPersonId,
    }),
    deleteTree: (nowMs: number) => ({ ...base(nowMs), type: 'tree.delete' as const }),
    createMember: (id: FamilyMemberId, fields: FamilyMemberFields, nowMs: number) => ({
      ...base(nowMs),
      type: 'member.create' as const,
      memberId: id,
      fields,
    }),
    updateMember: (id: FamilyMemberId, patch: Partial<FamilyMemberFields>, nowMs: number) => ({
      ...base(nowMs),
      type: 'member.update' as const,
      memberId: id,
      patch,
    }),
    deleteMember: (id: FamilyMemberId, nowMs: number) => ({
      ...base(nowMs),
      type: 'member.delete' as const,
      memberId: id,
    }),
    createRelationship: (
      id: RelationshipId,
      fromId: FamilyMemberId,
      toId: FamilyMemberId,
      fields: RelationshipFields,
      nowMs: number,
    ) => ({ ...base(nowMs), type: 'relationship.create' as const, relationshipId: id, fromId, toId, fields }),
    updateRelationship: (id: RelationshipId, patch: Partial<RelationshipFields>, nowMs: number) => ({
      ...base(nowMs),
      type: 'relationship.update' as const,
      relationshipId: id,
      patch,
    }),
    deleteRelationship: (id: RelationshipId, nowMs: number) => ({
      ...base(nowMs),
      type: 'relationship.delete' as const,
      relationshipId: id,
    }),
  };
}
