// Single source of truth for the guided-tour sequence. Each step names:
//   - the anchor (`data-coach` value) the overlay bubble points at
//   - the bubble copy (warm-mentor voice, ≤2 sentences, **bold** the new term)
//   - the action that advances the tour (or 'click' for the bubble's own
//     "Got it" button)
//   - the optional `diceFaces` override that initSimulation reads for the
//     next ROLL_REQUESTED
//
// The handler (../../actions/handlers/tutorial.ts) walks this array in
// order via ADVANCE_TUTORIAL. Order matters: steps are filed under their
// natural occurrence in the round/shop flow, not their numbering.

import type { TutorialStepId } from '../../../state/slices/tutorial';
import type { Action } from '../../../actions/types';

export type AdvanceTrigger =
  // Bubble has a "Got it" button. Click advances.
  | { kind: 'click' }
  // A specific action type advances when dispatched. Optional `pred` lets
  // a step gate on state shape (e.g. "both 5s now locked").
  | { kind: 'action'; actionType: Action['type']; pred?: (s: import('../../../state/store').GameState, a: Action) => boolean };

export interface TutorialStep {
  id: TutorialStepId;
  // data-coach selector value on the DOM element the bubble points at.
  anchor: string;
  // Bubble copy. Warm-mentor voice, ≤2 sentences, ≤110 chars per sentence.
  // Use ** ** in the source for bold; rendering layer parses inline bold.
  text: string;
  // Position relative to anchor.
  side: 'above' | 'below';
  // What advances the tour to the next step.
  advance: AdvanceTrigger;
  // Optional scripted dice for the NEXT roll. Unlocked dice get these
  // values; locked dice keep their face.
  diceFaces?: readonly number[];
  // Optional indices of dice the lock-ring overlay should highlight.
  // Used by TutorialOverlay to draw a pulse on the correct dice during
  // t_lock_pair. Reads as `[data-die-idx="0"], [data-die-idx="1"]`.
  highlightDice?: readonly number[];
}

// 12-step sequence: 8 in round, 4 in shop. Faces below pair with the
// scripted catalyst (Stratifier — fires on Full House) so the first
// scored hand visibly demonstrates a catalyst payout.
//
// Hand 1: roll → lock two 5s → reroll → [5,5,3,3,3] Full House.
// Hand 2: roll → [4,4,4,1,2] Three of a Kind, score as-is.
export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: 't_intro_roll',
    anchor: 'roll-btn',
    side: 'above',
    text: "Welcome. Five dice, three hands. Tap **Roll** to throw — let's see what the sky gives us.",
    advance: { kind: 'action', actionType: 'ROLL_REQUESTED' },
    diceFaces: [5, 5, 3, 3, 4],
  },
  {
    id: 't_lock_pair',
    anchor: 'dice-tray',
    side: 'above',
    text: "Two fives. Tap each five to **lock** it — locked dice keep their face when you reroll.",
    advance: {
      kind: 'action',
      actionType: 'TOGGLE_LOCK',
      pred: (s) => {
        // Advance when both five-bearing dice are locked.
        const lockedCount = s.round.dice.filter((d) => d.locked && d.face === 5).length;
        return lockedCount >= 2;
      },
    },
    highlightDice: [0, 1],
  },
  {
    id: 't_reroll',
    anchor: 'reroll-btn',
    side: 'above',
    text: "Now **Reroll** the others. We're chasing a Full House — three of one face, two of another.",
    advance: { kind: 'action', actionType: 'REROLL_REQUESTED' },
    diceFaces: [5, 5, 3, 3, 3],
  },
  {
    id: 't_score_first',
    anchor: 'play-hand-btn',
    side: 'above',
    text: "**Full House** — three 3s and two 5s. Tap **Play Hand** to score it.",
    advance: { kind: 'action', actionType: 'SCORE_HAND' },
  },
  {
    id: 't_catalyst_intro',
    anchor: 'catalyst-strip',
    side: 'below',
    text: "Nice. **Stratifier** doubled the multiplier — that's a **catalyst**: a card that reshapes how your dice score.",
    advance: { kind: 'click' },
  },
  {
    id: 't_hand_two',
    anchor: 'roll-btn',
    side: 'above',
    text: "One hand down. Roll again — we want a big finish.",
    advance: { kind: 'action', actionType: 'ROLL_REQUESTED' },
    diceFaces: [4, 4, 4, 4, 4],
  },
  {
    id: 't_score_two_pair',
    anchor: 'play-hand-btn',
    side: 'above',
    text: "**Five of a Kind** — the strongest combo. Score it to clear the trial; the **shop** opens next.",
    advance: { kind: 'action', actionType: 'SCORE_HAND' },
  },
  // ── Shop steps ────────────────────────────────────────────────────────
  {
    id: 't_shop_intro',
    anchor: 'shop-offers',
    side: 'above',
    text: "**Shards** are your currency. Spend them on cards that change how your run plays.",
    advance: { kind: 'click' },
  },
  {
    id: 't_shop_recommend',
    anchor: 'shop-offers',
    side: 'above',
    text: "**Compounding Bias** stacks +0.10× mult every cleared trial — a great first buy. Tap it.",
    advance: { kind: 'action', actionType: 'BUY_OFFER', pred: (s, a) => a.type === 'BUY_OFFER' && a.offerIdx === 0 },
  },
  {
    id: 't_shop_voucher',
    anchor: 'shop-offers',
    side: 'above',
    text: "**Shard Streak** is a **voucher** — a one-time buy that lasts the whole run. We'll save shards this time.",
    advance: { kind: 'click' },
  },
  {
    id: 't_shop_continue',
    anchor: 'next-trial-btn',
    side: 'above',
    text: "Tap **Next Trial** to head on. The rest of the run is yours — I'll whisper hints when something new shows up.",
    advance: { kind: 'action', actionType: 'SET_SCREEN', pred: (_s, a) => a.type === 'SET_SCREEN' && a.screen === 'hub' },
  },
] as const;

// O(1) lookup by id — avoids walking the array per step transition.
const BY_ID: Record<string, TutorialStep | undefined> = {};
for (const step of TUTORIAL_STEPS) BY_ID[step.id] = step;

export function lookupStep(id: TutorialStepId | null): TutorialStep | null {
  if (id == null) return null;
  return BY_ID[id] ?? null;
}

export function nextStepId(id: TutorialStepId | null): TutorialStepId | null {
  if (id == null) return TUTORIAL_STEPS[0]?.id ?? null;
  const idx = TUTORIAL_STEPS.findIndex((s) => s.id === id);
  if (idx < 0 || idx + 1 >= TUTORIAL_STEPS.length) return null;
  return TUTORIAL_STEPS[idx + 1]?.id ?? null;
}

export const FIRST_STEP_ID: TutorialStepId = 't_intro_roll';
export const LAST_STEP_ID: TutorialStepId = 't_shop_continue';
