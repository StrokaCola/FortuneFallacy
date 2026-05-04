export type RunSlice = {
  seed: number;
  shards: number;
  ante: number;
  goalIdx: number;
  catalysts: string[];
  vouchers: string[];
  consumables: string[];
  ownedMods: string[];
  // Per-die mod attachments. Lives on the run (not the round) so Forge
  // changes persist across blinds. Indexed by die id (0..4).
  diceMods: string[][];
  handsPlayed: number;
  compoundingStacks: number;
};

export const initialRunSlice = (): RunSlice => ({
  seed: Math.floor(Math.random() * 0xFFFFFFFF),
  shards: 0,
  ante: 1,
  goalIdx: 0,
  catalysts: [],
  vouchers: [],
  consumables: [],
  ownedMods: [],
  diceMods: Array.from({ length: 5 }, () => [] as string[]),
  handsPlayed: 0,
  compoundingStacks: 0,
});
