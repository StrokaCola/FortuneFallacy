import * as sfxModule from '../../audio/sfx';

const SHOCKWAVE_DURATION_MS = 400;

type ButtonTier = 'primary' | 'cta' | 'ghost' | 'danger' | 'unknown';

// Wave K — per-tier feedback rules.
// Each row encodes:
//   - the click SFX cue (pointerdown)
//   - the hover SFX cue (mouseover, mouse-only)
//   - the haptic strength on touch
//   - whether pointerup spawns a shockwave + which variant class
//   - the fallback accent the shockwave uses if the button's border-color
//     is transparent
const TIER_RULES: Record<ButtonTier, {
  click: 'uiClick' | 'uiCommit' | null;
  hover: 'uiHover' | 'uiHoverSoft' | null;
  haptic: number;
  shockwave: 'primary' | 'cta' | 'ghost' | 'danger' | null;
  accentFallback: string;
}> = {
  primary: { click: 'uiClick', hover: 'uiHover',     haptic: 10, shockwave: 'primary', accentFallback: '#ff8a5e' },
  cta:     { click: 'uiClick', hover: 'uiHover',     haptic: 10, shockwave: 'cta',     accentFallback: '#f5c451' },
  ghost:   { click: 'uiClick', hover: 'uiHoverSoft', haptic: 6,  shockwave: 'ghost',   accentFallback: '#7be3ff' },
  danger:  { click: 'uiCommit', hover: null,         haptic: 20, shockwave: 'danger',  accentFallback: '#e2334a' },
  unknown: { click: 'uiClick', hover: null,          haptic: 8,  shockwave: null,      accentFallback: '#7be3ff' },
};

function classifyTier(btn: HTMLElement): ButtonTier {
  // Order matters: a button can carry multiple variant classes during
  // a transitional refactor; pick the most specific tier first.
  if (btn.classList.contains('btn-danger'))  return 'danger';
  if (btn.classList.contains('btn-primary')) return 'primary';
  if (btn.classList.contains('btn-cta'))     return 'cta';
  if (btn.classList.contains('btn-ghost'))   return 'ghost';
  return 'unknown';
}

function isAnyBtn(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const btn = target.closest('.btn');
  if (!(btn instanceof HTMLElement)) return null;
  return btn;
}

function isEnabledBtn(target: EventTarget | null): HTMLElement | null {
  const btn = isAnyBtn(target);
  if (!btn) return null;
  if ((btn as HTMLButtonElement).disabled) return null;
  return btn;
}

function reducedMotion(): boolean {
  return document.documentElement.classList.contains('reduce-motion');
}

function spawnShockwave(btn: HTMLElement, variant: 'primary' | 'cta' | 'ghost' | 'danger', accentFallback: string): void {
  const rect = btn.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const wave = document.createElement('div');
  // Tier-specific class lets index.css shape the ring (size, alpha, glow).
  wave.className = `btn-shockwave btn-shockwave-${variant}`;
  // Prefer the button's own border-color so the wave reads as "that button
  // fired" rather than a generic flash. Fall back to the tier's accent.
  const computed = window.getComputedStyle(btn).borderColor;
  const accent = computed && computed !== 'rgba(0, 0, 0, 0)' ? computed : accentFallback;
  wave.style.setProperty('--wave-accent', accent);
  wave.style.left = `${cx}px`;
  wave.style.top = `${cy}px`;
  document.body.appendChild(wave);
  const cleanup = () => {
    wave.removeEventListener('animationend', cleanup);
    if (wave.parentNode) wave.parentNode.removeChild(wave);
  };
  wave.addEventListener('animationend', cleanup);
  // Fallback removal in case animationend doesn't fire (e.g. tab hidden).
  setTimeout(cleanup, SHOCKWAVE_DURATION_MS + 200);
}

// Vibration on tap is a no-op on devices without a vibration motor +
// most desktop browsers — the API just returns false. We gate it on
// pointerType === 'touch' so a mouse-on-laptop doesn't try to vibrate.
function tapHaptic(durationMs: number): void {
  const vib = (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate;
  if (typeof vib === 'function') {
    try { vib.call(navigator, durationMs); } catch { /* ignore */ }
  }
}

// Disabled-press deflection — fires uiDenied + a 220ms shake on the
// button itself so the player knows the press registered but the action
// is blocked. Stripped under reduce-motion (SFX still fires).
function deflectDisabled(btn: HTMLElement): void {
  sfxModule.sfxPlay('uiDenied');
  if (reducedMotion()) return;
  // Restart the shake by clearing + setting the attribute in a frame.
  btn.removeAttribute('data-denied');
  // Force reflow so re-setting the attribute re-runs the animation.
  void btn.offsetWidth;
  btn.setAttribute('data-denied', 'true');
  window.setTimeout(() => {
    if (btn.getAttribute('data-denied') === 'true') {
      btn.removeAttribute('data-denied');
    }
  }, 260);
}

export function installButtonJuice(): () => void {
  // Pointer events so touch + mouse share the same juice (shockwave +
  // click sfx + per-tier haptic). Hover stays mouseover-only since the
  // shimmer is mouse-only by design.
  //
  // Coverage:
  //   .btn-primary   click + hover + 10ms haptic + primary shockwave
  //   .btn-cta       click + hover + 10ms haptic + gold shockwave
  //   .btn-ghost     click + soft-hover + 6ms haptic + cyan pulse
  //   .btn-danger    commit-click + 20ms haptic + crimson shockwave (no hover)
  //   disabled       muted uiDenied + shake (no shockwave)
  //
  // The Roll button suppresses the press uiClick because castSwell already
  // plays on its React onClick — layering them muddies the cue.
  const onPointerDown = (ev: PointerEvent): void => {
    const anyBtn = isAnyBtn(ev.target);
    if (!anyBtn) return;
    // Disabled buttons get the deflection but not the tier juice.
    if ((anyBtn as HTMLButtonElement).disabled) {
      deflectDisabled(anyBtn);
      return;
    }
    const tier = classifyTier(anyBtn);
    const rule = TIER_RULES[tier];
    if (anyBtn.dataset.coach !== 'roll-btn' && rule.click) {
      sfxModule.sfxPlay(rule.click);
    }
    if (ev.pointerType === 'touch') tapHaptic(rule.haptic);
  };
  const onPointerUp = (ev: PointerEvent): void => {
    const btn = isEnabledBtn(ev.target);
    if (!btn) return;
    if (reducedMotion()) return;
    const tier = classifyTier(btn);
    const rule = TIER_RULES[tier];
    if (!rule.shockwave) return;
    spawnShockwave(btn, rule.shockwave, rule.accentFallback);
  };
  const onMouseOver = (ev: MouseEvent): void => {
    const btn = isEnabledBtn(ev.target);
    if (!btn) return;
    const tier = classifyTier(btn);
    const rule = TIER_RULES[tier];
    if (rule.hover) sfxModule.sfxPlay(rule.hover);
  };
  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('mouseover', onMouseOver);
  return () => {
    document.removeEventListener('pointerdown', onPointerDown);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('mouseover', onMouseOver);
  };
}
