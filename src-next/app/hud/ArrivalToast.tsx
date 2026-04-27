import { useEffect, useState } from 'react';

export function ArrivalToast() {
  const [shown, setShown] = useState(false);
  const [from, setFrom] = useState<string>('');

  useEffect(() => {
    const params = window.Portal?.readPortalParams();
    if (!params?.fromPortal) return;
    const ref = params.ref;
    setFrom(ref ? extractDomain(ref) : 'the void');
    setShown(true);
    const t = window.setTimeout(() => setShown(false), 5000);
    return () => window.clearTimeout(t);
  }, []);

  if (!shown) return null;

  return (
    <div
      onClick={() => setShown(false)}
      className="mat-crystal"
      style={{
        position: 'absolute', top: 18, right: '50%', transform: 'translate(50%, 0)',
        padding: '8px 16px', borderRadius: 10, zIndex: 40,
        cursor: 'pointer', pointerEvents: 'auto',
        animation: 'fadein 400ms ease-out',
      }}>
      <span className="f-mono uc" style={{ fontSize: 10, letterSpacing: '0.28em', color: '#7be3ff' }}>
        ✦ arrived from <span style={{ color: '#f5c451' }}>{from}</span>
      </span>
    </div>
  );
}

function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url.slice(0, 24);
  }
}
