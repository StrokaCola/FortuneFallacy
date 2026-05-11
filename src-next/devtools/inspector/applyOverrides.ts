// Applies inspector overrides to registered elements via CSS individual
// transform properties (translate/scale/rotate), which compose with any
// existing `transform` set inline by the component. Survives re-renders
// without touching React props.
//
// Strategy:
//   - On each registry change or override change, walk current inspectables
//     and either set the three custom properties + add `ff-inspectable`,
//     or clear them if no override exists.
//   - The class lives in styles/index.css and reads the three vars.

import { listInspectables, subscribeRegistry } from './elementRegistry';
import { getInspectorState, subscribeInspector, type InspectorOverride } from './store';

const APPLIED_CLASS = 'ff-inspectable';

function fmt(n: number, prec: number): number {
  const m = Math.pow(10, prec);
  return Math.round(n * m) / m;
}

function translateOf(o: InspectorOverride): string {
  return `${fmt(o.dx, 2)}px ${fmt(o.dy, 2)}px`;
}
function scaleOf(o: InspectorOverride): string {
  return String(fmt(o.scale, 3));
}
function rotateOf(o: InspectorOverride): string {
  return `${fmt(o.rotate, 2)}deg`;
}
function isIdentity(o: InspectorOverride): boolean {
  return o.dx === 0 && o.dy === 0 && o.scale === 1 && o.rotate === 0;
}

function apply(): void {
  const { overrides } = getInspectorState();
  for (const ins of listInspectables()) {
    const o = overrides[ins.id];
    const el = ins.el;
    if (!o || isIdentity(o)) {
      el.style.removeProperty('--ff-inspect-translate');
      el.style.removeProperty('--ff-inspect-scale');
      el.style.removeProperty('--ff-inspect-rotate');
      el.classList.remove(APPLIED_CLASS);
      continue;
    }
    el.style.setProperty('--ff-inspect-translate', translateOf(o));
    el.style.setProperty('--ff-inspect-scale', scaleOf(o));
    el.style.setProperty('--ff-inspect-rotate', rotateOf(o));
    el.classList.add(APPLIED_CLASS);
  }
}

let installed = false;
export function installOverrideApplier(): void {
  if (installed) return;
  installed = true;
  subscribeRegistry(apply);
  subscribeInspector(apply);
  apply();
}

export function transformSnippetFor(id: string): string | null {
  const o = getInspectorState().overrides[id];
  if (!o || isIdentity(o)) return null;
  const parts: string[] = [];
  if (o.dx !== 0 || o.dy !== 0) parts.push(`translate(${fmt(o.dx, 2)}px, ${fmt(o.dy, 2)}px)`);
  if (o.scale !== 1) parts.push(`scale(${fmt(o.scale, 3)})`);
  if (o.rotate !== 0) parts.push(`rotate(${fmt(o.rotate, 2)}deg)`);
  return parts.join(' ');
}
