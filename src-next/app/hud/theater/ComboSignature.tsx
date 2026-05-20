// Wave T+1 (2026-05-19) bespoke theater — Move 1 — combo-class
// signature.
//
// Listens for the combo-detect beat and plays a unique audiovisual
// cue per hand class. Cosmic flavor (chimes, swells, brief light
// pulses) WITH rhythmic differentiation:
//   Chance         → single soft tone
//   One Pair       → 2-note ascending interval
//   Two Pair       → 2 stacked dyads
//   Three of a Kind → triplet drumroll on dice
//   Small Straight → 4-note ascending arpeggio
//   Large Straight → 5-note ascending arpeggio
//   Full House     → major chord swell (chord + triplet underneath)
//   Four of a Kind → thunder strike (low rumble + bright flash)
//   Five of a Kind → galactic burst (bell choir + sustained shimmer)
//
// Visual layer is a brief overlay above the dice row; audio piggies
// on existing comboChime / multSlam voices with frequency variations.

import { useEffect, useState } from 'react';
import type React from 'react';
import { bus } from '../../../events/bus';
import { sfxPlay } from '../../../audio/sfx';
import { Z } from '../zLayers';

type Signature = {
  id: number;
  key: ComboKey;
};

type ComboKey =
  | 'chance' | 'one_pair' | 'two_pair' | 'three_kind'
  | 'sm_straight' | 'lg_straight' | 'full_house'
  | 'four_kind' | 'five_kind';

function comboLabelToKey(label: string): ComboKey | null {
  const k = label.trim().toLowerCase();
  if (k.includes('five')) return 'five_kind';
  if (k.includes('four')) return 'four_kind';
  if (k.includes('full house')) return 'full_house';
  if (k.includes('large straight')) return 'lg_straight';
  if (k.includes('small straight')) return 'sm_straight';
  if (k.includes('three')) return 'three_kind';
  if (k.includes('two pair')) return 'two_pair';
  if (k.includes('pair')) return 'one_pair';
  if (k.includes('chance') || k === 'high card') return 'chance';
  return null;
}

let nextId = 1;
const SIG_TTL = 900;

function reduceMotion(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('reduce-motion');
}

export function ComboSignature() {
  const [sigs, setSigs] = useState<Signature[]>([]);

  useEffect(() => {
    const off = bus.on('onScoreBeat', ({ beat }) => {
      if (beat.kind === 'cast-swell') {
        setSigs([]);
        return;
      }
      if (beat.kind !== 'combo-detect') return;
      const key = comboLabelToKey(beat.comboLabel);
      if (!key) return;
      playComboAudio(key);
      if (reduceMotion()) return;
      const id = nextId++;
      setSigs((cur) => [...cur, { id, key }]);
      window.setTimeout(() => {
        setSigs((cur) => cur.filter((s) => s.id !== id));
      }, SIG_TTL);
    });
    return () => off();
  }, []);

  if (sigs.length === 0) return null;
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute', inset: 0,
        pointerEvents: 'none',
        zIndex: Z.bannerBoss - 4,
        overflow: 'hidden',
      }}
    >
      {sigs.map((s) => <SignatureVisual key={s.id} k={s.key} />)}
    </div>
  );
}

