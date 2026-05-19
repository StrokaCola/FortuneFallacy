// Primer-tab term registry — plain-language definitions of every concept
// a new player needs to read the game's HUD without spelunking the Codex.
// Renders inside Codex.tsx via PrimerTab.tsx. Voice matches the guided
// tour's warm-mentor style: contractions, second person, present-tense
// action verbs. Each definition reads clean out of context — someone
// landing via search shouldn't need the preceding entry.

export type PrimerCategory =
  | 'dice'
  | 'scoring'
  | 'catalysts'
  | 'mods'
  | 'shop'
  | 'trials'
  | 'meta';

export interface PrimerEntry {
  id: string;
  category: PrimerCategory;
  term: string;
  definition: string;
  // Optional cross-link ids (other PrimerEntry.id values). Rendered as
  // inline chips that scroll the linked entry into view.
  seeAlso?: readonly string[];
}

export const PRIMER_CATEGORIES: readonly { id: PrimerCategory; label: string }[] = [
  { id: 'dice',      label: 'Dice & Rolling' },
  { id: 'scoring',   label: 'Scoring' },
  { id: 'catalysts', label: 'Catalysts' },
  { id: 'mods',      label: 'Dice Mods' },
  { id: 'shop',      label: 'Shop & Economy' },
  { id: 'trials',    label: 'Trials & Bosses' },
  { id: 'meta',      label: 'Meta Progression' },
];

