export type RunSlice = {
  seed: number;
  shards: number;
  ante: number;
  goalIdx: number;
  oracles: string[];
  vouchers: string[];
  consumables: string[];
};

export const MAX_CONSUMABLES = 4;

export const initialRunSlice = (): RunSlice => ({
  seed: Math.floor(Math.random() * 0xFFFFFFFF),
  shards: 0,
  ante: 1,
  goalIdx: 0,
  oracles: [],
  vouchers: [],
  consumables: [],
});
