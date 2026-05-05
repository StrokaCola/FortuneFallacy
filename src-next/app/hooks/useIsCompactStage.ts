import { useEffect, useState } from 'react';

// Returns true when the device viewport is below the same threshold the
// OrientationGate uses to decide a screen is "phone-class" (innerWidth < 900).
// Constellation surfaces use it to opt into denser type / tighter spacing so
// the CSS-scaled stage stays legible on a landscape phone.
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
