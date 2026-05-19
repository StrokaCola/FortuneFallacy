import { COMBOS } from './combos';
import type { SequenceInput, BeatSourceType } from './types';

// Wave T Theater (2026-05-19) — classify an upgrade event id into
// theater attribution metadata. Mirrors the id format conventions
// documented in core/upgrades/eventId.ts:
//
//   'stratifier'              → catalyst, sourceId='stratifier'
//   'gilding_press@2'         → catalyst, sourceId='gilding_press', dieIdx=2
//   'edition:foil@stratifier' → catalyst, sourceId='stratifier'
//   'mod:loaded@3'            → mod, sourceId='loaded', dieIdx=3
//   'resonance:symphony'      → resonance, sourceId='symphony'
//   'easter_egg:answer'       → unknown (not surfaced by theater attribution)
function classifyEventSource(
  eventId: string,
): { sourceType: BeatSourceType; sourceId?: string; dieIdx?: number } {
  if (!eventId) return { sourceType: 'unknown' };
  if (eventId.startsWith('resonance:')) {
    return { sourceType: 'resonance', sourceId: eventId.slice('resonance:'.length) };
  }
  if (eventId.startsWith('mod:')) {
    const body = eventId.slice('mod:'.length);
    const at = body.indexOf('@');
    if (at >= 0) {
      const dieIdx = Number.parseInt(body.slice(at + 1), 10);
      return {
        sourceType: 'mod',
        sourceId: body.slice(0, at),
        dieIdx: Number.isFinite(dieIdx) ? dieIdx : undefined,
      };
    }
    return { sourceType: 'mod', sourceId: body };
  }
  if (eventId.startsWith('edition:')) {
    const at = eventId.indexOf('@');
    return { sourceType: 'catalyst', sourceId: at > 0 ? eventId.slice(at + 1) : undefined };
  }
  if (eventId.startsWith('easter_egg:')) {
    return { sourceType: 'unknown', sourceId: eventId.slice('easter_egg:'.length) };
  }
  // Plain catalyst form, optionally @dieIdx.
  const at = eventId.indexOf('@');
  if (at > 0) {
    const dieIdx = Number.parseInt(eventId.slice(at + 1), 10);
    return {
      sourceType: 'catalyst',
      sourceId: eventId.slice(0, at),
      dieIdx: Number.isFinite(dieIdx) ? dieIdx : undefined,
    };
  }
  return { sourceType: 'catalyst', sourceId: eventId };
}

type MinimalScoringCtx = {
  combo: { id: string; tier: number } | null;
  chips: number;
  mult: number;
  chain: { mult: number };
  total: number;
  events: Array<{ type: string; payload: { id: string; phase: number; deltaChips: number; deltaMult: number } }>;
  state: { round: { dice: Array<{ face: number }>; scoringOrder?: number[] } };
};

export function adaptScoringContext(ctx: MinimalScoringCtx): SequenceInput {
  // Held-only scoring: animate only the dice that actually scored, in
  // scoringOrder (left-to-right). Falls back to all dice in natural order
  // for back-compat when scoringOrder is absent (legacy ctxs / tests).
  const allDice = ctx.state.round.dice;
  const order = ctx.state.round.scoringOrder ?? allDice.map((_, i) => i);
  const dieIndices = order.filter((idx) => idx >= 0 && idx < allDice.length);
  const faces = dieIndices.map((idx) => allDice[idx]!.face);
  const faceSum = faces.reduce((a, b) => a + b, 0);
  const comboLabel = (ctx.combo?.id ?? 'CHANCE').toUpperCase();

  // Base mult from combo evaluation (before any upgrade events).
  const comboDef = COMBOS.find((c) => c.id === ctx.combo?.id);
  const baseMult = comboDef?.mult ?? 1;

  // Extract per-event upgrade data from pipeline events.
  const upgradeEvents = (ctx.events ?? []).filter((e) => e.type === 'onUpgradeTriggered');

  const upgrades = upgradeEvents
    .filter((e) => e.payload.deltaChips !== 0 || e.payload.deltaMult !== 0)
    .map((e) => {
      const src = classifyEventSource(e.payload.id);
      return {
        label: e.payload.id,
        chipDelta: e.payload.deltaChips,
        multDelta: e.payload.deltaMult,
        tint: e.payload.id === 'patience_counter' ? ('magenta' as const) : undefined,
        sourceType: src.sourceType,
        sourceId: src.sourceId,
        dieIdx: src.dieIdx,
      };
    });

  // comboBonus = pure combo chip bonus only (mod chip deltas moved to upgrade beats).
  const modChipsTotal = upgradeEvents.reduce((s, e) => s + e.payload.deltaChips, 0);
  const comboBonus = Math.max(0, ctx.chips - faceSum - modChipsTotal);

  // mults: only chain (ctx.mult is reconstructed via baseMult + upgrade-mult beats).
  const mults: SequenceInput['mults'] = [];
  if (ctx.chain.mult !== 1) mults.push({ label: 'chain', value: ctx.chain.mult });

  return {
    faces,
    dieIndices,
    comboLabel,
    comboBonus,
    baseMult,
    upgrades,
    mults,
    finalTotal: ctx.total,
  };
}
