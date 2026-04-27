import type { GameState } from '../../state/store';
import type { GameEventEmission, SimulationRequest, SimulationResult, SimMetrics, ComboId, UpgradeId } from '../../events/types';
import type { SeededRng } from '../rng';

export const Phase = {
  ROLL_START:          0,
  PRE_ROLL_MODIFIERS:  1,
  INIT_SIMULATION:     2,
  POST_ROLL_MODIFIERS: 3,
  EVALUATION:          4,
  UPGRADES:            5,
  SCORING:             6,
  EMIT:                7,
  ROLL_END:            8,
} as const;
export type Phase = typeof Phase[keyof typeof Phase];

export type ComboMatch = {
  id: ComboId;
  tier: number;
  baseChips: number;
  baseMult: number;
  scoringFaces: number[];
};

export type PipelineCtx = {
  state: GameState;
  simRequest?: SimulationRequest;
  sim?: SimulationResult;
  metrics?: SimMetrics;
  combo?: ComboMatch;
  chips: number;
  mult: number;
  total: number;
  events: GameEventEmission[];
  rng: SeededRng;
  chain?: { len: number; tier: number; mult: number; broke: boolean };
};

export type PhaseFn = (ctx: PipelineCtx) => PipelineCtx;

export type UpgradeDef = {
  id: UpgradeId;
  phase: Phase;
  priority: number;
  apply: PhaseFn;
};
