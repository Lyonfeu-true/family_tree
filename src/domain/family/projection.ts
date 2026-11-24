import { unwrapLww } from '../shared/lww';
import type { FamilyMember, FamilyMemberFields, FamilyMemberRecord } from './FamilyMember';
import type { FamilyTree, FamilyTreeFields, FamilyTreeState } from './FamilyTree';
import type { Relationship, RelationshipFields } from './Relationship';

/** What the UI works with: plain, validated-by-construction views of the replicated state. */
export interface FamilyTreeView {
  readonly tree: FamilyTree;
  readonly members: readonly FamilyMember[];
  readonly relationships: readonly Relationship[];
}

const byCreation = (a: FamilyMemberRecord, b: FamilyMemberRecord): number =>
  a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1;

/**
 * Builds the visible tree. Returns null if the tree is deleted.
 *  - tombstoned members are hidden;
 *  - relationships with a hidden or unknown endpoint are hidden (not deleted), so
 *    "add relationship to X" and "delete X" converge in any order;
 *  - a root that is hidden or unknown resolves to null.
 * Output order is deterministic so identical states render identically on every device.
 */
export function projectTree(state: FamilyTreeState): FamilyTreeView | null {
  if (state.tree.deletedAt !== null) return null;

  const visibleRecords = Object.values(state.members)
    .filter((record) => record.deletedAt === null)
    .sort(byCreation);
  const visibleIds = new Set(visibleRecords.map((record) => record.id));

  const members: FamilyMember[] = visibleRecords.map((record) => ({
    id: record.id,
    treeId: record.treeId,
    ...unwrapLww<FamilyMemberFields>(record.fields),
  }));

  const relationships: Relationship[] = Object.values(state.relationships)
    .filter(
      (record) =>
        record.deletedAt === null && visibleIds.has(record.fromId) && visibleIds.has(record.toId),
    )
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1))
    .map((record) => ({
      id: record.id,
      treeId: record.treeId,
      fromId: record.fromId,
      toId: record.toId,
      ...unwrapLww<RelationshipFields>(record.fields),
    }));

  const fields = unwrapLww<FamilyTreeFields>(state.tree.fields);
  const rootPersonId =
    fields.rootPersonId !== null && visibleIds.has(fields.rootPersonId) ? fields.rootPersonId : null;

  return {
    tree: { id: state.tree.id, name: fields.name, rootPersonId },
    members,
    relationships,
  };
}
