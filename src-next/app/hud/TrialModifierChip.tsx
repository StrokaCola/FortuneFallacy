// Trial Modifier Chip (Pillar A) — small badge rendered on Hub trial
// cards to surface the voidstorm that will fire when the player commits
// to that trial. Mirrors the in-round VoidstormBadge's color logic but
// optimized for compact in-card placement: glyph + name + preview line.
//
// Boss trial slots show the boss debuff in the same chip style for
// visual parity, so the player reads "this fight has a rule" at a
// glance regardless of source.

import { lookupVoidstorm } from '../../core/round/voidstorms';
import { BOSS_BLINDS } from '../../data/blinds';

type TrialModifierChipProps = {
  voidstormId: string | null;
  isBoss: boolean;
  bossBlindId?: string;
  tight?: boolean;
  compact?: boolean;
};

export function TrialModifierChip({
  voidstormId, isBoss, bossBlindId, tight, compact,
}: TrialModifierChipProps) {
  // Boss path: render the boss debuff line in chip form. We don't know
  // which specific boss will roll until START_BLIND, so on the Hub we
  // show a generic "BOSS RULE" hint unless the caller already knows the
  // bossBlindId (e.g. a forecasted/seeded boss).
  if (isBoss) {
    const boss = bossBlindId ? BOSS_BLINDS.find((b) => b.id === bossBlindId) : undefined;
    const color = boss?.color ?? '#e2334a';
    const label = boss ? boss.name : 'Boss';
    const line = boss?.description ?? 'A boss rule applies.';
    return (
      <Chip color={color} glyph="✺" tone="curse" label={label} line={line} tight={tight} compact={compact} />
    );
  }
  if (!voidstormId) return null;
  const def = lookupVoidstorm(voidstormId);
  if (!def) return null;
  const isBoon = def.tone === 'boon';
  const color = isBoon ? '#7be3ff' : '#ff4d6d';
  const glyph = isBoon ? '✦' : '✺';
  return (
    <Chip
      color={color}
      glyph={glyph}
      tone={def.tone}
      label={def.name}
      line={def.preview ?? def.flavor}
      flavor={def.flavor}
      tight={tight}
      compact={compact}
    />
  );
}

type ChipProps = {
  color: string;
  glyph: string;
  tone: 'boon' | 'curse';
  label: string;
  line: string;
  flavor?: string;
  tight?: boolean;
  compact?: boolean;
};

function Chip({ color, glyph, tone, label, line, flavor, tight, compact }: ChipProps) {
  // Tight = landscape phone: compress to glyph + dot + abbreviated line.
  // Tooltip carries the full string.
  return (
    <div
      className="has-tip trial-mod-chip"
      style={{
        marginTop: tight ? 2 : 4,
        padding: tight ? '2px 6px' : '3px 8px',
        borderRadius: 6,
        background: 'rgba(7,5,26,0.85)',
        border: `1px solid ${color}88`,
        boxShadow: `0 0 8px ${color}33`,
        display: 'inline-flex',
        alignItems: 'center',
        gap: tight ? 4 : 6,
        maxWidth: '100%',
        cursor: 'help',
      }}
    >
      <span style={{
        fontSize: tight ? 11 : compact ? 12 : 13,
        color,
        textShadow: `0 0 6px ${color}`,
        lineHeight: 1,
      }}>
        {glyph}
      </span>
      <span className="f-mono" style={{
        fontSize: tight ? 9 : 10,
        color: '#f3f0ff',
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: tight ? 96 : 132,
      }}>
        {line}
      </span>
      <span className="tip tip-above">
        <span className="tip-title">
          {label} {tone === 'boon' ? '· Boon' : '· Curse / Rule'}
        </span>
        {flavor ? `${line} — ${flavor}` : line}
      </span>
    </div>
  );
}