export const PRIMER_ENTRIES: readonly PrimerEntry[] = [
  // ── Dice & Rolling ───────────────────────────────────────────────────
  {
    id: 'roll',
    category: 'dice',
    term: 'Roll',
    definition: "Throw all your unlocked dice at once. Each trial gives you a fixed number of hands — every roll counts toward one of them.",
    seeAlso: ['lock', 'reroll', 'hand'],
  },
  {
    id: 'reroll',
    category: 'dice',
    term: 'Reroll',
    definition: "Throw the unlocked dice again, mid-hand. Locked dice keep their face. You get a small budget of rerolls per hand — reroll is for fishing a better combo before scoring.",
    seeAlso: ['lock', 'roll'],
  },
  {
    id: 'lock',
    category: 'dice',
    term: 'Lock',
    definition: "Tap a die to freeze its face. Locked dice keep their value through rerolls. Tap again to unlock.",
    seeAlso: ['roll', 'reroll'],
  },
  {
    id: 'hand',
    category: 'dice',
    term: 'Hand',
    definition: "One scored attempt at the target. A trial gives you three hands by default — each hand scores once and the points add up.",
    seeAlso: ['trial', 'combo'],
  },
  {
    id: 'banish',
    category: 'dice',
    term: 'Banish',
    definition: "A face value that won't roll on a given die. Some mods banish their own die's faces — the engine just keeps re-rolling until it lands somewhere legal.",
    seeAlso: ['mod'],
  },

  // ── Scoring ──────────────────────────────────────────────────────────
  {
    id: 'chips',
    category: 'scoring',
    term: 'Chips',
    definition: "The bright number that adds up. Bigger chip stack means more points before any multiplier hits.",
    seeAlso: ['mult', 'combo'],
  },
  {
    id: 'mult',
    category: 'scoring',
    term: 'Mult (Multiplier)',
    definition: "Multiplies your chip total. \"20 × 4\" reads as 20 chips times 4 = 80 points. Catalysts almost always raise either chips or mult.",
    seeAlso: ['chips', 'catalyst'],
  },
  {
    id: 'combo',
    category: 'scoring',
    term: 'Combo',
    definition: "The hand-type your scoring dice form — Pair, Two Pair, Three of a Kind, Straight, Full House, Four of a Kind, Five of a Kind. Higher combos pay more base chips and mult.",
    seeAlso: ['chips', 'mult'],
  },
  {
    id: 'tier',
    category: 'scoring',
    term: 'Tier',
    definition: "How strong a combo is, ranked 1 (Pair) through 7 (Five of a Kind). Climbing tiers feeds the chain multiplier.",
    seeAlso: ['combo', 'chain'],
  },
  {
    id: 'chain',
    category: 'scoring',
    term: 'Chain',
    definition: "Scoring the same-or-higher combo tier two hands in a row builds a chain multiplier. Drop a tier and the chain resets.",
    seeAlso: ['tier', 'combo'],
  },
  {
    id: 'hot_streak',
    category: 'scoring',
    term: 'Hot Streak',
    definition: "Three hands in a row that each clear two-thirds of the trial's target. A banner celebrates it — and some catalysts spike on hot hands.",
  },

  // ── Catalysts ────────────────────────────────────────────────────────
  {
    id: 'catalyst',
    category: 'catalysts',
    term: 'Catalyst',
    definition: "A card you keep for the whole run. Each one reshapes how your dice score — adding chips, mult, retriggers, or whole new rules.",
    seeAlso: ['edition', 'scaling', 'resonance'],
  },
  {
    id: 'edition',
    category: 'catalysts',
    term: 'Edition',
    definition: "A rare stamp on a catalyst: Foil adds chips, Holo adds mult, Polychrome adds 50% of the card's own contribution, Void costs zero slots. Editions roll randomly in the shop.",
    seeAlso: ['catalyst'],
  },
  {
    id: 'resonance',
    category: 'catalysts',
    term: 'Resonance',
    definition: "A hand-authored synergy between two specific catalysts. When both fire together, the pair pays extra. Discovered resonances land in the Codex.",
    seeAlso: ['catalyst'],
  },
  {
    id: 'scaling',
    category: 'catalysts',
    term: 'Scaling',
    definition: "A catalyst that grows. Each scaling card has a small counter — every matching condition bakes a permanent bonus into the card for the rest of the run.",
    seeAlso: ['catalyst'],
  },
  {
    id: 'awakening',
    category: 'catalysts',
    term: 'Awakening',
    definition: "A milestone a catalyst hits once it fires enough times. Awoken catalysts get a glow + an extra effect baked in for the run.",
    seeAlso: ['catalyst', 'scaling'],
  },

  // ── Dice Mods ────────────────────────────────────────────────────────
  {
    id: 'mod',
    category: 'mods',
    term: 'Mod',
    definition: "A small enchantment attached to a specific die. Mods fire every time that die scores — chips, mult, shards, or face-bending effects.",
    seeAlso: ['forge'],
  },
  {
    id: 'forge',
    category: 'mods',
    term: 'Forge',
    definition: "The between-blinds workshop where you attach, detach, and upgrade mods. Mods owned but unattached sit in inventory.",
    seeAlso: ['mod'],
  },
  {
    id: 'stacking',
    category: 'mods',
    term: 'Stacking',
    definition: "Some mods grow per-die based on what you score with that die. Watch the small chip on the mod for its current tally.",
    seeAlso: ['mod'],
  },

  // ── Shop & Economy ───────────────────────────────────────────────────
  {
    id: 'shards',
    category: 'shop',
    term: 'Shards',
    definition: "Your currency. Earned by clearing trials and from a few catalysts and mods. Spent on catalysts, mods, vouchers, and packs in the shop.",
    seeAlso: ['shop'],
  },
  {
    id: 'shop',
    category: 'shop',
    term: 'Shop',
    definition: "Opens after every cleared trial. Offers reshuffle each visit. Reroll for a small fee that creeps up — or save shards and move on.",
    seeAlso: ['shards', 'voucher', 'pack'],
  },
  {
    id: 'voucher',
    category: 'shop',
    term: 'Voucher',
    definition: "A run-wide upgrade. Extra slots, cheaper rerolls, more hands. Bought once, lasts the whole run.",
    seeAlso: ['shop'],
  },
  {
    id: 'pack',
    category: 'shop',
    term: 'Pack',
    definition: "A bundle you crack open for a pick of consumables. Celestial → galaxies (combo level-ups), Maneuver → tactical one-shots.",
    seeAlso: ['consumable', 'galaxy'],
  },
  {
    id: 'consumable',
    category: 'shop',
    term: 'Consumable',
    definition: "A single-use item that fires the moment you tap it. Three types: galaxies, spectrals, and maneuvers. Limited inventory — keep one in your back pocket.",
    seeAlso: ['galaxy', 'spectral', 'maneuver'],
  },
  {
    id: 'galaxy',
    category: 'shop',
    term: 'Galaxy',
    definition: "A consumable that permanently levels up a combo type for the rest of the run. Use a Whirlpool to make every future Three of a Kind score more.",
    seeAlso: ['consumable', 'combo'],
  },
  {
    id: 'spectral',
    category: 'shop',
    term: 'Spectral',
    definition: "A rare one-shot powerup. Pin a die's face, refund a catalyst, copy a mod — spectrals are the surprise plays in a run.",
    seeAlso: ['consumable'],
  },
  {
    id: 'maneuver',
    category: 'shop',
    term: 'Maneuver',
    definition: "A tactical one-shot — extra hand, extra reroll, set a face. Maneuvers are the safety net for tight rounds.",
    seeAlso: ['consumable'],
  },

  // ── Trials & Bosses ──────────────────────────────────────────────────
  {
    id: 'trial',
    category: 'trials',
    term: 'Trial',
    definition: "One scoring challenge — hit the chip target before your hands run out. Each ante has three trials: two normal, one boss.",
    seeAlso: ['ante', 'blind'],
  },
  {
    id: 'blind',
    category: 'trials',
    term: 'Blind',
    definition: "Another name for a trial. Bosses are called boss blinds because they carry a debuff — a rule that bends just for that fight.",
    seeAlso: ['trial', 'boss_debuff'],
  },
  {
    id: 'ante',
    category: 'trials',
    term: 'Ante',
    definition: "A tier of three trials. Clearing all three advances to the next ante; the chip target scales up. Survive through ante 8 to win the run.",
    seeAlso: ['trial'],
  },
  {
    id: 'boss_debuff',
    category: 'trials',
    term: 'Boss Debuff',
    definition: "A rule the boss imposes for one trial only. Disable rerolls, force scoring order, lower a face's chips — boss debuffs lift the moment you clear.",
    seeAlso: ['blind'],
  },
  {
    id: 'voidstorm',
    category: 'trials',
    term: 'Voidstorm',
    definition: "A trial-wide tilt the cosmos applies to every hand. The chip on the blind tells you what it does — voidstorms are honest.",
  },
  {
    id: 'skip_bounty',
    category: 'trials',
    term: 'Skip Bounty',
    definition: "Skipping a non-boss trial earns a reward — shards, a consumable, a catalyst, or a pack — instead of letting you score. Bosses can't be skipped.",
  },

  // ── Meta Progression ─────────────────────────────────────────────────
  {
    id: 'dust',
    category: 'meta',
    term: 'Cosmic Dust',
    definition: "A currency that carries between runs. Earned per trial cleared and on every run end. Spent in the Astral Forge on permanent perks.",
    seeAlso: ['astral_forge'],
  },
  {
    id: 'astral_forge',
    category: 'meta',
    term: 'Astral Forge',
    definition: "A meta-progression screen between runs. Spend cosmic dust on perks that apply to every future run — extra starting shards, slot capacity, reroll discounts.",
    seeAlso: ['dust'],
  },
  {
    id: 'constellation',
    category: 'meta',
    term: 'Constellation',
    definition: "A run's dice set. Lyra is the classic five d6. Other constellations swap in odd dice — fewer dice, more dice, weird faces — each one rewrites a rule of the table.",
  },
  {
    id: 'stake',
    category: 'meta',
    term: 'Stake',
    definition: "The difficulty tier you start a run on. Spark is the baseline; higher stakes raise targets and harden bosses. Clear a stake to unlock the next.",
  },
];

export function lookupPrimerEntry(id: string): PrimerEntry | undefined {
  return PRIMER_ENTRIES.find((e) => e.id === id);
}
