import type { Phase } from '../core/pipeline/types';

export type DieSnapshot = {
  id: number;
  face: number;
  locked: boolean;
};

export type SimulationRequest = {
  diceToRoll: number[];
  seed: number;
};

export type SimulationResult = {
  finalFaces: number[];
  restPositions: { x: number; y: number; z: number }[];
  settleMs: number[];
  peakVelocity: number;
  collisionCount: number;
  bounceHeights: number[];
  cameraShake?: number;
};

export type SimMetrics = {
  chaos: number;
  impact: number;
  settle: number;
  sync: number;
};

export type ComboId = string;
export type UpgradeId = string;
export type BlindId = string;

export type ShopOffer = {
  kind: 'oracle' | 'voucher' | 'consumable';
  id: string;
  price: number;
};

export type GameEventMap = {
  onPing:              { msg: string };
  onRollStart:         { dice: DieSnapshot[]; lockedMask: boolean[] };
  onSimulationStart:   { request: SimulationRequest };
  onSimulationEnd:     { result: SimulationResult };
  onRollEnd:           { faces: number[]; metrics: SimMetrics };
  onScoreCalculated:   { combo: ComboId; chips: number; mult: number; total: number };
  onUpgradeTriggered:  { id: UpgradeId; phase: Phase; deltaChips: number; deltaMult: number };
  onComboDetected:     { combo: ComboId; tier: number };
  onBlindCleared:      { blindId: BlindId; ante: number };
  onBossRevealed:      { blindId: BlindId; ante: number };
  onShopOpened:        { offers: ShopOffer[] };
  onLockToggled:       { dieIdx: number; locked: boolean };
  onOfferBought:       { kind: ShopOffer['kind']; id: string; price: number };
};

export type GameEventEmission = {
  [K in keyof GameEventMap]: { type: K; payload: GameEventMap[K] };
}[keyof GameEventMap];
