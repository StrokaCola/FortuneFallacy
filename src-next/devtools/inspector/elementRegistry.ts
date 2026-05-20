// Registry of inspectable DOM nodes. Components opt in via the
// `useInspectable` hook which records their ref + metadata. Auto-discovery
// via fiberWalk handles the rest.
//
// Each entry is keyed by a string id. Two id kinds exist:
//   - explicit ids, supplied by `useInspectable(id, ...)`
//   - auto ids derived from React fiber chain, of the form "auto:Foo/Bar"
//
// The element registry is intentionally simple — a Map plus listeners.
// Overlay code (BoundsOverlay) reads `getRegistry()` on a RAF tick rather
// than subscribing, because rect math is the heavy part anyway.

import { useEffect, useRef } from 'react';
import { describeElement } from './fiberWalk';
import { getInspectorState } from './store';

export type InspectableMeta = {
  label: string;
  zLayer?: string;
  fileHint?: string;
};

export type Inspectable = {
  id: string;
  el: HTMLElement;
  meta: InspectableMeta;
  source: 'explicit' | 'auto';
};

const explicit = new Map<string, Inspectable>();
const auto = new Map<string, Inspectable>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) {
    try { l(); } catch (e) { console.error('[inspector] registry listener threw', e); }
  }
}

export function subscribeRegistry(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function listInspectables(): Inspectable[] {
  return [...explicit.values(), ...auto.values()];
}

export function getInspectableById(id: string): Inspectable | undefined {
  return explicit.get(id) ?? auto.get(id);
}

const INSPECT_ATTR = 'data-ff-inspect';

// React hook: register a DOM ref with the inspector. Tag-free callers
// just use the returned ref directly; explicit-id callers also get the
// `data-ff-inspect` attribute set so the picker can short-circuit DOM
// walks via element.closest().
export function useInspectable<T extends HTMLElement = HTMLElement>(
  id: string,
  meta: InspectableMeta,
): React.RefObject<T> {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const el = ref.current;
    if (!el) return;
    el.setAttribute(INSPECT_ATTR, id);
    explicit.set(id, { id, el, meta, source: 'explicit' });
    notify();
    return () => {
      const cur = explicit.get(id);
      if (cur && cur.el === el) {
        explicit.delete(id);
        el.removeAttribute(INSPECT_ATTR);
        notify();
      }
    };
  }, [id, meta.label, meta.zLayer, meta.fileHint]);
  return ref;
}

// Given a raw DOM target (e.g. from a click), resolve the inspectable id.
// Prefers explicit tag via closest('[data-ff-inspect]'), falls back to
// fiber-derived auto id, registering the auto entry lazily.
export function resolveTarget(target: EventTarget | null): Inspectable | null {
  if (!(target instanceof Element)) return null;
  const tagged = target.closest(`[${INSPECT_ATTR}]`);
  if (tagged instanceof HTMLElement) {
    const id = tagged.getAttribute(INSPECT_ATTR);
    if (id) {
      const found = explicit.get(id);
      if (found) return found;
      // Tag exists but no explicit registration (e.g. hot-reload race) —
      // synthesize an entry so the picker still works.
      const meta: InspectableMeta = { label: id };
      const synth: Inspectable = { id, el: tagged, meta, source: 'auto' };
      auto.set(id, synth);
      notify();
      return synth;
    }
  }
  const info = describeElement(target);
  if (!info) return null;
  // Ascend to the nearest block-level container so the highlight rect
  // is meaningful. If target itself is a leaf text-y span, use its
  // closest div/section/article instead.
  let host: HTMLElement = target instanceof HTMLElement ? target : (target.parentElement as HTMLElement);
  if (host && !isMeaningful(host)) {
    const up = host.closest('div, section, article, main, header, footer, button');
    if (up instanceof HTMLElement) host = up;
  }
  const existing = auto.get(info.id);
  if (existing && existing.el === host) return existing;
  const entry: Inspectable = {
    id: info.id,
    el: host,
    meta: { label: info.label },
    source: 'auto',
  };
  auto.set(info.id, entry);
  notify();
  return entry;
}

function isMeaningful(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 4 && r.height > 4;
}

export function clearAutoRegistry(): void {
  if (auto.size === 0) return;
  auto.clear();
  notify();
}

// Convenience for the picker UI to know what's currently selected.
export function getCurrentSelected(): Inspectable | null {
  const id = getInspectorState().selectedId;
  if (!id) return null;
  return getInspectableById(id) ?? null;
}
