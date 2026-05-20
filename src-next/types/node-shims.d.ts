// Minimal node:* module shims for the handful of test/tooling files
// that touch the filesystem (playtest visual test + tools/sim CSV
// writer + the sim batch runner). Keeps Node types from leaking into
// browser code paths (which would break setTimeout's return-type
// expectations and similar DOM/Node ambiguities).

declare module 'node:fs' {
  export function readFileSync(path: string, encoding?: string): string;
  export function readFileSync(path: string, options?: { encoding?: string; flag?: string }): string;
  export function writeFileSync(path: string, data: string | Uint8Array): void;
  export function mkdirSync(path: string, options?: { recursive?: boolean; mode?: number }): void;
  export function existsSync(path: string): boolean;
}

declare module 'node:path' {
  export function join(...parts: string[]): string;
  export function dirname(p: string): string;
  export function resolve(...parts: string[]): string;
  export function basename(p: string, ext?: string): string;
}

declare module 'node:url' {
  export function fileURLToPath(url: URL | string): string;
}

// `process` is also a Node global. Declared here for the rare tooling
// scripts that need argv/env/exit.
declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
  exit(code?: number): void;
};
