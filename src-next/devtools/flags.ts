export type DevFlags = {
  pixiFx: boolean;
  three: boolean;
  audio: boolean;
  nebula: boolean;
  fixedSeed: number | null;
  devConsoleTab: string | null;
};

const KEY = 'ff_next_devflags';

const defaults: DevFlags = {
  pixiFx: true,
  three: true,
  audio: true,
  nebula: true,
  fixedSeed: null,
  devConsoleTab: null,
};

function load(): DevFlags {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
}

let flags = load();

export const getFlags = (): DevFlags => flags;
export const setFlag  = <K extends keyof DevFlags>(k: K, v: DevFlags[K]): void => {
  flags = { ...flags, [k]: v };
  try { localStorage.setItem(KEY, JSON.stringify(flags)); } catch { /* ignore */ }
};
