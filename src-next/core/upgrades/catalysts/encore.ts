// Encore is implemented inline in `phases/upgrades.ts::applyEncore` — it has
// to re-run the per-die mod loop AFTER applyModScoring has finished, which
// doesn't fit the standard register({...}) shape.
//
// This file exists so the catalyst can still be `import`-ed from the
// registry index (and so a developer searching for `encore` finds the link).
//
// Owned-state check happens inside applyEncore itself; nothing to register.
export {};
