import { describe, expect, it } from 'vitest';

import type { DeviceId, FamilyTreeId, UserId } from '../shared/ids';
import { aad } from './aad';

const tree = 'tree-1' as FamilyTreeId;
const user = 'user-1' as UserId;
const device = 'dev-1' as DeviceId;

describe('aad', () => {
  it('binds ciphertexts to their purpose', () => {
    expect(aad.accountKey(user)).not.toBe(aad.recoveryKey(user));
    expect(aad.privateKey(user)).not.toBe(aad.profile(user));
  });

  it('binds ciphertexts to tree, key version and file position', () => {
    expect(aad.grant(tree, 1, user)).not.toBe(aad.grant(tree, 2, user));
    expect(aad.opsBatch(tree, 1, device, 1, 10)).not.toBe(aad.opsBatch(tree, 1, device, 1, 11));
    expect(aad.opsBatch(tree, 1, device, 1, 10)).toBe('ft1|ops|tree-1|1|dev-1|1-10');
  });
});
