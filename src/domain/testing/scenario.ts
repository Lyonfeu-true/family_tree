import type { Operation } from '../sync/Operation';
import { builtin, createWriter, deviceId, memberFields, memberId, relationshipFields, relationshipId } from './builders';
import { createRng } from './random';
import type { FamilyMemberId } from '../shared/ids';
import type { PhotoId } from '../shared/ids';
import type { PartialDate } from '../family/PartialDate';
import type { BuiltinRelationshipType } from '../family/Relationship';

const KINDS: readonly BuiltinRelationshipType[] = ['married', 'father', 'brother', 'divorced', 'other'];

/**
 * A reproducible multi-device history: device A builds a base tree, B and C see it, then all
 * three edit concurrently without seeing each other (clocks deliberately skewed).
 */
export function generateScenario(seed: number): readonly Operation[] {
  const rand = createRng(seed);
  const int = (n: number): number => Math.floor(rand() * n);
  const pick = <T>(items: readonly T[]): T => items[int(items.length)] as T;

  const writers = [createWriter(deviceId('A')), createWriter(deviceId('B')), createWriter(deviceId('C'))];
  const [a] = writers as [ReturnType<typeof createWriter>, ...unknown[]];
  const base: Operation[] = [a.createTree('Family', 1000)];
  const baseMembers = ['m1', 'm2', 'm3', 'm4'].map(memberId);
  baseMembers.forEach((id, i) => base.push(a.createMember(id, memberFields(`Person ${i}`), 1001 + i)));
  const [m1, m2, m3] = baseMembers as [FamilyMemberId, FamilyMemberId, FamilyMemberId, FamilyMemberId];
  base.push(a.createRelationship(relationshipId('r1'), m1, m2, relationshipFields(builtin('married')), 1010));
  base.push(a.createRelationship(relationshipId('r2'), m1, m3, relationshipFields(builtin('father')), 1011));
  for (const op of base) writers.forEach((w) => w.observe(op, 1100));

  const known = writers.map(() => [...baseMembers]);
  const rels = [relationshipId('r1'), relationshipId('r2')];
  const skew = [0, 7, -3];
  const ops: Operation[] = [...base];
  let clock = 2000;

  for (let i = 0; i < 45; i += 1) {
    const w = int(3);
    const writer = writers[w]!;
    const mine = known[w]!;
    clock += int(40);
    const now = clock + skew[w]!;
    const target = pick(mine);
    const action = int(11);
    if (action === 0) ops.push(writer.updateMember(target, { name: `N${i}-${w}` }, now));
    else if (action === 1) ops.push(writer.updateMember(target, { notes: `note ${i}` }, now));
    else if (action === 2) ops.push(writer.updateMember(target, { birthDate: `19${10 + int(80)}` as PartialDate }, now));
    else if (action === 3) ops.push(writer.updateMember(target, { photoId: int(2) ? ('p1' as PhotoId) : null }, now));
    else if (action === 4) ops.push(writer.setRoot(rand() < 0.1 ? null : target, now));
    else if (action === 5 && rand() < 0.3) ops.push(writer.deleteMember(target, now));
    else if (action === 6) {
      const id = memberId(`n${i}`);
      ops.push(writer.createMember(id, memberFields(`New ${i}`), now));
      mine.push(id);
    } else if (action === 7) ops.push(writer.updateRelationship(pick(rels), { kind: builtin(pick(KINDS)) }, now));
    else if (action === 8 && rand() < 0.3) ops.push(writer.deleteRelationship(pick(rels), now));
    else if (action === 9) ops.push(writer.renameTree(`Tree ${i}`, now));
    else {
      const id = relationshipId(`x${i}`);
      ops.push(writer.createRelationship(id, target, pick(mine), relationshipFields(builtin(pick(KINDS))), now));
      rels.push(id);
    }
  }
  return ops;
}
