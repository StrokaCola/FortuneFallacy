import { lookupMod } from '../../core/mods';
import { lookupCatalyst } from '../../data/catalysts';
import { COMBOS } from '../../core/scoring/combos';

export type LastScoringCtx = {
  combo: { id: string; tier: number } | null;
  chips: number;
  mult: number;
  chain: { mult: number };
  total: number;
  events: Array<{
    type: string;
    payload: { id: string; phase: number; deltaChips: number; deltaMult: number };
  }>;
  state: { round: { dice: Array<{ face: number }>; scoringOrder?: number[] } };
};

export type ParsedId =
  | { kind: 'mod'; modId: string; dieIdx: number }
  | { kind: 'crownMul'; dieIdx: number }
  | { kind: 'catalyst'; catalystId: string };

export function parseEventId(id: string): ParsedId {
  if (id.startsWith('mod:')) {
    const rest = id.slice(4);
    const at = rest.indexOf('@');
    if (at >= 0) {
      const name = rest.slice(0, at);
      const dieIdx = Number(rest.slice(at + 1));
      if (Number.isFinite(dieIdx)) {
        if (name === 'crownMul') return { kind: 'crownMul', dieIdx };
        return { kind: 'mod', modId: name, dieIdx };
      }
    }
  }
  return { kind: 'catalyst', catalystId: id };
}

export type ExplainRow = {
  key: string;
  source: 'mod' | 'catalyst';
  label: string;
  icon: string;
  color: string;
  detail: string;
  chipsDelta: number;
  multDelta: number;
};

export type Explanation = {
  combo: { name: string; baseChips: number; baseMult: number } | null;
  rows: ExplainRow[];
  totalChips: number;
  totalMult: number;
  chainMult: number;
  total: number;
};

const MOD_COLOR = '#bba8ff';
const CATALYST_COLOR = '#cc88ff';

export function buildExplanation(ctx: LastScoringCtx): Explanation {
  const comboDef = ctx.combo ? COMBOS.find((c) => c.id === ctx.combo!.id) ?? null : null;

  const rows: ExplainRow[] = [];
  for (let i = 0; i < ctx.events.length; i++) {
    const ev = ctx.events[i]!;
    if (ev.type !== 'onUpgradeTriggered') continue;
    const parsed = parseEventId(ev.payload.id);

    if (parsed.kind === 'mod') {
      const def = lookupMod(parsed.modId);
      const die = ctx.state.round.dice[parsed.dieIdx];
      rows.push({
        key: `r${i}`,
        source: 'mod',
        label: def?.name ?? parsed.modId,
        icon: def?.icon ?? '◆',
        color: def?.visual?.accentColor ?? MOD_COLOR,
        detail: die ? `die ${parsed.dieIdx + 1} · face ${die.face}` : `die ${parsed.dieIdx + 1}`,
        chipsDelta: ev.payload.deltaChips,
        multDelta: ev.payload.deltaMult,
      });
    } else if (parsed.kind === 'crownMul') {
      const die = ctx.state.round.dice[parsed.dieIdx];
      rows.push({
        key: `r${i}`,
        source: 'mod',
        label: 'Crown',
        icon: '♛',
        color: '#ffd84a',
        detail: die ? `die ${parsed.dieIdx + 1} · face ${die.face} · ×mult` : `die ${parsed.dieIdx + 1} · ×mult`,
        chipsDelta: 0,
        multDelta: ev.payload.deltaMult,
      });
    } else {
      const cat = lookupCatalyst(parsed.catalystId);
      rows.push({
        key: `r${i}`,
        source: 'catalyst',
        label: cat?.name ?? prettyId(parsed.catalystId),
        icon: cat?.icon ?? '✦',
        color: cat?.color ?? CATALYST_COLOR,
        detail: 'catalyst',
        chipsDelta: ev.payload.deltaChips,
        multDelta: ev.payload.deltaMult,
      });
    }
  }

  return {
    combo: comboDef
      ? { name: comboDef.name, baseChips: comboDef.chips, baseMult: comboDef.mult }
      : null,
    rows,
    totalChips: ctx.chips,
    totalMult: ctx.mult,
    chainMult: ctx.chain.mult,
    total: ctx.total,
  };
}

function prettyId(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Big numbers without thousands separators were unreadable in the
// breakdown modal — "1234567" parses as gibberish at a glance.
// Integers ≥1000 now get locale-formatted commas; multipliers
// (typically <100, often fractional) keep their raw decimal form so
// "1.25" doesn't become "1,25" under non-en locales.
export function formatNumber(n: number): string {
  if (Number.isInteger(n)) {
    return Math.abs(n) >= 1000 ? n.toLocaleString('en-US') : String(n);
  }
  return (Math.round(n * 100) / 100).toString();
}

export function formatDelta(n: number): string {
  if (n === 0) return '0';
  const sign = n > 0 ? '+' : '';
  return `${sign}${formatNumber(n)}`;
}
