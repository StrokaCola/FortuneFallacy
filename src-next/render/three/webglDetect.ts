let _cached: boolean | null = null;

export function hasWebGL(): boolean {
  if (_cached !== null) return _cached;
  try {
    const c = document.createElement('canvas');
    const ctx = c.getContext('webgl2') || c.getContext('webgl');
    _cached = !!ctx;
  } catch {
    _cached = false;
  }
  return _cached;
}

export function _resetWebGLCache(): void {
  _cached = null;
}
