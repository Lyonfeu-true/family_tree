import { describe, expect, it } from 'vitest';

import {
  MAX_COUNTER,
  compareHlc,
  formatHlc,
  isExcessiveClockSkew,
  parseHlc,
  receiveHlc,
  stampHlc,
  tickHlc,
} from './hlc';
import type { DeviceId } from './ids';

const dev = 'dev-a' as DeviceId;

describe('hlc format', () => {
  it('round-trips through parse', () => {
    const ts = formatHlc({ wallMs: 1_767_225_600_000, counter: 10, deviceId: dev });
    expect(ts).toBe('001767225600000:000a:dev-a');
    expect(parseHlc(ts)).toEqual({ wallMs: 1_767_225_600_000, counter: 10, deviceId: dev });
  });

  it('orders chronologically as plain strings', () => {
    const early = formatHlc({ wallMs: 999, counter: 0, deviceId: dev });
    const late = formatHlc({ wallMs: 1000, counter: 0, deviceId: dev });
    const laterCounter = formatHlc({ wallMs: 1000, counter: 0x0a, deviceId: dev });
    const highCounter = formatHlc({ wallMs: 1000, counter: 0xffff, deviceId: dev });
    expect(compareHlc(early, late)).toBe(-1);
    expect(compareHlc(late, laterCounter)).toBe(-1);
    expect(compareHlc(laterCounter, highCounter)).toBe(-1);
    expect(compareHlc(late, late)).toBe(0);
  });

  it('breaks exact ties by device id so the order is total', () => {
    const a = formatHlc({ wallMs: 5, counter: 0, deviceId: 'a' as DeviceId });
    const b = formatHlc({ wallMs: 5, counter: 0, deviceId: 'b' as DeviceId });
    expect(compareHlc(a, b)).toBe(-1);
  });

  it('rejects malformed timestamps without throwing', () => {
    expect(parseHlc('nope')).toBeNull();
    expect(parseHlc('1:0000:dev')).toBeNull();
    expect(parseHlc('001767225600000:zzzz:dev')).toBeNull();
  });

  it('refuses out-of-range parts when formatting', () => {
    expect(() => formatHlc({ wallMs: -1, counter: 0, deviceId: dev })).toThrow();
    expect(() => formatHlc({ wallMs: 1, counter: MAX_COUNTER + 1, deviceId: dev })).toThrow();
  });
});

describe('hlc clock', () => {
  it('uses the wall clock when it moves forward', () => {
    expect(tickHlc({ wallMs: 100, counter: 7 }, 200)).toEqual({ wallMs: 200, counter: 0 });
  });

  it('increments the counter within the same millisecond', () => {
    expect(tickHlc({ wallMs: 100, counter: 0 }, 100)).toEqual({ wallMs: 100, counter: 1 });
  });

  it('never moves backwards if the system clock does', () => {
    expect(tickHlc({ wallMs: 100, counter: 3 }, 50)).toEqual({ wallMs: 100, counter: 4 });
  });

  it('rolls into the next millisecond when the counter overflows', () => {
    expect(tickHlc({ wallMs: 100, counter: MAX_COUNTER }, 100)).toEqual({ wallMs: 101, counter: 0 });
  });

  it('receive places the next local event after the remote one', () => {
    const remote = { wallMs: 500, counter: 4, deviceId: 'b' as DeviceId };
    const state = receiveHlc({ wallMs: 100, counter: 0 }, remote, 110);
    expect(state).toEqual({ wallMs: 500, counter: 5 });
    const next = stampHlc(tickHlc(state, 111), dev);
    expect(compareHlc(next, formatHlc(remote))).toBe(1);
  });

  it('receive merges counters when both clocks agree on the millisecond', () => {
    const remote = { wallMs: 100, counter: 9, deviceId: 'b' as DeviceId };
    expect(receiveHlc({ wallMs: 100, counter: 3 }, remote, 100)).toEqual({ wallMs: 100, counter: 10 });
  });

  it('flags timestamps far in the future', () => {
    const now = 1_000_000;
    expect(isExcessiveClockSkew({ wallMs: now + 60_000, counter: 0, deviceId: dev }, now)).toBe(false);
    expect(isExcessiveClockSkew({ wallMs: now + 2 * 86_400_000, counter: 0, deviceId: dev }, now)).toBe(true);
  });
});
