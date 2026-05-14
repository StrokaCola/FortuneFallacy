import * as sfxModule from '../../audio/sfx';

const SHOCKWAVE_DURATION_MS = 400;

function findJuicyButton(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const btn = target.closest('.btn');
  if (!(btn instanceof HTMLElement)) return null;
  if ((btn as HTMLButtonElement).disabled) return null;
  return btn;
}

function isPrimary(btn: HTMLElement): boolean {
  return btn.classList.contains('btn-primary');
}

function reducedMotion(): boolean {
  return document.documentElement.classList.contains('reduce-motion');
}

function spawnShockwave(btn: HTMLElement): void {
  const rect = btn.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const wave = document.createElement('div');
  wave.className = 'btn-shockwave';
  // Read accent from button's computed border-color (fallback cyan).
  const computed = window.getComputedStyle(btn).borderColor;
  const accent = computed && computed !== 'rgba(0, 0, 0, 0)' ? computed : '#7be3ff';
  wave.style.setProperty('--wave-accent', accent);
  wave.style.left = `${cx}px`;
  wave.style.top = `${cy}px`;
  document.body.appendChild(wave);
  const cleanup = () => {
    wave.removeEventListener('animationend', cleanup);
    if (wave.parentNode) wave.parentNode.removeChild(wave);
  };
  wave.addEventListener('animationend', cleanup);
  // Fallback removal in case animationend doesn't fire.
  setTimeout(cleanup, SHOCKWAVE_DURATION_MS + 200);
}

// Vibration on tap is a no-op on devices without a vibration motor +
// most desktop browsers — the API just returns false. We gate it on
// pointerType === 'touch' so a mouse-on-laptop doesn't try to vibrate.
function tapHaptic(): void {
  const vib = (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate;
  if (typeof vib === 'function') {
    try { vib.call(navigator, 10); } catch { /* ignore */ }
  }
}

export function installButtonJuice(): () => void {
  // Switched from mouse* events to pointer* so touch users get the
  // same juice (shockwave + click sfx + 10ms haptic) as desktop. Mouse
  // mouseover stays — hover sound is mouse-only by design.
  //
  // Coverage: every .btn gets click sfx + 10ms touch-haptic on pointerdown
  // for instant feedback. Only .btn-primary additionally gets the celebratory
  // shockwave on pointerup and the hover cue. The Roll button suppresses the
  // uiClick because castSwell already plays on its React onClick — layering
  // them muddies the cue.
  const onPointerDown = (ev: PointerEvent): void => {
    const btn = findJuicyButton(ev.target);
    if (!btn) return;
    if (btn.dataset.coach !== 'roll-btn') {
      sfxModule.sfxPlay('uiClick');
    }
    if (ev.pointerType === 'touch') tapHaptic();
  };
  const onPointerUp = (ev: PointerEvent): void => {
    const btn = findJuicyButton(ev.target);
    if (!btn || !isPrimary(btn)) return;
    if (reducedMotion()) return;
    spawnShockwave(btn);
  };
  const onMouseOver = (ev: MouseEvent): void => {
    const btn = findJuicyButton(ev.target);
    if (!btn || !isPrimary(btn)) return;
    sfxModule.sfxPlay('uiHover');
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
