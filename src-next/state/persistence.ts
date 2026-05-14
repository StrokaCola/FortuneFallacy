import { store, type GameState } from './store';
import { safeReadJSON, safeWriteJSON } from './storage';
import { migrateRetheme } from './migrations/v1_retheme';
import { SEEDED_UNLOCKS, SEEDED_DISCOVERED_CONSUMABLES, GATED_CONSTELLATION_IDS } from './slices/meta';
import { begin as perfBegin } from '../devtools/perf';

const KEY = 'ff_next_save';

type SavedState = Pick<GameState, 'run' | 'meta' | 'round' | 'ui' | 'shop'>;

export function loadSaved(): SavedState | null {
  const parsed = safeReadJSON(KEY);
  if (parsed === undefined) return null;
  return migrateRetheme(parsed) as SavedState;
}

export function startPersistence(): () => void {
  let timer: number | null = null;
  // The `shop` slice IS persisted now (offers + rerollCost + pendingPack +
  // pendingSkipBounty). The "fresh shop on every hub re-entry" intent is
  // preserved by clearBlind, which explicitly empties shop.offers so the
  // Shop screen's `if (offers.length === 0) OPEN_SHOP` effect re-rolls.
  // Persisting lets a mid-shop browser refresh restore the same offers
  // instead of shuffling out from under the player.
  const flush = (s: ReturnType<typeof store.getState>): void => {
    timer = null;
    const end = perfBegin('persistence');
    const snapshot: SavedState = { run: s.run, meta: s.meta, round: s.round, ui: s.ui, shop: s.shop };
    safeWriteJSON(KEY, snapshot);
    end();
  };

  const unsub = store.subscribe((s) => {
    if (timer != null) return;
    timer = window.setTimeout(() => flush(s), 400);
  });

  // Tab-close / visibility-hidden is the most common way to lose state to the
  // 400ms debounce. Synchronously flush whatever's pending so the player
  // doesn't lose mid-blind progress on close.
  const onPageHide = (): void => {
    if (timer != null) window.clearTimeout(timer);
    flush(store.getState());
  };
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') onPageHide();
  };
  window.addEventListener('pagehide', onPageHide);
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    unsub();
    if (timer != null) window.clearTimeout(timer);
    window.removeEventListener('pagehide', onPageHide);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

