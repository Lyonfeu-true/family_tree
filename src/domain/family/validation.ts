import type { FamilyMemberId } from '../shared/ids';
import type { FamilyMemberFields } from './FamilyMember';
import type { PartialDate } from './PartialDate';
import {
  RELATIONSHIP_TYPE_DEFINITIONS,
  type Relationship,
  type RelationshipFields,
  type RelationshipKind,
} from './Relationship';

export const MAX_NAME_LENGTH = 200;
export const MAX_CUSTOM_LABEL_LENGTH = 40;

export type ValidationCode =
  | 'required'
  | 'too_long'
  | 'invalid_format'
  | 'out_of_order'
  | 'self_reference'
  | 'invalid_color';

export interface ValidationIssue {
  readonly field: string;
  readonly code: ValidationCode;
}

const DATE_PATTERN = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

const isLeapYear = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

const daysInMonth = (year: number, month: number): number =>
  month === 2 ? (isLeapYear(year) ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;

/** Accepts `YYYY`, `YYYY-MM` or `YYYY-MM-DD` that are real calendar dates. Returns null otherwise. */
export function parsePartialDate(input: string): PartialDate | null {
  const match = DATE_PATTERN.exec(input);
  if (!match) return null;
  const year = Number(match[1]);
  if (year < 1) return null;
  if (match[2] !== undefined) {
    const month = Number(match[2]);
    if (month < 1 || month > 12) return null;
    if (match[3] !== undefined) {
      const day = Number(match[3]);
      if (day < 1 || day > daysInMonth(year, month)) return null;
    }
  }
  return input as PartialDate;
}

/**
 * True unless `earlier` is provably after `later`. Dates of different precision are
 * compared on their shared prefix ("1990" vs "1990-05-02" cannot be ordered, so it passes).
 */
export function isDateOrderPlausible(earlier: PartialDate, later: PartialDate): boolean {
  const length = Math.min(earlier.length, later.length);
  return earlier.slice(0, length) <= later.slice(0, length);
}

function checkDate(field: string, value: PartialDate | null, issues: ValidationIssue[]): void {
  if (value !== null && parsePartialDate(value) === null) {
    issues.push({ field, code: 'invalid_format' });
  }
}

export function validateMemberFields(fields: FamilyMemberFields): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const name = fields.name.trim();
  if (name === '') issues.push({ field: 'name', code: 'required' });
  else if (name.length > MAX_NAME_LENGTH) issues.push({ field: 'name', code: 'too_long' });

  checkDate('birthDate', fields.birthDate, issues);
  checkDate('deathDate', fields.deathDate, issues);
  if (
    issues.length === 0 &&
    fields.birthDate !== null &&
    fields.deathDate !== null &&
    !isDateOrderPlausible(fields.birthDate, fields.deathDate)
  ) {
    issues.push({ field: 'deathDate', code: 'out_of_order' });
  }
  return issues;
}

export function validateRelationship(
  fromId: FamilyMemberId,
  toId: FamilyMemberId,
  fields: RelationshipFields,
): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (fromId === toId) issues.push({ field: 'toId', code: 'self_reference' });

  if (fields.kind.kind === 'custom') {
    const label = fields.kind.label.trim();
    if (label === '') issues.push({ field: 'kind.label', code: 'required' });
    else if (label.length > MAX_CUSTOM_LABEL_LENGTH) issues.push({ field: 'kind.label', code: 'too_long' });
    const color = fields.kind.colorHex;
    if (color !== null && !/^#[0-9a-fA-F]{6}$/.test(color)) {
      issues.push({ field: 'kind.colorHex', code: 'invalid_color' });
    }
  }

  checkDate('startDate', fields.startDate, issues);
  checkDate('endDate', fields.endDate, issues);
  if (
    fields.startDate !== null &&
    fields.endDate !== null &&
    !issues.some((i) => i.code === 'invalid_format') &&
    !isDateOrderPlausible(fields.startDate, fields.endDate)
  ) {
    issues.push({ field: 'endDate', code: 'out_of_order' });
  }
  return issues;
}

const sameKind = (a: RelationshipKind, b: RelationshipKind): boolean =>
  a.kind === 'builtin'
    ? b.kind === 'builtin' && a.type === b.type
    : b.kind === 'custom' && a.label.trim().toLowerCase() === b.label.trim().toLowerCase();

const isSymmetric = (kind: RelationshipKind): boolean =>
  kind.kind === 'builtin' && RELATIONSHIP_TYPE_DEFINITIONS[kind.type].symmetric;

/**
 * Finds an existing relationship that says the same thing. Symmetric types (married,
 * brother...) match in either direction; directed types (father, son, custom) do not.
 */
export function findDuplicateRelationship(
  existing: readonly Relationship[],
  candidate: { readonly fromId: FamilyMemberId; readonly toId: FamilyMemberId; readonly kind: RelationshipKind },
): Relationship | undefined {
  return existing.find((rel) => {
    if (!sameKind(rel.kind, candidate.kind)) return false;
    const sameDirection = rel.fromId === candidate.fromId && rel.toId === candidate.toId;
    const reversed = rel.fromId === candidate.toId && rel.toId === candidate.fromId;
    return sameDirection || (reversed && isSymmetric(candidate.kind));
  });
}
