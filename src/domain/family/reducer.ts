import type { CreateMemberOperation, CreateRelationshipOperation, Operation } from '../sync/Operation';
import { compareHlc, maxHlc, minHlc } from '../shared/hlc';
import type { HlcTimestamp } from '../shared/hlc';
import { lwwRecordOf, mergePatch } from '../shared/lww';
import type { FamilyMemberRecord } from './FamilyMember';
import type { FamilyTreeRecord, FamilyTreeState } from './FamilyTree';
import type { RelationshipRecord } from './Relationship';

/**
 * The merge function of the whole system. It folds operations into a tree state.
 *
 * Guarantees (all covered by tests):
 *  - Idempotent:   applying an operation twice equals applying it once.
 *  - Convergent:   every device that has the same set of operations reaches the same state,
 *                  regardless of arrival order or batching.
 *  - Total:        never throws on well-typed input; unusable operations are reported, not lost.
 *
 * Rules: each field is a last-writer-wins register; deletion is a permanent tombstone
 * (delete wins); an operation that targets something not yet known is DEFERRED, and the
 * caller retries it together with the next batch.
 */

export type ApplyOutcome =
  | { readonly kind: 'applied'; readonly state: FamilyTreeState }
  | { readonly kind: 'deferred' }
  | { readonly kind: 'rejected' };

export interface ApplyResult {
  readonly state: FamilyTreeState | null;
  /** Operations whose target is not known yet. Feed them back with the next batch. */
  readonly deferred: readonly Operation[];
  /** Operations that belong to a different tree. Never retried. */
  readonly rejected: readonly Operation[];
}

const laterOf = (current: HlcTimestamp | null, incoming: HlcTimestamp): HlcTimestamp =>
  current === null ? incoming : maxHlc(current, incoming);

const withTree = (state: FamilyTreeState, tree: FamilyTreeRecord): FamilyTreeState => ({
  ...state,
  tree,
});

const withMember = (state: FamilyTreeState, record: FamilyMemberRecord): FamilyTreeState => ({
  ...state,
  members: { ...state.members, [record.id]: record },
});

const withRelationship = (state: FamilyTreeState, record: RelationshipRecord): FamilyTreeState => ({
  ...state,
  relationships: { ...state.relationships, [record.id]: record },
});

function newTreeState(op: Extract<Operation, { type: 'tree.create' }>): FamilyTreeState {
  return {
    tree: {
      id: op.treeId,
      createdAt: op.hlc,
      fields: lwwRecordOf({ name: op.name, rootPersonId: null }, op.hlc),
      deletedAt: null,
    },
    members: {},
    relationships: {},
  };
}

function upsertMember(state: FamilyTreeState, op: CreateMemberOperation): FamilyTreeState {
  const existing = state.members[op.memberId];
  if (!existing) {
    return withMember(state, {
      id: op.memberId,
      treeId: op.treeId,
      createdAt: op.hlc,
      fields: lwwRecordOf(op.fields, op.hlc),
      deletedAt: null,
    });
  }
  return withMember(state, {
    ...existing,
    createdAt: minHlc(existing.createdAt, op.hlc),
    fields: mergePatch(existing.fields, op.fields, op.hlc),
  });
}

function upsertRelationship(
  state: FamilyTreeState,
  op: CreateRelationshipOperation,
): FamilyTreeState {
  const existing = state.relationships[op.relationshipId];
  if (!existing) {
    return withRelationship(state, {
      id: op.relationshipId,
      treeId: op.treeId,
      fromId: op.fromId,
      toId: op.toId,
      createdAt: op.hlc,
      fields: lwwRecordOf(op.fields, op.hlc),
      deletedAt: null,
    });
  }
  return withRelationship(state, {
    ...existing,
    createdAt: minHlc(existing.createdAt, op.hlc),
    fields: mergePatch(existing.fields, op.fields, op.hlc),
  });
}

export function applyOperation(state: FamilyTreeState | null, op: Operation): ApplyOutcome {
  if (op.type === 'tree.create') {
    if (state === null) return { kind: 'applied', state: newTreeState(op) };
    if (state.tree.id !== op.treeId) return { kind: 'rejected' };
    const { tree } = state;
    return {
      kind: 'applied',
      state: withTree(state, {
        ...tree,
        createdAt: minHlc(tree.createdAt, op.hlc),
        fields: mergePatch(tree.fields, { name: op.name }, op.hlc),
      }),
    };
  }

  if (state === null) return { kind: 'deferred' };
  if (state.tree.id !== op.treeId) return { kind: 'rejected' };
  const applied = (next: FamilyTreeState): ApplyOutcome => ({ kind: 'applied', state: next });

  switch (op.type) {
    case 'tree.rename':
      return applied(
        withTree(state, {
          ...state.tree,
          fields: mergePatch(state.tree.fields, { name: op.name }, op.hlc),
        }),
      );
    case 'tree.setRoot':
      return applied(
        withTree(state, {
          ...state.tree,
          fields: mergePatch(state.tree.fields, { rootPersonId: op.rootPersonId }, op.hlc),
        }),
      );
    case 'tree.delete':
      return applied(
        withTree(state, { ...state.tree, deletedAt: laterOf(state.tree.deletedAt, op.hlc) }),
      );
    case 'member.create':
      return applied(upsertMember(state, op));
    case 'member.update': {
      const record = state.members[op.memberId];
      if (!record) return { kind: 'deferred' };
      return applied(
        withMember(state, { ...record, fields: mergePatch(record.fields, op.patch, op.hlc) }),
      );
    }
    case 'member.delete': {
      const record = state.members[op.memberId];
      if (!record) return { kind: 'deferred' };
      return applied(withMember(state, { ...record, deletedAt: laterOf(record.deletedAt, op.hlc) }));
    }
    case 'relationship.create':
      return applied(upsertRelationship(state, op));
    case 'relationship.update': {
      const record = state.relationships[op.relationshipId];
      if (!record) return { kind: 'deferred' };
      return applied(
        withRelationship(state, {
          ...record,
          fields: mergePatch(record.fields, op.patch, op.hlc),
        }),
      );
    }
    case 'relationship.delete': {
      const record = state.relationships[op.relationshipId];
      if (!record) return { kind: 'deferred' };
      return applied(
        withRelationship(state, { ...record, deletedAt: laterOf(record.deletedAt, op.hlc) }),
      );
    }
  }
}

const compareOperations = (a: Operation, b: Operation): number =>
  compareHlc(a.hlc, b.hlc) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Applies a batch. Operations are processed in clock order, and deferred ones are retried
 * until a pass makes no progress.
 */
export function applyOperations(
  state: FamilyTreeState | null,
  operations: readonly Operation[],
): ApplyResult {
  let current = state;
  let pending = [...operations].sort(compareOperations);
  const rejected: Operation[] = [];

  for (;;) {
    const deferred: Operation[] = [];
    let progressed = false;
    for (const op of pending) {
      const outcome = applyOperation(current, op);
      if (outcome.kind === 'applied') {
        current = outcome.state;
        progressed = true;
      } else if (outcome.kind === 'deferred') {
        deferred.push(op);
      } else {
        rejected.push(op);
      }
    }
    pending = deferred;
    if (!progressed || deferred.length === 0) {
      return { state: current, deferred, rejected };
    }
  }
}

