const CHAIN_MAX = 8;
const CHAIN_STEP = 0.25;

export type ChainResult = {
  chainLen: number;
  chainTier: number;
  chainMult: number;
  broke: boolean;
};

export function applyChain(currentTier: number, prevChainLen: number, prevChainTier: number): ChainResult {
  let chainLen: number;
  let chainTier: number;
  if (prevChainLen > 0 && currentTier >= prevChainTier) {
    chainLen = Math.min(CHAIN_MAX, prevChainLen + 1);
    chainTier = currentTier;
  } else if (prevChainLen === 0) {
    chainLen = 1;
    chainTier = currentTier;
  } else {
    chainLen = 0;
    chainTier = -1;
  }
  const chainMult = 1 + CHAIN_STEP * Math.max(0, chainLen - 1);
  return { chainLen, chainTier, chainMult, broke: chainLen === 0 && prevChainLen >= 2 };
}

export function chainBreakRefund(prevChainLen: number): number {
  return Math.max(0, prevChainLen) * 2;
}
