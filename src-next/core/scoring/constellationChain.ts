const CHAIN_MAX_DEFAULT = 8;
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
