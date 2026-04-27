import { useState } from 'react';
import { useStore } from '../../state/store';

export function PortalButton({ label = 'Through the Portal →' }: { label?: string }) {
  const [busy, setBusy] = useState(false);
  const playerName = useStore((s) => s.meta.playerName);

  const onClick = async () => {
    if (!window.Portal) return;
    setBusy(true);
    try {
      const target = await window.Portal.pickPortalTarget();
      if (!target) {
        setBusy(false);
        return;
      }
      window.Portal.sendPlayerThroughPortal(target.url, {
        username: playerName || 'Wanderer',
        color: '7be3ff',
        speed: 5,
      });
    } catch (e) {
      console.warn('[portal] failed:', e);
      setBusy(false);
    }
  };

  return (
    <button className="btn btn-ghost" style={{ width: 240 }} onClick={onClick} disabled={busy}>
      {busy ? 'opening portal…' : label}
    </button>
  );
}
