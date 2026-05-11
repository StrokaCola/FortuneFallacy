// Global picker handler. When `pickerArmed` is true on the inspector
// store, hovering shows a candidate outline and the next click selects.
// Implemented as a pointermove/pointerdown capture handler installed
// once at the document level; cheap to leave attached.

import { resolveTarget } from './elementRegistry';
import { getInspectorState, setInspector } from './store';

let installed = false;

function onPointerMove(e: PointerEvent): void {
  const s = getInspectorState();
  if (!s.pickerArmed) {
    if (s.hoverId !== null) setInspector({ hoverId: null });
    return;
  }
  const ins = resolveTarget(e.target);
  const nextId = ins?.id ?? null;
  if (nextId !== s.hoverId) setInspector({ hoverId: nextId });
}

function onPointerDown(e: PointerEvent): void {
  const s = getInspectorState();
  if (!s.pickerArmed) return;
  // Ignore clicks inside the dev console itself.
  if (e.target instanceof Element && e.target.closest('[data-ff-devconsole]')) return;
  const ins = resolveTarget(e.target);
  if (!ins) return;
  e.preventDefault();
  e.stopPropagation();
  setInspector({ pickerArmed: false, selectedId: ins.id, hoverId: null });
}

function onKey(e: KeyboardEvent): void {
  const s = getInspectorState();
  if (!s.pickerArmed) return;
  if (e.key === 'Escape') {
    setInspector({ pickerArmed: false, hoverId: null });
  }
}

export function installPicker(): void {
  if (installed) return;
  installed = true;
  document.addEventListener('pointermove', onPointerMove, true);
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('keydown', onKey, true);
}