function SignatureVisual({ k }: { k: ComboKey }) {
  // Anchor: above the dice row, below the ComboFlash. Use absolute
  // position with bottom/top mid for natural placement.
  const base: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: 'calc(var(--hud-top-h, 134px) + 280px)',
    transform: 'translateX(-50%)',
  };
  switch (k) {
    case 'chance':
      // single soft pulse
      return (
        <div style={{
          ...base,
          width: 80, height: 80, borderRadius: '50%',
          border: '1px solid rgba(187, 168, 255, 0.5)',
          boxShadow: '0 0 16px rgba(187, 168, 255, 0.3)',
          animation: 'combo-sig-chance 500ms cubic-bezier(0.3, 0, 0.6, 1) forwards',
          opacity: 0,
        }} />
      );
    case 'one_pair':
    case 'two_pair': {
      const dyads = k === 'two_pair' ? 2 : 1;
      return (
        <div style={{ ...base, display: 'flex', gap: 14 }}>
          {Array.from({ length: dyads }).map((_, i) => (
            <div key={i} style={{
              width: 60, height: 60, borderRadius: '50%',
              border: '2px solid #7be3ff',
              boxShadow: '0 0 18px rgba(123, 227, 255, 0.6)',
              opacity: 0,
              animation: `combo-sig-pair 600ms cubic-bezier(0.2, 0.7, 0.3, 1) ${i * 90}ms forwards`,
            }} />
          ))}
        </div>
      );
    }
    case 'three_kind':
      // triplet drumroll — three rings firing in fast succession
      return (
        <div style={{ ...base, display: 'flex', gap: 16 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              width: 56, height: 56, borderRadius: '50%',
              border: '2px solid #ff9d4a',
              boxShadow: '0 0 18px rgba(255, 157, 74, 0.6)',
              opacity: 0,
              animation: `combo-sig-triplet 520ms cubic-bezier(0.3, 1.6, 0.4, 1) ${i * 80}ms forwards`,
            }} />
          ))}
        </div>
      );
    case 'sm_straight':
    case 'lg_straight': {
      const cnt = k === 'lg_straight' ? 5 : 4;
      return (
        <div style={{ ...base, display: 'flex', gap: 12 }}>
          {Array.from({ length: cnt }).map((_, i) => (
            <div key={i} style={{
              width: 6, height: 50,
              background: 'linear-gradient(180deg, #cc88ff, #7be3ff)',
              boxShadow: '0 0 14px rgba(204, 136, 255, 0.7)',
              opacity: 0,
              borderRadius: 3,
              animation: `combo-sig-cascade 700ms cubic-bezier(0.3, 0, 0.4, 1) ${i * 70}ms forwards`,
            }} />
          ))}
        </div>
      );
    }
    case 'full_house':
      // layered chord — 2 outer rings + 3 inner
      return (
        <div style={{ ...base, width: 200, height: 80, position: 'absolute' }}>
          {[0, 1].map((i) => (
            <div key={`o-${i}`} style={{
              position: 'absolute',
              left: i === 0 ? 0 : 'auto',
              right: i === 1 ? 0 : 'auto',
              top: 20, width: 40, height: 40, borderRadius: '50%',
              border: '2px solid #f5c451',
              boxShadow: '0 0 18px rgba(245, 196, 81, 0.6)',
              opacity: 0,
              animation: `combo-sig-pair 600ms cubic-bezier(0.2, 0.7, 0.3, 1) ${i * 60}ms forwards`,
            }} />
          ))}
          {[0, 1, 2].map((i) => (
            <div key={`i-${i}`} style={{
              position: 'absolute',
              left: '50%',
              top: 40,
              transform: `translate(-50%, -50%) translateX(${(i - 1) * 22}px)`,
              width: 28, height: 28, borderRadius: '50%',
              border: '2px solid #ff9d4a',
              boxShadow: '0 0 14px rgba(255, 157, 74, 0.55)',
              opacity: 0,
              animation: `combo-sig-triplet 520ms cubic-bezier(0.3, 1.6, 0.4, 1) ${120 + i * 60}ms forwards`,
            }} />
          ))}
        </div>
      );
    case 'four_kind':
      // thunder strike — bright vertical flash + screen-wide pulse
      return (
        <>
          <div style={{
            ...base,
            width: 12, height: 200,
            background: 'linear-gradient(180deg, #f3f0ff 0%, #f5c451 50%, transparent 100%)',
            boxShadow: '0 0 40px rgba(245, 196, 81, 0.9), 0 0 80px rgba(245, 196, 81, 0.5)',
            opacity: 0,
            animation: 'combo-sig-thunder 580ms cubic-bezier(0.1, 0.9, 0.3, 1) forwards',
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(circle at 50% 55%, rgba(245, 196, 81, 0.25) 0%, transparent 50%)',
            opacity: 0,
            mixBlendMode: 'screen',
            animation: 'combo-sig-thunder-flash 280ms ease-out forwards',
          }} />
        </>
      );
    case 'five_kind':
      // galactic burst — full screen wash + spiral motes
      return (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 50% 50%, rgba(255, 82, 200, 0.5) 0%, rgba(245, 196, 81, 0.3) 30%, rgba(123, 227, 255, 0.15) 60%, transparent 90%)',
          opacity: 0,
          mixBlendMode: 'screen',
          animation: 'combo-sig-galactic 1200ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        }} />
      );
    default:
      return null;
  }
}

function playComboAudio(k: ComboKey): void {
  switch (k) {
    case 'chance':
      sfxPlay('comboChime', { freq: 440, gain: 0.35 });
      break;
    case 'one_pair':
      sfxPlay('comboChime', { freq: 523, gain: 0.5 });
      setTimeout(() => sfxPlay('comboChime', { freq: 659, gain: 0.45 }), 90);
      break;
    case 'two_pair':
      // Two dyads
      sfxPlay('comboChime', { freq: 392, gain: 0.5 });
      sfxPlay('comboChime', { freq: 587, gain: 0.45 });
      setTimeout(() => {
        sfxPlay('comboChime', { freq: 494, gain: 0.5 });
        sfxPlay('comboChime', { freq: 740, gain: 0.45 });
      }, 100);
      break;
    case 'three_kind':
      // Triplet roll — three rapid hits same pitch
      [0, 70, 140].forEach((delay) => {
        setTimeout(() => sfxPlay('comboChime', { freq: 587, gain: 0.55 }), delay);
      });
      break;
    case 'sm_straight':
      [523, 587, 659, 740].forEach((freq, i) => {
        setTimeout(() => sfxPlay('comboChime', { freq, gain: 0.5 }), i * 70);
      });
      break;
    case 'lg_straight':
      [523, 587, 659, 740, 880].forEach((freq, i) => {
        setTimeout(() => sfxPlay('comboChime', { freq, gain: 0.55 }), i * 65);
      });
      break;
    case 'full_house':
      // Layered chord — major triad held
      sfxPlay('comboChime', { freq: 392, gain: 0.5 });
      sfxPlay('comboChime', { freq: 494, gain: 0.45 });
      sfxPlay('comboChime', { freq: 587, gain: 0.4 });
      setTimeout(() => {
        sfxPlay('comboChime', { freq: 784, gain: 0.4 });
      }, 150);
      break;
    case 'four_kind':
      // Thunder: low slam + bright bell
      sfxPlay('multSlam', { freq: 165, gain: 0.85 });
      sfxPlay('comboChime', { freq: 1175, gain: 0.65 });
      break;
    case 'five_kind':
      // Galactic bell choir
      sfxPlay('castBoom', { gain: 0.7 });
      [880, 1175, 1568].forEach((freq, i) => {
        setTimeout(() => sfxPlay('comboChime', { freq, gain: 0.6 }), i * 80);
      });
      break;
  }
}
