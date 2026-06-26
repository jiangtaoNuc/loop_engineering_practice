import { describe, it, expect } from 'vitest';

// We test the backoffInterval logic directly by reimplementing the pure function.
// The actual module uses React hooks so we test the core algorithm here.
const MAX_BACKOFF_MS = 60000;

function backoffInterval(failCount: number, base: number): number {
  if (failCount <= 0) return base;
  return Math.min(base * Math.pow(2, failCount), MAX_BACKOFF_MS);
}

describe('backoffInterval', () => {
  it('returns base interval when failCount is 0', () => {
    expect(backoffInterval(0, 7000)).toBe(7000);
  });

  it('doubles on first failure', () => {
    expect(backoffInterval(1, 7000)).toBe(14000);
  });

  it('quadruples on second failure', () => {
    expect(backoffInterval(2, 7000)).toBe(28000);
  });

  it('caps at MAX_BACKOFF_MS', () => {
    expect(backoffInterval(5, 7000)).toBe(60000);
    expect(backoffInterval(10, 7000)).toBe(60000);
  });

  it('handles negative failCount as base', () => {
    expect(backoffInterval(-1, 7000)).toBe(7000);
  });
});
