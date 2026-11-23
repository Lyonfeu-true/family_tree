import { describe, expect, it } from 'vitest';

import { normalizeLogin } from './login';

describe('normalizeLogin', () => {
  it('trims and lower-cases', () => {
    expect(normalizeLogin('  Alice@Example.COM ')).toBe('alice@example.com');
  });

  it('normalises compatibility characters so look-alikes compare equal', () => {
    expect(normalizeLogin('ＡＬＩＣＥ')).toBe('alice');
  });

  it('treats composed and decomposed accents as equal', () => {
    expect(normalizeLogin('re\u0301ne\u0301e')).toBe(normalizeLogin('r\u00e9n\u00e9e'));
  });
});
