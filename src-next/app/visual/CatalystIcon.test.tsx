import { describe, it, expect } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { CatalystIcon } from './CatalystIcon';
import { CATALYST_ICON_SVGS, hasCatalystIconSvg } from '../../data/catalystIcons';

describe('CatalystIcon', () => {
  it('renders a registered SVG when one exists for the catalyst id', () => {
    // `stratifier` ships in the registered set (eye sigil).
    expect(hasCatalystIconSvg('stratifier')).toBe(true);
    const { container } = render(
      <CatalystIcon catalystId="stratifier" fallbackChar="👁" color="#cc88ff" size={32} />,
    );
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('width')).toBe('32');
    // Fallback char must NOT be in the DOM when an SVG renderer is registered.
    expect(container.textContent).not.toContain('👁');
    cleanup();
  });

  it('falls back to the catalyst\'s emoji char when no SVG is registered', () => {
    // Use a fake id that is guaranteed not to be in the registry.
    expect(hasCatalystIconSvg('not_a_real_catalyst_id')).toBe(false);
    const { container } = render(
      <CatalystIcon catalystId="not_a_real_catalyst_id" fallbackChar="∆" color="#88ddff" />,
    );
    expect(container.textContent).toContain('∆');
    expect(container.querySelector('svg')).toBeNull();
    cleanup();
  });

  it('passes the size prop through to the SVG', () => {
    const { container } = render(
      <CatalystIcon catalystId="last_throw" fallbackChar="🔔" color="#ff7847" size={48} />,
    );
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('48');
    expect(svg?.getAttribute('height')).toBe('48');
    cleanup();
  });

  it('uses the supplied color as the SVG stroke', () => {
    const { container } = render(
      <CatalystIcon catalystId="cold_hand" fallbackChar="💬" color="#abcdef" size={24} />,
    );
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('stroke')).toBe('#abcdef');
    cleanup();
  });

  it('has at least the 10 worst-offender emoji catalysts registered', () => {
    const required = [
      'stratifier', 'six_bias', 'twin_sample', 'cold_hand', 'last_throw',
      'patience_counter', 'stipend', 'lucky_streak', 'eclipse_pact', 'lyric_pulse',
    ];
    for (const id of required) {
      expect(CATALYST_ICON_SVGS[id], `missing renderer for ${id}`).toBeDefined();
    }
  });

  it('has the second-pass next-tier catalysts registered (2026-05-14)', () => {
    const required = [
      'chaos_theory', 'entropy_index', 'compounding_bias', 'solar_flare',
      'catalyst_bench', 'encore', 'phase_shift', 'conductor', 'quorum', 'magnitude',
    ];
    for (const id of required) {
      expect(CATALYST_ICON_SVGS[id], `missing renderer for ${id}`).toBeDefined();
    }
  });

  it('has the third-pass combo-tribal + economy + cosmic catalysts registered (2026-05-14)', () => {
    const required = [
      'pair_dynamo', 'triplet_engine', 'iron_six', 'captains_wage', 'prime_pact',
      'even_keeled', 'apex', 'silver_tongue', 'comet_trail', 'ouroboros',
    ];
    for (const id of required) {
      expect(CATALYST_ICON_SVGS[id], `missing renderer for ${id}`).toBeDefined();
    }
  });

  it('has every duplicate-Unicode-icon catalyst registered (2026-05-14 fourth pass)', () => {
    // These catalysts share their `icon` codepoint with at least one
    // other catalyst, so a sigil is the only way to tell them apart on
    // the strip / shop / codex.
    const required = [
      'shard_sink', 'recursive_sink', 'odd_voice', 'usurer', 'all_band',
      'straight_signal', 'low_choir', 'dust_off', 'crescendo_run', 'shard_lung',
      'mod_gravity', 'face_value', 'first_strike', 'streak_seeker', 'economy_engine',
      'penumbra', 'wildcard_waltz', 'lodestone', 'memento_star', 'tide',
      'highwater', 'refrain', 'mirror_edge', 'curtain_call', 'stutter',
      'silent_witness', 'kinetic_charge', 'kindred_clatter',
    ];
    for (const id of required) {
      expect(CATALYST_ICON_SVGS[id], `missing renderer for ${id}`).toBeDefined();
    }
  });

  it('has weak-Unicode catalysts upgraded to sigils (2026-05-14 fifth pass)', () => {
    const required = [
      'chance_doctrine', 'event_horizon', 'crowded_table', 'echo_chamber',
      'shadow_cache', 'unseen_chorus', 'audit', 'chain_reaction',
      'gilding_press', 'star_chart',
    ];
    for (const id of required) {
      expect(CATALYST_ICON_SVGS[id], `missing renderer for ${id}`).toBeDefined();
    }
  });

  it('total registered sigils is at least 65 after the fifth pass', () => {
    expect(Object.keys(CATALYST_ICON_SVGS).length).toBeGreaterThanOrEqual(65);
  });
});
