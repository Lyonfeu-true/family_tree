import { describe, expect, it } from 'vitest';

import type { HlcTimestamp } from './hlc';
import { lww, lwwRecordOf, mergeLww, mergePatch, unwrapLww } from './lww';

const t = (n: number): HlcTimestamp => `${String(n).padStart(15, '0')}:0000:d` as HlcTimestamp;

describe('mergeLww', () => {
  it('keeps the later write regardless of argument order', () => {
    const old = lww('old', t(1));
    const recent = lww('new', t(2));
    expect(mergeLww(old, recent)).toEqual(recent);
    expect(mergeLww(recent, old)).toEqual(recent);
  });

  it('is idempotent', () => {
    const a = lww('x', t(3));
    expect(mergeLww(a, a)).toEqual(a);
  });
});

describe('records', () => {
  it('wraps and unwraps values', () => {
    const record = lwwRecordOf({ a: 1, b: 'two' }, t(1));
    expect(unwrapLww(record)).toEqual({ a: 1, b: 'two' });
  });

  it('patches only the keys provided and ignores older writes', () => {
    const record = lwwRecordOf({ a: 1, b: 'two' }, t(5));
    const patched = mergePatch(record, { a: 9 }, t(6));
    expect(unwrapLww(patched)).toEqual({ a: 9, b: 'two' });
    const stale = mergePatch(patched, { a: 0 }, t(2));
    expect(unwrapLww(stale)).toEqual({ a: 9, b: 'two' });
  });
});
