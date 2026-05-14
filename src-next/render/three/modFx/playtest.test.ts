// Playtest-shaped smoke tests for the trigger-FX layer.
//
// What this guards:
//   1. Every triggerFx family declared on the ModVisual type union has
//      a dispatcher case in Dice3D AND a route in audioBridge.
//   2. Every fire* function can be invoked against a real THREE.Scene
//      without throwing, and disposes cleanly after one RAF tick.
//   3. No mod points at a triggerFx that doesn't exist on the union.
//
// This isn't a substitute for clicking through the game, but it gives
// us mechanical confidence that the FX pipeline is wired end-to-end
// before we ship a build for human playtest.

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// jsdom canvas-2d stub — getHaloTexture() in buildDie paints to a 2d
// canvas, which jsdom can't satisfy without the optional `canvas`
// package. Same stub pattern used in pulse.test.ts.
beforeAll(() => {
  const orig = HTMLCanvasElement.prototype.getContext;
  (HTMLCanvasElement.prototype as unknown as { __origGetContext: typeof orig }).__origGetContext = orig;
  HTMLCanvasElement.prototype.getContext = function (type: string) {
    if (type === '2d') {
      return {
        createRadialGradient: () => ({ addColorStop: () => {} }),
        fillRect: () => {},
        set fillStyle(_v: string) {},
      } as unknown as CanvasRenderingContext2D;
    }
    return null;
  } as typeof HTMLCanvasElement.prototype.getContext;
});

afterAll(() => {
  HTMLCanvasElement.prototype.getContext =
    (HTMLCanvasElement.prototype as unknown as { __origGetContext: typeof HTMLCanvasElement.prototype.getContext }).__origGetContext;
});

import { MODS } from '../../../core/mods';

import { firePulse } from './pulse';
import { fireLoaded } from './loaded';
import { firePipCharge } from './pipCharge';
import { fireBackstop } from './backstop';
import { fireCrown } from './crown';
import { fireShatter } from './shatter';
import { fireSwirl } from './swirl';
import { fireFlashback } from './flashback';
import { fireConduit } from './conduit';
import { fireCrescendo } from './crescendo';
import { fireResonance } from './resonance';
import { firePyreMark } from './pyreMark';
import { fireTallyMark } from './tallyMark';
import { fireTwinGlow } from './twinGlow';
import { fireShardClink } from './shardClink';
import { fireRhythmStack } from './rhythmStack';
import { fireAppetite } from './appetite';
import { fireAwaken } from './awaken';

// Canonical list of every triggerFx family the codebase ships.
const TRIGGER_FAMILIES = [
  'pulse', 'loaded', 'pipCharge', 'backstop',
  'crown', 'shatter', 'swirl', 'flashback',
  'conduit', 'crescendo', 'resonance', 'pyreMark', 'tallyMark',
  'twinGlow', 'shardClink', 'rhythmStack', 'appetite', 'awaken',
] as const;

// Read sibling source files as strings so we can grep for case labels.
const __dirname = dirname(fileURLToPath(import.meta.url));
const DICE3D_SRC = readFileSync(join(__dirname, '..', 'Dice3D.ts'), 'utf8');
const AUDIO_BRIDGE_SRC = readFileSync(
  join(__dirname, '..', '..', '..', 'audio', 'audioBridge.ts'), 'utf8',
);

describe('triggerFx coverage', () => {
  it('every family appears as a case in Dice3D.ts dispatcher', () => {
    for (const fam of TRIGGER_FAMILIES) {
      expect(DICE3D_SRC, `Dice3D dispatcher missing case '${fam}'`).toContain(`case '${fam}':`);
    }
  });

  it('every family appears as a case in audioBridge.ts', () => {
    for (const fam of TRIGGER_FAMILIES) {
      expect(AUDIO_BRIDGE_SRC, `audioBridge missing case '${fam}'`).toContain(`case '${fam}':`);
    }
  });

  it('every mod references a triggerFx that is in TRIGGER_FAMILIES', () => {
    const valid = new Set<string>(TRIGGER_FAMILIES);
    for (const m of MODS) {
      const t = m.visual!.triggerFx;
      expect(valid.has(t), `mod ${m.id} references unknown triggerFx '${t}'`).toBe(true);
    }
  });
});

// Smoke-test each fire* against a real Scene. We can't run RAF in
// jsdom, so we just confirm:
//   - the call returns a handle with dispose()
//   - dispose() is idempotent (call it twice; second call no-ops)
//   - the scene's child count goes back to 0 after dispose
describe('fire* smoke tests', () => {
  let scene: THREE.Scene;
  const POS = new THREE.Vector3(0, 0, 0);
  const SIZE = 1.0;
  const ACCENT = '#7be3ff';

  beforeEach(() => {
    scene = new THREE.Scene();
    // RAF stub — the fire* functions schedule a step() on RAF that we
    // never run, so it's fine to leave them unscheduled.
    vi.stubGlobal('requestAnimationFrame', () => 0);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    vi.stubGlobal('performance', { now: () => 0 });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  type Call = () => { dispose: () => void };
  const cases: Array<[string, Call]> = [
    ['pulse',       () => firePulse(scene, POS, ACCENT, SIZE)],
    ['loaded',      () => fireLoaded(scene, POS, SIZE)],
    ['pipCharge',   () => firePipCharge(scene, POS, 6, SIZE)],
    ['backstop',    () => fireBackstop(scene, POS, SIZE)],
    ['crown',       () => fireCrown(scene, POS, SIZE)],
    ['shatter',     () => fireShatter(scene, POS, SIZE)],
    ['swirl',       () => fireSwirl(scene, POS, ACCENT, SIZE)],
    ['flashback',   () => fireFlashback(scene, POS, ACCENT, SIZE)],
    ['conduit',     () => fireConduit(scene, POS, ACCENT, SIZE)],
    ['crescendo',   () => fireCrescendo(scene, POS, ACCENT, SIZE)],
    ['resonance',   () => fireResonance(scene, POS, ACCENT, SIZE)],
    ['pyreMark',    () => firePyreMark(scene, POS, SIZE)],
    ['tallyMark',   () => fireTallyMark(scene, POS, ACCENT, SIZE)],
    ['twinGlow',    () => fireTwinGlow(scene, POS, ACCENT, SIZE)],
    ['shardClink',  () => fireShardClink(scene, POS, SIZE)],
    ['rhythmStack', () => fireRhythmStack(scene, POS, ACCENT, SIZE)],
    ['appetite',    () => fireAppetite(scene, POS, ACCENT, SIZE)],
    ['awaken',      () => fireAwaken(scene, POS, ACCENT, SIZE)],
  ];

  for (const [name, call] of cases) {
    it(`${name}: returns a handle and disposes cleanly`, () => {
      const before = scene.children.length;
      const handle = call();
      expect(scene.children.length, `${name}: should add at least 1 child`).toBeGreaterThan(before);
      handle.dispose();
      // After dispose, scene should be back to its starting child count.
      expect(scene.children.length, `${name}: should return to 0 children after dispose`).toBe(before);
      // Second dispose should be a no-op (no throw, no negative count).
      expect(() => handle.dispose()).not.toThrow();
      expect(scene.children.length).toBe(before);
    });
  }

  it('all 18 fire* functions covered in this test', () => {
    expect(cases.length).toBe(TRIGGER_FAMILIES.length);
  });
});
