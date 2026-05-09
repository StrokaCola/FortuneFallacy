import { useEffect, useRef, useState } from 'react';
import { bus } from '../../events/bus';
import { useStore, type GameState } from '../../state/store';
import { lookupCatalyst } from '../../data/catalysts';
import { sfxPlay } from '../../audio/sfx';
import { catalystIdFromEvent } from '../../core/upgrades/eventId';

const FLASH_DURATION_MS = 720;
const COOLDOWN_MS = 380;

const selectCatalysts = (s: GameState) => s.run.catalysts;

/**
 * Screen-edge fanfare that fires when an owned legendary catalyst's effect
 * lands. Sits at the root layer with pointer-events: none so it never
 * intercepts gameplay input. Throttled by COOLDOWN_MS so a legendary that
 * fires several times in one hand doesn't strobe the screen.
 */
export function LegendaryFire() {
  const catalysts = useStore(selectCatalysts);
  const [flashes, setFlashes] = useState<{ key: number; color: string }[]>([]);
  const flashKeyRef = useRef(0);
  const lastFireRef = useRef(0);

  useEffect(() => {
    const off = bus.on('onUpgradeTriggered', (payload: { id: string }) => {
      const catalystId = catalystIdFromEvent(payload.id);
      if (!catalystId || !catalysts.includes(catalystId)) return;
      const meta = lookupCatalyst(catalystId);
      if (!meta || meta.rarity !== 'legendary') return;

      const now = performance.now();
      if (now - lastFireRef.current < COOLDOWN_MS) return;
      lastFireRef.current = now;

      const key = ++flashKeyRef.current;
      const color = meta.color;
      setFlashes((fs) => [...fs, { key, color }]);
      // Cinematic sting layered on top of the standard 'upgrade' SFX that
      // audioBridge plays for every fire. comboChime is the lowest-bass
      // bell available — pairs with castSwell for the swoosh-into-bell
      // motif. Both ride the SFX bus so they respect master/SFX sliders.
      sfxPlay('castSwell', { gain: 0.7 });
      window.setTimeout(() => sfxPlay('comboChime', { gain: 1.1 }), 80);

      window.setTimeout(() => {
        setFlashes((fs) => fs.filter((f) => f.key !== key));
      }, FLASH_DURATION_MS);
    });
    return () => off();
  }, [catalysts]);

  if (flashes.length === 0) return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 8,
        overflow: 'hidden',
      }}
    >
      {flashes.map((f) => (
        <div
          key={f.key}
          className="legendary-fire-rim"
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at center, transparent 50%, ${f.color}22 75%, ${f.color}55 100%)`,
            mixBlendMode: 'screen',
            animation: `legendary-fire-rim ${FLASH_DURATION_MS}ms cubic-bezier(0.15, 0.6, 0.3, 1) forwards`,
          }}
        />
      ))}
    </div>
  );
}
