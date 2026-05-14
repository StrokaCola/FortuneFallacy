// Offer-card metadata — converts an opaque `{kind, id}` from the shop
// slice into the visual + descriptive bundle the OfferCard render
// needs (name, icon, color, description, kindLabel, optional flavor,
// optional rarity).
//
// Lifted out of `Shop.tsx` so the orchestrator can stay focused on
// layout and so the (kind, id) → Meta dispatch table is easy to find
// and extend when new shop-offer types ship.

import { lookupCatalyst } from '../../../data/catalysts';
import { lookupConsumable, consumableRarity } from '../../../core/consumables';
import { lookupVoucher } from '../../../data/vouchers';
import { lookupMod } from '../../../core/mods';
import { lookupPack } from '../../../core/consumables/galaxies';
import type { CatalystEdition } from '../../../state/slices/run';
import type { Rarity } from '../../visual/rarityStyles';

export type OfferMeta = {
  name: string;
  icon: string;
  color: string;
  desc: string;
  kindLabel: string;
  flavor?: string;
  rarity?: Rarity;
};

export function offerMeta(kind: string, id: string): OfferMeta {
  if (kind === 'catalyst') {
    const c = lookupCatalyst(id);
    return { name: c?.name ?? id, icon: c?.icon ?? '✦', color: c?.color ?? '#7be3ff', desc: c?.desc ?? '', kindLabel: 'catalyst', flavor: c?.flavor, rarity: c?.rarity };
  }
  if (kind === 'consumable') {
    const c = lookupConsumable(id);
    return {
      name: c?.name ?? id,
      icon: c?.icon ?? '◇',
      color: c?.type === 'calibration' ? '#cc88ff' : '#7be3ff',
      desc: c?.description ?? '',
      kindLabel: c?.type ?? 'calibration',
      rarity: c ? consumableRarity(c.type) : undefined,
    };
  }
  if (kind === 'voucher') {
    const v = lookupVoucher(id);
    return { name: v?.name ?? id, icon: '◆', color: '#f5c451', desc: v?.description ?? '', kindLabel: 'voucher', rarity: v?.rarity };
  }
  if (kind === 'mod') {
    const m = lookupMod(id);
    return {
      name: m?.name ?? id,
      icon: m?.icon ?? '⫶',
      color: m?.visual?.accentColor ?? '#bba8ff',
      desc: m?.desc ?? '',
      kindLabel: 'mod',
      rarity: m?.rarity,
    };
  }
  if (kind === 'pack') {
    const p = lookupPack(id);
    const isManeuver = id === 'maneuver';
    const tier = id === 'galactic' ? '✸' : id === 'stellar' ? '✹' : isManeuver ? '⤴' : '✦';
    // Pack rarity derived from tier: galactic = common, stellar = uncommon,
    // maneuver = rare, anything else (future stellar+) = legendary.
    const packRarity: Rarity =
      id === 'galactic' ? 'common'
      : id === 'stellar' ? 'uncommon'
      : isManeuver ? 'rare'
      : 'legendary';
    return {
      name: p?.name ?? id,
      icon: tier,
      color: isManeuver ? '#7be3ff' : '#cc88ff',
      desc: p ? `Show ${p.showCount}, pick ${p.pickCount}.` : 'Booster pack.',
      kindLabel: 'booster',
      rarity: packRarity,
      flavor: isManeuver
        ? 'Tactical maneuvers — shape the next hand.'
        : 'Levels up the hand types you choose.',
    };
  }
  return { name: id, icon: '◇', color: '#7be3ff', desc: '', kindLabel: kind };
}

// Plain-language summary of an edition's mechanical effect, scoped by
// the kind of upgrade it sits on. Catalyst foil/holo are flat-per-fire
// at bigger magnitudes; mod editions fire many times per hand at
// smaller magnitudes — the tooltip surfaces the right numbers.
export function editionBonusDescription(kind: 'catalyst' | 'mod', edition: CatalystEdition): string {
  if (kind === 'catalyst') {
    if (edition === 'foil') return '+50 chips on each fire';
    if (edition === 'holo') return '+10 mult on each fire';
    if (edition === 'void') return 'Costs zero catalyst slots';
    return '+50% of own contribution';
  }
  if (edition === 'foil') return '+20 chips per fire';
  if (edition === 'holo') return '+4 mult per fire';
  return '+25% of own contribution per fire';
}
