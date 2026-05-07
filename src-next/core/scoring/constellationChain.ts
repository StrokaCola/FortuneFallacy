// Lowered 8 → 4 per the 2026-05-07 audit: chain length is bounded by hands
// per blind (3 base, 4 with Open Mic voucher), so a cap of 8 was unreachable.
// At 4 the cap is touchable on a stretched build, and Ophiuchus's `chainCap: 4`
// modifier becomes a redundant identity (kept for documentation; flavor text
// still references it).
const CHAIN_MAX_DEFAULT = 4;
const CHAIN_STEP_DEFAULT = 0.25;

export type ChainResult = {
  chainLen: number;
  chainTier: number;
  chainMult: number;
  broke: boolean;
};

export type ChainConfig = {
  cap?: number;        // default 8
  step?: number;       // default 0.25
  neverBreaks?: boolean;
};

export function applyChain(
  currentTier: number,
  prevChainLen: number,
  prevChainTier: number,
  config: ChainConfig = {},
): ChainResult {
  const cap = config.cap ?? CHAIN_MAX_DEFAULT;
  const step = config.step ?? CHAIN_STEP_DEFAULT;
  const neverBreaks = !!config.neverBreaks;

  let chainLen: number;
  let chainTier: number;
  if (prevChainLen > 0 && currentTier >= prevChainTier) {
    chainLen = Math.min(cap, prevChainLen + 1);
    chainTier = currentTier;
  } else if (prevChainLen === 0) {
    chainLen = 1;
    chainTier = currentTier;
  } else if (neverBreaks) {
    // Constellation rule (Ouroboros): chain never resets. We still cap and
    // we keep tracking the highest seen tier so re-extension behaves.
    chainLen = Math.min(cap, prevChainLen + 1);
    chainTier = Math.max(prevChainTier, currentTier);
  } else {
    chainLen = 0;
    chainTier = -1;
  }
  const chainMult = 1 + step * Math.max(0, chainLen - 1);
  return { chainLen, chainTier, chainMult, broke: !neverBreaks && chainLen === 0 && prevChainLen >= 2 };
}

export function chainBreakRefund(prevChainLen: number): number {
  return Math.max(0, prevChainLen) * 2;
}
