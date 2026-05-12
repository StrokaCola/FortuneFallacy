import { useEffect, useRef } from 'react';
import { Z } from '../../app/hud/zLayers';
import { getInspectableById } from './elementRegistry';
import {
  getInspectorState,
  setInspector,
  setOverride,
  subscribeInspector,
  DEFAULT_OVERRIDE,
} from './store';

type Box = { x: number; y: number; w: number; h: number; label: string; zLayer?: string } | null;

// Draws hover + selected outlines on a RAF loop. Mounted once near the
// DevConsole. Also handles drag-to-move when moveArmed is true.
export function BoundsOverlay() {
  const hoverRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);
  const hoverLabelRef = useRef<HTMLDivElement>(null);
  const selectedLabelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; baseDx: number; baseDy: number } | null>(null);

  useEffect(() => {
    let frame = 0;
    function tick() {
      frame = requestAnimationFrame(tick);
      const s = getInspectorState();
      drawBox(hoverRef.current, hoverLabelRef.current, boxFor(s.hoverId), 'hover');
      drawBox(selectedRef.current, selectedLabelRef.current, boxFor(s.selectedId), 'selected');
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Re-render when inspector state changes (cheap; just toggles visibility).
  useEffect(() => subscribeInspector(() => { /* RAF reads live state */ }), []);

  function onPointerDown(e: React.PointerEvent) {
    const s = getInspectorState();
    if (!s.moveArmed || !s.selectedId) return;
    const id = s.selectedId;
    const base = s.overrides[id] ?? DEFAULT_OVERRIDE;
    dragRef.current = { id, startX: e.clientX, startY: e.clientY, baseDx: base.dx, baseDy: base.dy };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    setOverride(d.id, { dx: d.baseDx + (e.clientX - d.startX), dy: d.baseDy + (e.clientY - d.startY) });
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!dragRef.current) return;
    dragRef.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }

  const selectedDraggable = getInspectorState().moveArmed && !!getInspectorState().selectedId;

  return (
    <div
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: Z.overlay }}
      aria-hidden
    >
      <div
        ref={hoverRef}
        style={{
          position: 'fixed',
          left: 0, top: 0, width: 0, height: 0,
          outline: '1px dashed #7be3ff',
          background: 'rgba(123, 227, 255, 0.06)',
          display: 'none',
          pointerEvents: 'none',
        }}
      >
        <div ref={hoverLabelRef} style={labelStyle('#7be3ff')} />
      </div>
      <div
        ref={selectedRef}
        onPointerDown={selectedDraggable ? onPointerDown : undefined}
        onPointerMove={selectedDraggable ? onPointerMove : undefined}
        onPointerUp={selectedDraggable ? onPointerUp : undefined}
        onClick={() => setInspector({ selectedId: null })}
        style={{
          position: 'fixed',
          left: 0, top: 0, width: 0, height: 0,
          outline: '2px solid #f5c451',
          background: 'rgba(245, 196, 81, 0.08)',
          display: 'none',
          pointerEvents: selectedDraggable ? 'auto' : 'none',
          cursor: selectedDraggable ? 'move' : 'default',
        }}
      >
        <div ref={selectedLabelRef} style={labelStyle('#f5c451')} />
      </div>
    </div>
  );
}

function labelStyle(color: string): React.CSSProperties {
  return {
    position: 'absolute',
    left: 0,
    top: -18,
    padding: '1px 4px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 10,
    color: '#0c0a16',
    background: color,
    borderRadius: 2,
    whiteSpace: 'nowrap',
  };
}

function boxFor(id: string | null): Box {
  if (!id) return null;
  const ins = getInspectableById(id);
  if (!ins) return null;
  const r = ins.el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height, label: ins.meta.label, zLayer: ins.meta.zLayer };
}

function drawBox(
  box: HTMLDivElement | null,
  labelEl: HTMLDivElement | null,
  data: Box,
  kind: 'hover' | 'selected',
): void {
  if (!box) return;
  if (!data) {
    if (box.style.display !== 'none') box.style.display = 'none';
    return;
  }
  if (box.style.display !== 'block') box.style.display = 'block';
  box.style.left = `${data.x}px`;
  box.style.top = `${data.y}px`;
  box.style.width = `${data.w}px`;
  box.style.height = `${data.h}px`;
  if (labelEl) {
    const z = data.zLayer ? ` · z:${data.zLayer}` : '';
    labelEl.textContent = `${kind === 'selected' ? '⦿' : '•'} ${data.label}${z}`;
  }
}
