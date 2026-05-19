import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { KindFrame, type UpgradeKind } from './upgradeKindFrames';
import { RARITY_COLORS, type Rarity } from './rarityStyles';

const KINDS: UpgradeKind[] = ['catalyst', 'mod', 'voucher', 'consumable', 'pack'];
const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'legendary', 'mythic'];

describe('KindFrame', () => {
  it('renders one path for every (kind × rarity) without throwing', () => {
    for (const kind of KINDS) {
      for (const rarity of RARITIES) {
        const { container } = render(
          <KindFrame kind={kind} rarity={rarity} size={64}>X</KindFrame>,
        );
        const path = container.querySelector('svg path');
        expect(path).not.toBeNull();
      }
    }
  });

  it('exposes data-kind and data-rarity attributes for downstream visual diffs', () => {
    const { container } = render(
      <KindFrame kind="voucher" rarity="rare" size={32}>◆</KindFrame>,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.getAttribute('data-kind')).toBe('voucher');
    expect(wrapper.getAttribute('data-rarity')).toBe('rare');
  });

  it('uses the rarity stroke color when no accentColor is passed', () => {
    const { container } = render(
      <KindFrame kind="catalyst" rarity="legendary" size={42}>L</KindFrame>,
    );
    const path = container.querySelector('svg path');
    expect(path?.getAttribute('stroke')).toBe(RARITY_COLORS.legendary);
  });

  it('lets accentColor override the rarity stroke', () => {
    const { container } = render(
      <KindFrame kind="catalyst" rarity="common" accentColor="#abcdef" size={42}>X</KindFrame>,
    );
    const path = container.querySelector('svg path');
    expect(path?.getAttribute('stroke')).toBe('#abcdef');
  });

  it('adds the legendary-aura class only on legendary', () => {
    const { container: leg } = render(
      <KindFrame kind="catalyst" rarity="legendary" size={42}>X</KindFrame>,
    );
    expect((leg.firstElementChild as HTMLElement).className).toContain('legendary-aura');

    const { container: rare } = render(
      <KindFrame kind="catalyst" rarity="rare" size={42}>X</KindFrame>,
    );
    expect((rare.firstElementChild as HTMLElement).className).not.toContain('legendary-aura');
  });

  it('renders without rarity (null) — no errors, no rarity attribute mismatch', () => {
    const { container } = render(
      <KindFrame kind="pack" rarity={null} accentColor="#00ff00" size={42}>P</KindFrame>,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.getAttribute('data-rarity')).toBe('none');
    const path = container.querySelector('svg path');
    expect(path?.getAttribute('stroke')).toBe('#00ff00');
  });
});

describe('rarity coverage on data', () => {
  it('every voucher has a valid rarity', async () => {
    const { VOUCHERS } = await import('../../data/vouchers');
    for (const v of VOUCHERS) {
      expect(RARITIES).toContain(v.rarity);
    }
  });

  it('consumableRarity returns a valid rarity for every consumable type', async () => {
    const { CONSUMABLES, consumableRarity } = await import('../../core/consumables');
    for (const c of CONSUMABLES) {
      expect(RARITIES).toContain(consumableRarity(c.type));
    }
  });
});
