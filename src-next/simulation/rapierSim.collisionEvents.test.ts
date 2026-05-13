// Regression: rapier ColliderDesc defaults to ActiveEvents.NONE. Without
// setActiveEvents(COLLISION_EVENTS) on every die collider,
// drainCollisionEvents fires zero times in real physics — silently
// killing kinetic_charge, chain_reaction, and kindred_clatter. The
// headless seeded fallback in runSimulation.ts synthesizes its own
// collisionCount, which masked this regression in the unit tests for
// the individual collision-pack catalysts.
//
// We mock rapier's ColliderDesc just enough to observe which flags get
// set, then assert COLLISION_EVENTS is always among them — for cuboid
// (d6) and convex-hull (all other shapes) and for the convex-hull
// fallback path when the hull is degenerate.

import { describe, it, expect } from 'vitest';
import { colliderForShape } from './rapierSim';

type FakeDesc = {
  setRestitution: (v: number) => FakeDesc;
  setDensity: (v: number) => FakeDesc;
  setActiveEvents: (e: number) => FakeDesc;
  events: number;
};

function makeDesc(): FakeDesc {
  const desc: FakeDesc = {
    setRestitution() { return desc; },
    setDensity() { return desc; },
    setActiveEvents(e: number) { desc.events |= e; return desc; },
    events: 0,
  };
  return desc;
}

function fakeRapier(hullOk: boolean): Parameters<typeof colliderForShape>[0] {
  return {
    ActiveEvents: { COLLISION_EVENTS: 0b0001, NONE: 0 },
    ColliderDesc: {
      cuboid: () => makeDesc(),
      convexHull: () => (hullOk ? makeDesc() : null),
    },
  } as unknown as Parameters<typeof colliderForShape>[0];
}

describe('colliderForShape — COLLISION_EVENTS flag', () => {
  it('cuboid (d6) sets COLLISION_EVENTS', () => {
    const r = fakeRapier(true);
    const desc = colliderForShape(r, 'd6', 0.4) as unknown as FakeDesc;
    expect(desc.events & 0b0001).toBe(0b0001);
  });

  it('convex hull path (e.g. d20) sets COLLISION_EVENTS', () => {
    const r = fakeRapier(true);
    const desc = colliderForShape(r, 'd20', 0.4) as unknown as FakeDesc;
    expect(desc.events & 0b0001).toBe(0b0001);
  });

  it('cuboid fallback (when convex hull is degenerate) still sets COLLISION_EVENTS', () => {
    const r = fakeRapier(false);
    const desc = colliderForShape(r, 'd20', 0.4) as unknown as FakeDesc;
    expect(desc.events & 0b0001).toBe(0b0001);
  });
});
