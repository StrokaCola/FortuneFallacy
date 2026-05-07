import { useEffect, useState } from 'react';

// Returns true when the device viewport is below ~900px wide OR ~700px
// tall — used by constellation surfaces to opt into denser type /
// tighter spacing. Includes the height check so phone landscape (where
// CSS height is the constraining axis, ~540 px on Galaxy at DPR=2)
// still gets the compact treatment.
function compute(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 900 || window.innerHeight < 700;
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
//
// Height threshold is 600 (rather than 520) so a phone landscape at
// CSS 540 — common on Galaxy at DPR=2 — also fires the tight branches.
// Keeping a buffer above the typical Android browser-chrome-eating
// case so subtle URL-bar animations don't flicker the breakpoint.
function computeTight(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 720 || window.innerHeight < 600;
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
