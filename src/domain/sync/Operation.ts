import type {
  DeviceId,
  FamilyMemberId,
  FamilyTreeId,
  OperationId,
  RelationshipId,
  UserId,
} from '../shared/ids';
import type { HlcTimestamp } from '../shared/hlc';
import type { FamilyMemberFields } from '../family/FamilyMember';
import type { RelationshipFields } from '../family/Relationship';
 
/**
 * Every edit is an immutable operation appended to the author device's own log
 * file. Applying an operation sets each field it touches to (value, op.hlc) only if
 * op.hlc is newer than the field's current clock, which makes merging idempotent,
 * commutative and associative.
 */
interface BaseOperation {
  readonly id: OperationId;
  readonly treeId: FamilyTreeId;
  readonly authorId: UserId;
  readonly deviceId: DeviceId;
  /** Per-device, gapless, monotonically increasing. Used as the sync cursor. */
  readonly seq: number;
  readonly hlc: HlcTimestamp;
}
 
export interface CreateMemberOperation extends BaseOperation {
  readonly type: 'member.create';
  readonly memberId: FamilyMemberId;
  readonly fields: FamilyMemberFields;
}
export interface UpdateMemberOperation extends BaseOperation {
  readonly type: 'member.update';
  readonly memberId: FamilyMemberId;
  readonly patch: Partial<FamilyMemberFields>;
}
export interface DeleteMemberOperation extends BaseOperation {
  readonly type: 'member.delete';
  readonly memberId: FamilyMemberId;
}
 
export interface CreateRelationshipOperation extends BaseOperation {
  readonly type: 'relationship.create';
  readonly relationshipId: RelationshipId;
  readonly fromId: FamilyMemberId;
  readonly toId: FamilyMemberId;
  readonly fields: RelationshipFields;
}
export interface UpdateRelationshipOperation extends BaseOperation {
  readonly type: 'relationship.update';
  readonly relationshipId: RelationshipId;
  readonly patch: Partial<RelationshipFields>;
}
export interface DeleteRelationshipOperation extends BaseOperation {
  readonly type: 'relationship.delete';
  readonly relationshipId: RelationshipId;
}
 
export interface RenameTreeOperation extends BaseOperation {
  readonly type: 'tree.rename';
  readonly name: string;
}
export interface SetRootOperation extends BaseOperation {
  readonly type: 'tree.setRoot';
  readonly rootPersonId: FamilyMemberId | null;
}
export interface DeleteTreeOperation extends BaseOperation {
  readonly type: 'tree.delete';
}
 
export type Operation =
  | CreateMemberOperation
  | UpdateMemberOperation
  | DeleteMemberOperation
  | CreateRelationshipOperation
  | UpdateRelationshipOperation
  | DeleteRelationshipOperation
  | RenameTreeOperation
  | SetRootOperation
  | DeleteTreeOperation;
 
export type OperationType = Operation['type'];
 
