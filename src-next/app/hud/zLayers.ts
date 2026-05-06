// Semantic z-index tokens shared across the React HUD. The same values are
// mirrored in styles/index.css `:root` as CSS custom properties so plain CSS
// rules can reference them too. Keep these in sync when adding new layers.
//
// Why a JS object instead of pure CSS vars?
//   React inline styles take a number for zIndex; resolving a CSS var inside
//   inline styles requires `as unknown as number` shims that defeat type
//   checking. A const object keeps zIndex usage type-safe.
export const Z = {
  canvas: 3,
  hud: 4,
  hudTop: 5,
  hudControl: 6,
  fx: 10,
  toast: 12,
  bannerBoss: 30,
  bannerArrival: 40,
  modal: 50,
  modalStrong: 60,
  overlay: 100,
  orientation: 200,
} as const;

export type ZLayer = keyof typeof Z;
