export function setIn<T>(obj: T, path: string, value: unknown): T {
  if (path === '') throw new Error('setIn: empty path');
  const segments = path.split('.');
  return walk(obj, segments, value, path) as T;
}

function walk(node: unknown, segments: string[], value: unknown, fullPath: string): unknown {
  const [head, ...rest] = segments;
  const isLast = rest.length === 0;

  if (Array.isArray(node)) {
    const idx = Number(head);
    if (!Number.isInteger(idx) || idx < 0 || idx >= node.length) {
      throw new Error(`setIn: path "${fullPath}" — index "${head}" out of bounds`);
    }
    const next = node.slice();
    next[idx] = isLast ? value : walk(node[idx], rest, value, fullPath);
    return next;
  }

  if (node !== null && typeof node === 'object') {
    const o = node as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(o, head)) {
      throw new Error(`setIn: path "${fullPath}" — key "${head}" missing`);
    }
    return { ...o, [head]: isLast ? value : walk(o[head], rest, value, fullPath) };
  }

  throw new Error(`setIn: path "${fullPath}" — cannot descend into non-object at "${head}"`);
}
