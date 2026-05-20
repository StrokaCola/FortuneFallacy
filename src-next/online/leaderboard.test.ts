import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sanitizeLeaderboardName, startLeaderboard } from './leaderboard';
import { bus } from '../events/bus';
import { store, resetStore } from '../state/store';

describe('sanitizeLeaderboardName', () => {
  it('passes a clean name through unchanged', () => {
    expect(sanitizeLeaderboardName('Aria')).toBe('Aria');
  });

  it('strips HTML angle brackets and ampersands', () => {
    expect(sanitizeLeaderboardName('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
  });

  it('caps the length at 24 characters', () => {
    const long = 'A'.repeat(50);
    const out = sanitizeLeaderboardName(long);
    expect(out.length).toBeLessThanOrEqual(24);
  });

  it('trims surrounding whitespace and collapses runs', () => {
    expect(sanitizeLeaderboardName('   Aria    Stark   ')).toBe('Aria Stark');
  });

  it('falls back to "Wanderer" when the cleaned name is empty', () => {
    expect(sanitizeLeaderboardName('')).toBe('Wanderer');
    expect(sanitizeLeaderboardName('   ')).toBe('Wanderer');
    expect(sanitizeLeaderboardName('<>&"\'')).toBe('Wanderer');
  });

  it('strips zero-width and bidi/RTL marks', () => {
    // Right-to-Left Override (U+202E) + Pop Directional Formatting (U+202C)
    // around the name. Built from String.fromCharCode so the source file
    // stays pure ASCII.
    const RLO = String.fromCharCode(0x202E);
    const PDF = String.fromCharCode(0x202C);
    const griefed = `${RLO}Aria${PDF}`;
    expect(sanitizeLeaderboardName(griefed)).toBe('Aria');
  });

  it('strips C0/C1 control characters', () => {
    const NUL = String.fromCharCode(0x00);
    const BEL = String.fromCharCode(0x07);
    expect(sanitizeLeaderboardName(`Aria${NUL}${BEL}`)).toBe('Aria');
  });
});

// Run-end submission handler. Verifies the void-mode partitioning rules:
// wild void runs are leaderboard-ineligible (no fetch), certified void
// runs submit under 'void-YYYY-MM-DD'. We stub global.fetch so the test
// stays offline; the assertion is on the mode-string actually POSTed.
describe('startLeaderboard onRunEnded handler — void partition', () => {
  let detachLeaderboard: (() => void) | null = null;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetStore();
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    detachLeaderboard = startLeaderboard();
  });

  afterEach(() => {
    detachLeaderboard?.();
    detachLeaderboard = null;
    fetchSpy.mockRestore();
  });

  it('skips submission entirely for a wild (uncertified) void run', () => {
    store.setState(
      (s) => ({ ...s, run: { ...s.run, mode: 'void', dailyCertified: false } }),
      true,
    );
    bus.emit('onRunEnded', { score: 12345, won: false, ante: 2, constellation: 'lyra' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('submits a certified void run under the void-YYYY-MM-DD partition', () => {
    store.setState(
      (s) => ({ ...s, run: { ...s.run, mode: 'void', dailyCertified: true } }),
      true,
    );
    bus.emit('onRunEnded', { score: 999, won: true, ante: 4, constellation: 'lyra' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String((fetchSpy.mock.calls[0]![1] as RequestInit).body)) as { mode: string };
    expect(body.mode).toMatch(/^void-\d{4}-\d{2}-\d{2}$/);
  });

  it('leaves the normal-run submission path unchanged', () => {
    // mode stays 'normal' from initialRunSlice; this should hit the
    // existing run/lap/daily branch with no void interference.
    bus.emit('onRunEnded', { score: 500, won: false, ante: 1, constellation: 'lyra' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String((fetchSpy.mock.calls[0]![1] as RequestInit).body)) as { mode: string };
    expect(body.mode).toBe('run');
  });
});
