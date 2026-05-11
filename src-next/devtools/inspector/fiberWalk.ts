// Minimal React-internals walker. Given a DOM node, walk its attached
// fiber up the owner chain to derive a stable id + display name. Used
// when an element wasn't explicitly tagged via useInspectable().
//
// React stores the fiber on the DOM node under a property whose key
// starts with `__reactFiber$<random>`. We pick the first matching key.
//
// `_debugOwner` and the `type` field give us component identity.
// We compose an id from a chain of component names so re-mounts of the
// "same" tree path produce the same id.

type Fiber = {
  type?: unknown;
  return?: Fiber | null;
  _debugOwner?: Fiber | null;
  elementType?: unknown;
  key?: string | number | null;
  stateNode?: unknown;
};

function fiberKey(node: Element): string | undefined {
  for (const k in node) {
    if (k.startsWith('__reactFiber$')) return k;
  }
  return undefined;
}

function componentName(typeRef: unknown): string | null {
  if (!typeRef) return null;
  if (typeof typeRef === 'string') return typeRef;
  if (typeof typeRef === 'function') {
    const fn = typeRef as { displayName?: string; name?: string };
    return fn.displayName || fn.name || null;
  }
  if (typeof typeRef === 'object') {
    const obj = typeRef as { displayName?: string; render?: { displayName?: string; name?: string }; type?: unknown };
    if (obj.displayName) return obj.displayName;
    if (obj.render) return obj.render.displayName || obj.render.name || null;
    if (obj.type) return componentName(obj.type);
  }
  return null;
}

export type FiberInfo = {
  id: string;
  label: string;
};

// Walk up to the nearest fiber whose owner is a user component (not a
// host string like "div"). Build an id of the form "auto:OuterComp/InnerComp".
export function describeElement(node: Element): FiberInfo | null {
  const key = fiberKey(node);
  if (!key) return null;
  const fiber = (node as unknown as Record<string, Fiber | undefined>)[key];
  if (!fiber) return null;

  const chain: string[] = [];
  let cur: Fiber | null | undefined = fiber;
  let safety = 60;
  while (cur && safety-- > 0) {
    const nm = componentName(cur.type);
    if (nm && /^[A-Z]/.test(nm)) {
      // Skip framework wrappers that add noise.
      if (nm !== 'StrictMode' && nm !== 'Fragment') chain.push(nm);
    }
    cur = cur.return ?? null;
  }

  if (chain.length === 0) return null;
  // Keep up to 3 nearest components — enough to disambiguate without
  // making the id thrash when ancestors shuffle.
  const trail = chain.slice(0, 3);
  return {
    id: `auto:${trail.join('/')}`,
    label: trail[0] ?? 'unknown',
  };
}
