import './theOracle';
import './chaosTheory';
import './prophet';
import './foolsFortune';
import './silverTongue';
import './entropyStone';

export const ORACLE_IDS = [
  'the_oracle', 'chaos_theory', 'prophet',
  'fools_fortune', 'silver_tongue', 'entropy_stone',
] as const;
export type OracleId = typeof ORACLE_IDS[number];
