import { describe, expect, it } from 'vitest';

import type { PartialDate } from './PartialDate';
import type { Relationship } from './Relationship';
import {
  findDuplicateRelationship,
  isDateOrderPlausible,
  parsePartialDate,
  validateMemberFields,
  validateRelationship,
} from './validation';
import type { FamilyTreeId, RelationshipId } from '../shared/ids';
import { builtin, memberFields, memberId, relationshipFields } from '../testing/builders';

const d = (s: string): PartialDate => s as PartialDate;

describe('parsePartialDate', () => {
  it('accepts year, year-month and full dates', () => {
    expect(parsePartialDate('1990')).toBe('1990');
    expect(parsePartialDate('1990-05')).toBe('1990-05');
    expect(parsePartialDate('1990-05-31')).toBe('1990-05-31');
  });

  it('rejects impossible dates and bad shapes', () => {
    for (const bad of ['', '90', '1990-13', '1990-00', '1990-04-31', '1990-5', '1990-05-1', '0000', 'abcd', ' 1990']) {
      expect(parsePartialDate(bad)).toBeNull();
    }
  });

  it('handles leap years', () => {
    expect(parsePartialDate('2024-02-29')).toBe('2024-02-29');
    expect(parsePartialDate('2023-02-29')).toBeNull();
    expect(parsePartialDate('1900-02-29')).toBeNull();
    expect(parsePartialDate('2000-02-29')).toBe('2000-02-29');
  });
});

describe('isDateOrderPlausible', () => {
  it('only fails when the order is provably wrong', () => {
    expect(isDateOrderPlausible(d('1990'), d('2000'))).toBe(true);
    expect(isDateOrderPlausible(d('2000'), d('1990-05-02'))).toBe(false);
    expect(isDateOrderPlausible(d('1990'), d('1990-05-02'))).toBe(true);
    expect(isDateOrderPlausible(d('1990-06'), d('1990-05-30'))).toBe(false);
  });
});

describe('validateMemberFields', () => {
  it('requires only a name', () => {
    expect(validateMemberFields(memberFields('Anna'))).toEqual([]);
    expect(validateMemberFields(memberFields('   '))).toEqual([{ field: 'name', code: 'required' }]);
  });

  it('limits name length but not notes', () => {
    expect(validateMemberFields(memberFields('x'.repeat(201)))).toEqual([{ field: 'name', code: 'too_long' }]);
    expect(validateMemberFields(memberFields('A', { notes: 'n'.repeat(1_000_000) }))).toEqual([]);
  });

  it('checks dates', () => {
    expect(validateMemberFields(memberFields('A', { birthDate: d('1990-13') }))).toEqual([
      { field: 'birthDate', code: 'invalid_format' },
    ]);
    expect(validateMemberFields(memberFields('A', { birthDate: d('2000'), deathDate: d('1990') }))).toEqual([
      { field: 'deathDate', code: 'out_of_order' },
    ]);
  });
});

describe('validateRelationship', () => {
  const a = memberId('a');
  const b = memberId('b');

  it('forbids relating a person to themselves', () => {
    expect(validateRelationship(a, a, relationshipFields(builtin('married')))).toEqual([
      { field: 'toId', code: 'self_reference' },
    ]);
  });

  it('validates custom labels and colours', () => {
    const custom = (label: string, colorHex: string | null) =>
      relationshipFields({ kind: 'custom', label, colorHex });
    expect(validateRelationship(a, b, custom('godfather', '#112233'))).toEqual([]);
    expect(validateRelationship(a, b, custom('  ', null))).toEqual([{ field: 'kind.label', code: 'required' }]);
    expect(validateRelationship(a, b, custom('x'.repeat(41), null))).toEqual([{ field: 'kind.label', code: 'too_long' }]);
    expect(validateRelationship(a, b, custom('ok', 'red'))).toEqual([{ field: 'kind.colorHex', code: 'invalid_color' }]);
  });

  it('checks the date order', () => {
    const f = relationshipFields(builtin('married'), { startDate: d('2010'), endDate: d('2005') });
    expect(validateRelationship(a, b, f)).toEqual([{ field: 'endDate', code: 'out_of_order' }]);
  });
});

describe('findDuplicateRelationship', () => {
  const a = memberId('a');
  const b = memberId('b');
  const existing = (fromId: typeof a, toId: typeof a, type: 'married' | 'father'): Relationship => ({
    id: 'r' as RelationshipId,
    treeId: 't' as FamilyTreeId,
    fromId,
    toId,
    kind: builtin(type),
    startDate: null,
    endDate: null,
  });

  it('treats symmetric types as the same in either direction', () => {
    expect(findDuplicateRelationship([existing(a, b, 'married')], { fromId: b, toId: a, kind: builtin('married') })).not.toBeUndefined();
  });

  it('treats directed types as different when reversed', () => {
    expect(findDuplicateRelationship([existing(a, b, 'father')], { fromId: b, toId: a, kind: builtin('father') })).toBeUndefined();
    expect(findDuplicateRelationship([existing(a, b, 'father')], { fromId: a, toId: b, kind: builtin('father') })).not.toBeUndefined();
  });

  it('allows different types between the same people', () => {
    expect(findDuplicateRelationship([existing(a, b, 'married')], { fromId: a, toId: b, kind: builtin('divorced') })).toBeUndefined();
  });
});