export function applySavedToInitial(s: GameState): GameState {
  const saved = loadSaved();
  if (!saved) return s;
  const mergedMeta = { ...s.meta, ...saved.meta };
  // Saves predating the seeded-unlocks change can carry an empty or partial
  // unlocks array; union with the current seed so legacy players don't see
  // every catalyst/maneuver locked after upgrading.
  //
  // Constellations introduced gating after launch — strip any of the 7
  // gated constellation IDs out of legacy saves so returning players
  // start from Lyra only, same as a fresh save. Lyra is in SEEDED_UNLOCKS
  // and re-added through the union below regardless of what the save held.
  const savedUnlocks = (saved.meta?.unlocks ?? []).filter(
    (id: string) => !(GATED_CONSTELLATION_IDS as readonly string[]).includes(id),
  );
  mergedMeta.unlocks = Array.from(new Set([...SEEDED_UNLOCKS, ...savedUnlocks]));
  // Defensive defaults for fields added after a player's first save.
  mergedMeta.stakeProgress = mergedMeta.stakeProgress ?? {};
  mergedMeta.challengeWins = mergedMeta.challengeWins ?? [];
  // Cosmic Dust + Astral Perks (added 2026-05). Older saves predate these
  // fields; default to a fresh-player state.
  mergedMeta.cosmicDust = mergedMeta.cosmicDust ?? 0;
  mergedMeta.cosmicDustLifetime = mergedMeta.cosmicDustLifetime ?? 0;
  mergedMeta.astralPerks = mergedMeta.astralPerks ?? [];
  // Onboarding (added 2026-05). Legacy saves with no field default to a
  // fresh-player tour state. Players already past their first runs get the
  // tour anyway — that's the price of not tracking save versions; the cost
  // is one popup per screen the first time after upgrade.
  const savedOnb = mergedMeta.onboarding ?? {};
  mergedMeta.onboarding = {
    seen: savedOnb.seen ?? [],
    dismissed: savedOnb.dismissed ?? false,
  };
  const savedDisc = mergedMeta.discovered ?? {};
  // Galaxies (Celestial Pack contents) are seeded as discovered for
  // legacy saves too — their pack-only spawn means the natural
  // discovery loop never fires. Union with whatever was already
  // saved so any other consumables the player encountered stick.
  const savedConsumables = savedDisc.consumables ?? [];
  mergedMeta.discovered = {
    catalysts: savedDisc.catalysts ?? [],
    mods: savedDisc.mods ?? [],
    vouchers: savedDisc.vouchers ?? [],
    bosses: savedDisc.bosses ?? [],
    consumables: Array.from(new Set([...SEEDED_DISCOVERED_CONSUMABLES, ...savedConsumables])),
  };
  // Daily Challenge history (added 2026-05). Legacy saves predate this field;
  // default to an empty record so the Title screen treats every prior date
  // as "never attempted". See online/dailyChallenge.ts.
  mergedMeta.dailyHistory = mergedMeta.dailyHistory ?? {};
  // Achievements (added 2026-05). Legacy saves default to a fresh-player
  // empty set; the listener will re-evaluate predicates on the next
  // event and unlock any retroactively-earned ones.
  const savedAchievements = mergedMeta.achievements ?? {};
  mergedMeta.achievements = {
    unlocked: savedAchievements.unlocked ?? [],
    unlockedAt: savedAchievements.unlockedAt ?? {},
  };
  // Daily login (added 2026-05). Legacy saves default to "never logged
  // in" so the comet fires on first visit after upgrading.
  mergedMeta.dailyLogin = mergedMeta.dailyLogin ?? { lastDate: null };
  // 2026-05-11 easter egg discovery log — append-only, default empty for
  // any save that predates the field.
  mergedMeta.easterEggs = mergedMeta.easterEggs ?? [];
  const mergedRun = { ...s.run, ...saved.run };
  mergedRun.stakeId = mergedRun.stakeId ?? 'spark';
  mergedRun.challengeId = mergedRun.challengeId ?? '';
  // dailyDate (added 2026-05) marks a run as a daily-challenge attempt.
  // Legacy saves default to null (= a regular run) so they don't accidentally
  // submit to today's daily leaderboard on next clear/bust.
  mergedRun.dailyDate = mergedRun.dailyDate ?? null;
  // runStats (added 2026-05) accumulates per-catalyst contribution for the
  // postmortem screen. Legacy saves default to a fresh-run zero; the
  // postmortem just shows fewer details for a partially-completed legacy run.
  mergedRun.runStats = mergedRun.runStats ?? {
    peakHand: 0,
    peakCombo: null,
    catalystChips: {},
    dustEarned: 0,
  };
  // Defensive: an older save with runStats but no dustEarned (added later
  // in 2026-05) shouldn't crash the postmortem on first load.
  if (typeof mergedRun.runStats.dustEarned !== 'number') {
    mergedRun.runStats = { ...mergedRun.runStats, dustEarned: 0 };
  }
  // catalystFires (added late 2026-05) — defensive default for legacy
  // saves that have runStats but no fire counter. The Awakening badge
  // simply won't show until the player triggers a fresh fire after
  // upgrading; safer than reconstructing fires from chip totals.
  if (!mergedRun.runStats.catalystFires) {
    mergedRun.runStats = { ...mergedRun.runStats, catalystFires: {} };
  }
  // Audit modal trigger — added 2026-05. Legacy saves default to false
  // so the modal fires on the next ante-3 entry; that's a small cost
  // that's better than losing the chance to surface the event at all
  // for a returning player.
  mergedRun.auditResolved = mergedRun.auditResolved ?? false;
  // Defensive defaults for fields that might be missing in older saves but
  // are read by selectors in tight render paths. Without these, selectors
  // that fall back to a fresh `{}`/`[]` literal cause useSyncExternalStore
  // to tear-loop and crash with React #185.
  mergedRun.catalystEditions = mergedRun.catalystEditions ?? {};
  mergedRun.ownedModEditions = mergedRun.ownedModEditions ?? [];
  mergedRun.diceModEditions = mergedRun.diceModEditions ?? [];
  mergedRun.comboLevels = mergedRun.comboLevels ?? {};
  mergedRun.consumables = mergedRun.consumables ?? [];
  mergedRun.catalysts = mergedRun.catalysts ?? [];
  mergedRun.vouchers = mergedRun.vouchers ?? [];
  mergedRun.ownedMods = mergedRun.ownedMods ?? [];
  mergedRun.diceMods = mergedRun.diceMods ?? [];
  mergedRun.catalystStacks = mergedRun.catalystStacks ?? {};
  mergedRun.lunarPhase = mergedRun.lunarPhase ?? 0;
  mergedRun.lunarBakedMult = mergedRun.lunarBakedMult ?? 0;
  mergedRun.diceModStacks = mergedRun.diceModStacks ?? mergedRun.diceMods.map((m: string[]) => m.map(() => 0));
  mergedRun.theAnswerArmed = mergedRun.theAnswerArmed ?? false;
  mergedRun.mirroredHandActive = mergedRun.mirroredHandActive ?? false;
  // upcomingBossId (added 2026-05) — legacy saves predate this field;
  // default null so startBlind falls back to a fresh roll and saves
  // it for subsequent refreshes.
  mergedRun.upcomingBossId = mergedRun.upcomingBossId ?? null;
  // Shop (newly persisted 2026-05). Legacy saves predate the field
  // entirely → fall back to the fresh slice so Shop's useEffect rolls
  // offers on next mount.
  const mergedShop = saved.shop ? { ...s.shop, ...saved.shop } : s.shop;
  return {
    ...s,
    run:   mergedRun,
    meta:  mergedMeta,
    round: saved.round?.active ? { ...s.round, ...saved.round, handInProgress: false } : s.round,
    ui:    { ...s.ui, screen: saved.ui?.screen ?? s.ui.screen },
    shop:  mergedShop,
  };
}
