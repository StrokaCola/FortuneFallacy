import { useEffect, useState } from 'react';

// Returns true when the device viewport is below 900px wide — used by
// constellation surfaces to opt into denser type / tighter spacing.
function compute(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 900;
}

export function useIsCompactStage(): boolean {
  const [compact, setCompact] = useState(compute);

  useEffect(() => {
    const update = () => setCompact(compute());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return compact;
}

// Tighter than `compact`: triggers when *either* dimension drops below
// the threshold, e.g. landscape phones with the browser address bar
// eating most of the height. Used by TopBar to drop the astrolabe and
// shrink padding so trial cards stay above the fold.
function computeTight(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 720 || window.innerHeight < 520;
}

export function useIsTightStage(): boolean {
  const [tight, setTight] = useState(computeTight);

  useEffect(() => {
    const update = () => setTight(computeTight());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return tight;
}
