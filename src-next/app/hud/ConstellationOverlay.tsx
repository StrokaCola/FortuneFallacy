import { useEffect, useState } from 'react';
import { bus } from '../../events/bus';
import { ConstellationLines } from '../visual/ConstellationLines';

type Pt = { x: number; y: number };
type ConstellationDraw = { id: number; points: Pt[] };

let nextId = 1;

function scoringIndices(faces: number[], comboId: string): number[] {
  const counts: Record<number, number[]> = {};
  faces.forEach((f, i) => {
    (counts[f] = counts[f] ?? []).push(i);
  });
  if (
    comboId === 'five_kind' ||
    comboId === 'four_kind' ||
    comboId === 'three_kind' ||
    comboId === 'one_pair'
  ) {
    return Object.values(counts).sort((a, b) => b.length - a.length)[0] ?? [];
  }
  if (comboId === 'two_pair') {
    return Object.values(counts).filter((g) => g.length === 2).flat();
  }
  if (comboId === 'full_house') {
    return Object.values(counts).filter((g) => g.length >= 2).flat();
  }
  if (comboId === 'lg_straight' || comboId === 'sm_straight') {
    const sorted = faces.map((f, i) => ({ f, i })).sort((a, b) => a.f - b.f);
    let best: typeof sorted = [];
    let cur: typeof sorted = sorted[0] ? [sorted[0]] : [];
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i]!;
      const b = sorted[i - 1]!;
      if (a.f === b.f) continue;
      if (a.f === b.f + 1) cur.push(a);
      else {
        if (cur.length > best.length) best = cur;
        cur = [a];
      }
    }
    if (cur.length > best.length) best = cur;
    return best.map((x) => x.i);
  }
  return [];
}

export function ConstellationOverlay() {
  const [draws, setDraws] = useState<ConstellationDraw[]>([]);

  useEffect(() => {
    let lastFaces: number[] = [];
    const offEnd = bus.on('onRollEnd', ({ faces }) => {
      lastFaces = faces;
    });
    const offCombo = bus.on('onComboDetected', ({ combo }) => {
      const idxs = scoringIndices(lastFaces, combo);
      if (idxs.length < 2) return;
      // Dice render inside the curved tray base — design tray center at stage y=600
      // (stage 1280×800 centered on viewport).
      const stageTop = (window.innerHeight - 800) / 2;
      const trayY = stageTop + 600;
      const startX = window.innerWidth / 2 - (lastFaces.length - 1) * 70;
      const points = idxs.map((i) => ({ x: startX + i * 140, y: trayY }));
      const id = nextId++;
      setDraws((d) => [...d, { id, points }]);
      setTimeout(() => setDraws((d) => d.filter((x) => x.id !== id)), 1200);
    });
    return () => { offEnd(); offCombo(); };
  }, []);

  return (
    <>
      {draws.map((d) => (
        <div key={d.id} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 7 }}>
          <ConstellationLines points={d.points} color="#7be3ff" />
        </div>
      ))}
    </>
  );
}
