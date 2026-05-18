// Discovery bridge — updates meta.discovered as the player encounters
// catalysts/mods/vouchers/consumables/bosses through normal play. Pure
// listener glue; doesn't affect gameplay state.
//
// Hooks:
//  onShopOpened: mark every offer's id under its kind.
//  onOfferBought: mark again (defensive — same as above).
//  onBossRevealed: mark boss id.
//  USE_CONSUMABLE / GRANT_CONSUMABLE: handled via store subscription
//    on s.run.consumables (delta from prior frame).
//
// Discoveries unionize; we never remove. Persistence handles serialization.

import { bus } from '../events/bus';
import { store, setStateRaw, type GameState } from './store';

type DiscoveryKey = 'catalysts' | 'mods' | 'vouchers' | 'bosses' | 'consumables';

function unionInto(s: GameState, key: DiscoveryKey, ids: string[]): GameState {
  if (ids.length === 0) return s;
  const cur = s.meta.discovered[key];
  let changed = false;
  const next = [...cur];
  for (const id of ids) {
    if (!next.includes(id)) {
      next.push(id);
      changed = true;
    }
  }
  if (!changed) return s;
  return {
    ...s,
    meta: {
      ...s.meta,
      discovered: { ...s.meta.discovered, [key]: next },
    },
  };
}

export function startDiscoveryBridge(): () => void {
  const subs = [
    bus.on('onShopOpened', ({ offers }) => {
      setStateRaw((s) => {
        // 2026-05-18 Aliveness pass — catalysts are NOT marked
        // discovered on shop open anymore. OfferCard handles the
        // first-encounter moment and dispatches `onCatalystDiscovered`
        // once the reveal has played, which feeds the union below.
        // Other kinds keep the old eager-mark semantics — they have
        // no reveal layer.
        const buckets: Record<DiscoveryKey, string[]> = {
          catalysts: [], mods: [], vouchers: [], bosses: [], consumables: [],
        };
        for (const o of offers) {
          if (o.kind === 'mod') buckets.mods.push(o.id);
          else if (o.kind === 'voucher') buckets.vouchers.push(o.id);
          else if (o.kind === 'consumable') buckets.consumables.push(o.id);
        }
        let next = s;
        for (const k of Object.keys(buckets) as DiscoveryKey[]) {
          next = unionInto(next, k, buckets[k]);
        }
        return next;
      });
    }),
    // 2026-05-18 — first-encounter discovery moment for catalysts.
    // OfferCard fires this on mount when the catalyst id is not in
    // meta.discovered.catalysts. Union here so the dispatch lands
    // before the next shop open.
    bus.on('onCatalystDiscovered', ({ catalystId }) => {
      setStateRaw((s) => unionInto(s, 'catalysts', [catalystId]));
    }),
    // 2026-05-18 — rare-edition first-encounter. Editions live in
    // a separate set under meta.discovered.editions. Optional field
    // on older saves; default to [].
    bus.on('onEditionDiscovered', ({ edition }) => {
      setStateRaw((s) => {
        const cur = s.meta.discovered.editions ?? [];
        if (cur.includes(edition)) return s;
        return {
          ...s,
          meta: {
            ...s.meta,
            discovered: { ...s.meta.discovered, editions: [...cur, edition] },
          },
        };
      });
    }),
    bus.on('onBossRevealed', ({ blindId }) => {
      setStateRaw((s) => unionInto(s, 'bosses', [blindId]));
    }),
    bus.on('onOfferBought', ({ kind, id }) => {
      setStateRaw((s) => {
        if (kind === 'catalyst') return unionInto(s, 'catalysts', [id]);
        if (kind === 'mod') return unionInto(s, 'mods', [id]);
        if (kind === 'voucher') return unionInto(s, 'vouchers', [id]);
        if (kind === 'consumable') return unionInto(s, 'consumables', [id]);
        return s;
      });
    }),
    // 2026-05-11 easter egg discovery — listen for the synthetic
    // 'easter_egg:<id>' upgrade events emitted by roll.ts / transitions
    // and append the id to meta.easterEggs. Also catches 'mirrored_hand'
    // (the inline retrigger emit) by mapping the unprefixed id.
    bus.on('onUpgradeTriggered', (payload: { id: string }) => {
      let eggId: string | null = null;
      const prefix = 'easter_egg:';
      if (payload.id.startsWith(prefix)) eggId = payload.id.slice(prefix.length);
      else if (payload.id === 'mirrored_hand') eggId = 'mirrored_hand';
      if (!eggId) return;
      setStateRaw((s) => {
        const cur = s.meta.easterEggs ?? [];
        if (cur.includes(eggId!)) return s;
        return {
          ...s,
          meta: { ...s.meta, easterEggs: [...cur, eggId!] },
        };
      });
    }),
    // 2026-05-13 (Pillar E) — capture resonance fires for the Codex.
    // applyResonances emits 'resonance:<pairId>' onUpgradeTriggered events
    // once per scoring hand when a pair is active. First fire ever appends
    // to meta.discovered.resonances; subsequent fires are a no-op. The
    // ResonanceToast subscribes to the same event for the live reveal.
    bus.on('onUpgradeTriggered', (payload: { id: string }) => {
      const RESONANCE_PREFIX = 'resonance:';
      if (!payload.id.startsWith(RESONANCE_PREFIX)) return;
      const pairId = payload.id.slice(RESONANCE_PREFIX.length);
      setStateRaw((s) => {
        const cur = s.meta.discovered.resonances ?? [];
        if (cur.includes(pairId)) return s;
        return {
          ...s,
          meta: {
            ...s.meta,
            discovered: { ...s.meta.discovered, resonances: [...cur, pairId] },
          },
        };
      });
    }),
  ];

  // Track consumables added via GRANT_CONSUMABLE (skip rewards, packs).
  let lastConsumables: string[] = store.getState().run.consumables;
  const offStore = store.subscribe((s) => {
    const cur = s.run.consumables;
    if (cur === lastConsumables) return;
    const added = cur.filter((id) => !lastConsumables.includes(id));
    lastConsumables = cur;
    if (added.length > 0) {
      setStateRaw((s2) => unionInto(s2, 'consumables', added));
    }
  });

  return () => {
    subs.forEach((u) => u());
    offStore();
  };
}
