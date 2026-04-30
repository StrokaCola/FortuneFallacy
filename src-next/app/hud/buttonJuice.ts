import * as sfxModule from '../../audio/sfx';

const SHOCKWAVE_DURATION_MS = 400;

function isPrimaryButton(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const btn = target.closest('.btn-primary');
  return btn instanceof HTMLElement ? btn : null;
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

export function installButtonJuice(): () => void {
  const onMouseDown = (ev: MouseEvent): void => {
    if (!isPrimaryButton(ev.target)) return;
    sfxModule.sfxPlay('uiClick');
  };
  const onMouseUp = (ev: MouseEvent): void => {
    const btn = isPrimaryButton(ev.target);
    if (!btn) return;
    if (reducedMotion()) return;
    spawnShockwave(btn);
  };
  const onMouseOver = (ev: MouseEvent): void => {
    if (!isPrimaryButton(ev.target)) return;
    sfxModule.sfxPlay('uiHover');
  };
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('mouseover', onMouseOver);
  return () => {
    document.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('mouseover', onMouseOver);
  };
}
