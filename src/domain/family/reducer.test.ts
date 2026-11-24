import { describe, expect, it } from 'vitest';

import type { PartialDate } from './PartialDate';
import { projectTree } from './projection';
import { applyOperations } from './reducer';
import type { FamilyTreeState } from './FamilyTree';
import type { Operation } from '../sync/Operation';
import {
  TREE,
  builtin,
  createWriter,
  deviceId,
  memberFields,
  memberId,
  relationshipFields,
  relationshipId,
} from '../testing/builders';
import { createRng, shuffled } from '../testing/random';
import { generateScenario } from '../testing/scenario';

const run = (ops: readonly Operation[]) => applyOperations(null, ops);
const stateOf = (ops: readonly Operation[]): FamilyTreeState => {
  const { state } = run(ops);
  if (!state) throw new Error('expected a state');
  return state;
};
const view = (ops: readonly Operation[]) => {
  const v = projectTree(stateOf(ops));
  if (!v) throw new Error('expected a view');
  return v;
};

const m1 = memberId('m1');
const m2 = memberId('m2');

/** Device A creates a tree with two people, and device B has seen it. */
function setup() {
  const a = createWriter(deviceId('A'));
  const b = createWriter(deviceId('B'));
  const base = [
    a.createTree('Family', 1000),
    a.createMember(m1, memberFields('Anna'), 1001),
    a.createMember(m2, memberFields('Ben'), 1002),
  ];
  base.forEach((op) => b.observe(op, 1100));
  return { a, b, base };
}

describe('building state', () => {
  it('creates a tree, people and relationships', () => {
    const { a, base } = setup();
    const ops = [...base, a.createRelationship(relationshipId('r1'), m1, m2, relationshipFields(builtin('married')), 1003)];
    const v = view(ops);
    expect(v.tree.name).toBe('Family');
    expect(v.members.map((m) => m.name)).toEqual(['Anna', 'Ben']);
    expect(v.relationships).toHaveLength(1);
  });

  it('rejects operations that belong to another tree', () => {
    const { base } = setup();
    const stranger = createWriter(deviceId('X'), 'other-tree' as typeof TREE);
    const result = applyOperations(stateOf(base), [stranger.createMember(memberId('z'), memberFields('Z'), 5000)]);
    expect(result.rejected).toHaveLength(1);
    expect(Object.keys(result.state!.members)).toHaveLength(2);
  });
});

describe('concurrent edits', () => {
  it('keeps edits to different fields from different devices', () => {
    const { a, b, base } = setup();
    const e1 = a.updateMember(m1, { notes: 'likes tea' }, 2000);
    const e2 = b.updateMember(m1, { birthDate: '1988' as PartialDate }, 2001);
    const forward = stateOf([...base, e1, e2]);
    const backward = stateOf([...base, e2, e1]);
    expect(forward).toEqual(backward);
    const anna = projectTree(forward)!.members[0]!;
    expect(anna.notes).toBe('likes tea');
    expect(anna.birthDate).toBe('1988');
  });

  it('resolves a same-field conflict by the later clock, in any order', () => {
    const { a, b, base } = setup();
    const e1 = a.updateMember(m1, { name: 'Alice' }, 2000);
    const e2 = b.updateMember(m1, { name: 'Alicia' }, 2005);
    for (const order of [[e1, e2], [e2, e1]]) {
      expect(view([...base, ...order]).members[0]!.name).toBe('Alicia');
    }
  });

  it('picks exactly one root when two devices set it at once', () => {
    const { a, b, base } = setup();
    const r1 = a.setRoot(m1, 2000);
    const r2 = b.setRoot(m2, 2001);
    const one = view([...base, r1, r2]).tree.rootPersonId;
    const other = view([...base, r2, r1]).tree.rootPersonId;
    expect(one).toBe(m2);
    expect(other).toBe(m2);
  });
});

