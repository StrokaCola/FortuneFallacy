// Verifies the Pillar E resonance discovery loop end-to-end:
//   1. A 'resonance:<id>' onUpgradeTriggered event lands.
//   2. discoveryBridge appends the id to meta.discovered.resonances.
//   3. Repeat events are deduped (no double-append).
//
// We exercise the bridge synchronously via the bus and a fresh store
// snapshot — no React, no async timers.

import { describe, it, expect, beforeEach } from 'vitest';
import { bus } from '../events/bus';
import { startDiscoveryBridge } from './discoveryBridge';
import { store, setStateRaw } from './store';
import { initialMetaSlice } from './slices/meta';

describe('discoveryBridge — resonance capture (Pillar E)', () => {
  let stop: () => void = () => {};
  beforeEach(() => {
    stop();
    setStateRaw((s) => ({ ...s, meta: initialMetaSlice() }));
    stop = startDiscoveryBridge();
  });

  it('appends a resonance pair id on first fire', () => {
    bus.emit('onUpgradeTriggered', {
      id: 'resonance:symphony',
      phase: 0,
      deltaChips: 0,
      deltaMult: 5,
    });
    const discovered = store.getState().meta.discovered.resonances ?? [];
    expect(discovered).toContain('symphony');
  });

  it('dedupes — second fire of the same id does not double-append', () => {
    bus.emit('onUpgradeTriggered', { id: 'resonance:symphony', phase: 0, deltaChips: 0, deltaMult: 5 });
    bus.emit('onUpgradeTriggered', { id: 'resonance:symphony', phase: 0, deltaChips: 0, deltaMult: 5 });
    const discovered = store.getState().meta.discovered.resonances ?? [];
    expect(discovered.filter((id) => id === 'symphony').length).toBe(1);
  });

  it('captures multiple distinct pair ids', () => {
    bus.emit('onUpgradeTriggered', { id: 'resonance:symphony', phase: 0, deltaChips: 0, deltaMult: 5 });
    bus.emit('onUpgradeTriggered', { id: 'resonance:closer', phase: 0, deltaChips: 50, deltaMult: 0 });
    const discovered = store.getState().meta.discovered.resonances ?? [];
    expect(discovered).toContain('symphony');
    expect(discovered).toContain('closer');
  });

  it('ignores non-resonance upgrade ids', () => {
    bus.emit('onUpgradeTriggered', { id: 'six_bias', phase: 0, deltaChips: 0, deltaMult: 1 });
    bus.emit('onUpgradeTriggered', { id: 'easter_egg:answer', phase: 0, deltaChips: 0, deltaMult: 0 });
    const discovered = store.getState().meta.discovered.resonances ?? [];
    expect(discovered).toEqual([]);
  });
});
