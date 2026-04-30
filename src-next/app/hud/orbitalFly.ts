export type OrbitalOpts = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  durationMs?: number;
};

export type OrbitalPosition = {
  x: number;
  y: number;
  scale: number;
  opacity: number;
};

const DEFAULT_DURATION_MS = 1100;
const ORBIT_RADIUS = 30;
const ARC_APEX_HEIGHT = 80;

const STAGE_ARC_END = 0.4;
const STAGE_ORBIT_END = 0.75;

export function computeOrbitalPosition(opts: OrbitalOpts, t: number): OrbitalPosition {
  const tt = Math.max(0, Math.min(1, t));
  const { startX, startY, endX, endY } = opts;

  if (tt <= STAGE_ARC_END) {
    const apexX = endX;
    const apexY = endY - ARC_APEX_HEIGHT;
    const u = tt / STAGE_ARC_END;
    const ctrlX = (startX + apexX) / 2;
    const ctrlY = Math.min(startY, apexY) - 60;
    const x = (1 - u) * (1 - u) * startX + 2 * (1 - u) * u * ctrlX + u * u * apexX;
    const y = (1 - u) * (1 - u) * startY + 2 * (1 - u) * u * ctrlY + u * u * apexY;
    return { x, y, scale: 1, opacity: 1 };
  }

  if (tt <= STAGE_ORBIT_END) {
    const u = (tt - STAGE_ARC_END) / (STAGE_ORBIT_END - STAGE_ARC_END);
    const angle = -Math.PI / 2 + u * Math.PI * 2;
    const x = endX + ORBIT_RADIUS * Math.cos(angle);
    const y = endY + ORBIT_RADIUS * Math.sin(angle);
    return { x, y, scale: 1, opacity: 1 };
  }

  // Dock stage
  const u = (tt - STAGE_ORBIT_END) / (1 - STAGE_ORBIT_END);
  const radius = ORBIT_RADIUS * (1 - u);
  const angle = -Math.PI / 2;
  const x = endX + radius * Math.cos(angle);
  const y = endY + radius * Math.sin(angle);
  const scale = 1 - u * 0.5;
  const opacity = 1 - u;
  return { x, y, scale, opacity };
}

export function animateOrbital(
  el: HTMLElement,
  opts: OrbitalOpts,
): { dispose: () => void } {
  const reduced = document.documentElement.classList.contains('reduce-motion');
  const duration = opts.durationMs ?? DEFAULT_DURATION_MS;
  const t0 = performance.now();
  let raf: number | null = null;
  let disposed = false;

  if (reduced) {
    el.style.transform = `translate(${opts.endX}px, ${opts.endY}px) scale(0.6)`;
    el.style.opacity = '0';
    el.style.transition = 'opacity 100ms';
    return { dispose: () => { /* nothing to cancel */ } };
  }

  const tick = () => {
    if (disposed) return;
    const dt = performance.now() - t0;
    const t = dt / duration;
    if (t >= 1) {
      const p = computeOrbitalPosition(opts, 1);
      el.style.transform = `translate(${p.x}px, ${p.y}px) scale(${p.scale})`;
      el.style.opacity = `${p.opacity}`;
      return;
    }
    const p = computeOrbitalPosition(opts, t);
    el.style.transform = `translate(${p.x}px, ${p.y}px) scale(${p.scale})`;
    el.style.opacity = `${p.opacity}`;
    raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);

  return {
    dispose: () => {
      disposed = true;
      if (raf != null) cancelAnimationFrame(raf);
    },
  };
}