describe('deletion', () => {
  it('delete wins over a concurrent later edit and nothing resurrects it', () => {
    const { a, b, base } = setup();
    const del = a.deleteMember(m1, 2000);
    const edit = b.updateMember(m1, { name: 'Zed' }, 3000);
    for (const order of [[del, edit], [edit, del]]) {
      expect(view([...base, ...order]).members.map((m) => m.name)).toEqual(['Ben']);
    }
  });

  it('hides relationships with a deleted endpoint without deleting them', () => {
    const { a, base } = setup();
    const rel = a.createRelationship(relationshipId('r1'), m1, m2, relationshipFields(builtin('brother')), 1003);
    const state = stateOf([...base, rel, a.deleteMember(m2, 2000)]);
    expect(projectTree(state)!.relationships).toHaveLength(0);
    expect(state.relationships['r1']!.deletedAt).toBeNull();
  });

  it('resolves a root pointing at a deleted person to null', () => {
    const { a, base } = setup();
    const v = view([...base, a.setRoot(m1, 1500), a.deleteMember(m1, 2000)]);
    expect(v.tree.rootPersonId).toBeNull();
  });

  it('hides a deleted tree', () => {
    const { a, base } = setup();
    expect(projectTree(stateOf([...base, a.deleteTree(2000)]))).toBeNull();
  });
});

describe('ordering and idempotence', () => {
  it('defers an update whose target is unknown, then applies it with the next batch', () => {
    const { a, b, base } = setup();
    const edit = b.updateMember(m1, { name: 'Late' }, 2000);
    const first = applyOperations(null, [edit]);
    expect(first.state).toBeNull();
    expect(first.deferred).toHaveLength(1);
    const second = applyOperations(first.state, [...first.deferred, ...base]);
    expect(second.deferred).toHaveLength(0);
    expect(projectTree(second.state!)!.members[0]!.name).toBe('Late');
    expect(a).not.toBe(b);
  });

  it('defers an update to a person who is not known yet, even when the tree exists', () => {
    const { b, base } = setup();
    const treeOnly = stateOf([base[0]!]);
    const result = applyOperations(treeOnly, [b.updateMember(m1, { name: 'Early' }, 2000)]);
    expect(result.deferred).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
  });

  it('keeps the latest of two deletions whatever the order', () => {
    const { a, b, base } = setup();
    const early = a.deleteMember(m1, 2000);
    const late = b.deleteMember(m1, 3000);
    // separate batches, so the clock sort inside one batch cannot hide an ordering bug
    const lateFirst = applyOperations(applyOperations(null, [...base, late]).state, [early]).state!;
    const earlyFirst = applyOperations(applyOperations(null, [...base, early]).state, [late]).state!;
    expect(lateFirst).toEqual(earlyFirst);
    expect(lateFirst.members['m1']!.deletedAt).toBe(late.hlc);
  });

  it('is idempotent', () => {
    const { a, base } = setup();
    const ops = [...base, a.updateMember(m1, { notes: 'x' }, 2000)];
    const once = stateOf(ops);
    const twice = applyOperations(once, ops).state;
    expect(twice).toEqual(once);
  });
});

describe('convergence under any delivery order', () => {
  it('reaches the same state for 40 random multi-device histories', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const ops = generateScenario(seed);
      const canonical = stateOf(ops);
      expect(run(ops).deferred).toHaveLength(0);
      const rng = createRng(seed * 7919);
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const order = shuffled(ops, rng);
        let state: FamilyTreeState | null = null;
        let deferred: readonly Operation[] = [];
        for (let i = 0; i < order.length; ) {
          const size = 1 + Math.floor(rng() * 8);
          const result = applyOperations(state, [...deferred, ...order.slice(i, i + size)]);
          state = result.state;
          deferred = result.deferred;
          i += size;
        }
        expect(deferred).toHaveLength(0);
        expect(state).toEqual(canonical);
      }
    }
  });
});
