// "One More Run" carrot computation. Picks the single most-engaging next
// goal for the player based on their current meta state, so the post-run
// screen can surface a concrete reason to immediately start another run.
// Priority order is tuned so that high-recency events (today's daily,
// nearby perks) win over slow-burn ones (codex completion).
//
// Pure function — takes the meta/run snapshots it needs and returns a
// label + tone. No store reads, no event listeners. Easy to test.

import type { GameState } from '../../../state/store';
import { ASTRAL_PERKS } from '../../../data/astralPerks';
import { CATALYST_META } from '../../../data/catalysts';
import { getDailyChallenge } from '../../../online/dailyChallenge';
import { lookupConstellation } from '../../../data/constellations';

export type OneMoreRunHook = {
  // Single sentence shown above the action button.
  label: string;
  // Drives the accent color in the UI.
  tone: 'daily' | 'dust' | 'codex' | 'stake' | 'generic' | 'nearMiss';
  // Optional click handler — when non-null, the postmortem makes the
  // carrot itself a button (e.g. starts today's daily directly).
  onClick?: () => void;
};

const DUST_HOOK_THRESHOLD = 30;
const CODEX_HOOK_THRESHOLD = 5;

export function computeOneMoreRunHook(
  meta: GameState['meta'],
  run: GameState['run'],
  now: Date = new Date(),
  nearMiss?: { deficit: number } | null,
): OneMoreRunHook {
  // 0. Near-miss bust: highest priority when set. Bust within 10% of target
  // gets a forward-tilted carrot ("you were N short") instead of the
  // standard daily/dust nudges. Drives immediate retry intent.
  if (nearMiss && nearMiss.deficit > 0) {
    return {
      label: `${nearMiss.deficit.toLocaleString()} short — one more`,
      tone: 'nearMiss',
    };
  }
  // 1. Daily challenge available today?
  // The just-finished run might itself BE today's daily (in which case the
  // history entry already exists for today and we skip this carrot).
  const daily = getDailyChallenge(now);
  const todayAttempt = (meta.dailyHistory ?? {})[daily.date];
  if (!todayAttempt) {
    const constellation = lookupConstellation(daily.constellationId);
    return {
      label: `★ Today's Daily Challenge: ${constellation.name}`,
      tone: 'daily',
    };
  }

  // 2. Close to next astral perk? Show the cheapest UNOWNED perk if the
  // gap is within DUST_HOOK_THRESHOLD. We don't show the next perk in
  // CATALOG ORDER — the player can buy them in any order, so "the closest
  // affordable" reads more naturally.
  const owned = new Set(meta.astralPerks ?? []);
  const dustHave = meta.cosmicDust ?? 0;
  const closestPerk = ASTRAL_PERKS
    .filter((p) => !owned.has(p.id))
    .filter((p) => p.cost > dustHave)
    .sort((a, b) => a.cost - b.cost)[0];
  if (closestPerk) {
    const gap = closestPerk.cost - dustHave;
    if (gap <= DUST_HOOK_THRESHOLD) {
      return {
        label: `${gap} dust from ${closestPerk.name}`,
        tone: 'dust',
      };
    }
  }

  // 3. Close to discovering all catalysts? Drives codex completion which
  // (per the roadmap) will eventually grant a "Cartographer" reward.
  const totalCatalysts = CATALYST_META.length;
  const discovered = (meta.discovered?.catalysts ?? []).length;
  const remaining = totalCatalysts - discovered;
  if (remaining > 0 && remaining <= CODEX_HOOK_THRESHOLD) {
    return {
      label: `${remaining} catalyst${remaining === 1 ? '' : 's'} from a complete codex`,
      tone: 'codex',
    };
  }

  // 4. Affordable perk that just isn't in the "close" range? Still worth
  // surfacing — buying the perk IS a "one more run" goal even if dust is
  // already there. Use the cheapest unowned perk the player can afford.
  const affordablePerk = ASTRAL_PERKS
    .filter((p) => !owned.has(p.id))
    .filter((p) => p.cost <= dustHave)
    .sort((a, b) => b.cost - a.cost)[0];
  if (affordablePerk) {
    return {
      label: `Astral Forge: ${affordablePerk.name} ready to claim`,
      tone: 'dust',
    };
  }

  // 5. Stake progression — if the player just cleared on a constellation,
  // their next stake on that constellation is now playable. Hard to tell
  // exactly without re-running stake-progress logic, so this is a soft
  // hint pointing at the constellation they just played.
  const justClearedStake = meta.stakeProgress?.[run.constellationId];
  if (justClearedStake) {
    const cName = lookupConstellation(run.constellationId).name;
    return {
      label: `Push ${cName} to the next stake`,
      tone: 'stake',
    };
  }

  // 6. Default. Even an unincentivized "run again" is a real call-to-action.
  return {
    label: 'One more ascension',
    tone: 'generic',
  };
}

export const HOOK_TONE_COLOR: Record<OneMoreRunHook['tone'], string> = {
  daily: '#f5c451',
  dust: '#7be3ff',
  codex: '#cc88ff',
  stake: '#ff7847',
  generic: '#bba8ff',
  nearMiss: '#ff8aa8',
};
