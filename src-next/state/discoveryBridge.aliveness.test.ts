// Aliveness pass (2026-05-18) — first-encounter discovery for
// catalysts and rare editions. OfferCard dispatches the events;
// discoveryBridge unions them into meta.discovered. Tests below
// exercise the bridge directly via the bus — no React.

import { describe, it, expect, beforeEach } from 'vitest';
import { bus } from '../events/bus';
import { startDiscoveryBridge } from './discoveryBridge';
import { store, setStateRaw } from './store';
import { initialMetaSlice } from './slices/meta';

describe('discoveryBridge — catalyst first-encounter (Aliveness)', () => {
  let stop: () => void = () => {};
  beforeEach(() => {
    stop();
    setStateRaw((s) => ({ ...s, meta: initialMetaSlice() }));
    stop = startDiscoveryBridge();
  });

  it('marks a catalyst discovered when onCatalystDiscovered fires', () => {
    bus.emit('onCatalystDiscovered', { catalystId: 'lodestone', total: 71 });
    const discovered = store.getState().meta.discovered.catalysts;
    expect(discovered).toContain('lodestone');
  });

  it('dedupes repeat dispatches', () => {
    bus.emit('onCatalystDiscovered', { catalystId: 'lodestone', total: 71 });
    bus.emit('onCatalystDiscovered', { catalystId: 'lodestone', total: 71 });
    const discovered = store.getState().meta.discovered.catalysts;
    expect(discovered.filter((id) => id === 'lodestone').length).toBe(1);
  });

  it('captures multiple distinct catalyst ids', () => {
    bus.emit('onCatalystDiscovered', { catalystId: 'lodestone', total: 71 });
    bus.emit('onCatalystDiscovered', { catalystId: 'comet_trail', total: 71 });
    const discovered = store.getState().meta.discovered.catalysts;
    expect(discovered).toContain('lodestone');
    expect(discovered).toContain('comet_trail');
  });

  it('does NOT eagerly mark catalysts on shop open (left to OfferCard)', () => {
    bus.emit('onShopOpened', {
      offers: [{ kind: 'catalyst', id: 'lodestone', price: 3 }],
    });
    const discovered = store.getState().meta.discovered.catalysts;
    expect(discovered).not.toContain('lodestone');
  });

  it('STILL eagerly marks mods on shop open (no reveal layer)', () => {
    bus.emit('onShopOpened', {
      offers: [{ kind: 'mod', id: 'glittering', price: 3 }],
    });
    const discovered = store.getState().meta.discovered.mods;
    expect(discovered).toContain('glittering');
  });
});

describe('discoveryBridge — edition first-encounter (Aliveness)', () => {
  let stop: () => void = () => {};
  beforeEach(() => {
    stop();
    setStateRaw((s) => ({ ...s, meta: initialMetaSlice() }));
    stop = startDiscoveryBridge();
  });

  it('marks an edition discovered on first encounter', () => {
    bus.emit('onEditionDiscovered', { edition: 'poly', catalystId: 'lodestone' });
    const discovered = store.getState().meta.discovered.editions ?? [];
    expect(discovered).toContain('poly');
  });

  it('dedupes repeat dispatches', () => {
    bus.emit('onEditionDiscovered', { edition: 'foil', catalystId: 'lodestone' });
    bus.emit('onEditionDiscovered', { edition: 'foil', catalystId: 'comet_trail' });
    const discovered = store.getState().meta.discovered.editions ?? [];
    expect(discovered.filter((e) => e === 'foil').length).toBe(1);
  });

  it('tracks editions independently of catalysts', () => {
    bus.emit('onEditionDiscovered', { edition: 'holo', catalystId: 'lodestone' });
    bus.emit('onCatalystDiscovered', { catalystId: 'lodestone', total: 71 });
    const m = store.getState().meta;
    expect(m.discovered.editions ?? []).toContain('holo');
    expect(m.discovered.catalysts).toContain('lodestone');
  });
});
