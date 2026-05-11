/**
 * Extract the underlying catalyst id from the various id forms emitted by
 * the upgrades phase (`core/phases/upgrades.ts`). Used by HUD components
 * that need to attribute a fire event back to its owning catalyst card —
 * regardless of whether the fire came from the catalyst itself, its
 * edition stamp, or a catalyst-driven mod re-fire.
 *
 *   'stratifier'              → 'stratifier'
 *   'gilding_press@2'         → 'gilding_press'  (catalyst@dieIdx)
 *   'edition:foil@stratifier' → 'stratifier'     (edition stamp on catalyst)
 *   'mod:loaded@3'            → null             (mod fire, not a catalyst)
 *   'resonance:symphony'      → null             (resonance — see resonanceIdFromEvent)
 *   ''                        → null
 */
export function catalystIdFromEvent(eventId: string): string | null {
  if (!eventId) return null;
  if (eventId.startsWith('mod:')) return null;
  if (eventId.startsWith('resonance:')) return null;
  // 2026-05-11 easter eggs — synthetic events use the 'easter_egg:' prefix.
  // They don't attribute to any catalyst card. The discoveryBridge picks
  // them up separately.
  if (eventId.startsWith('easter_egg:')) return null;
  if (eventId.startsWith('edition:')) {
    const at = eventId.indexOf('@');
    return at > 0 ? eventId.slice(at + 1) : null;
  }
  const at = eventId.indexOf('@');
  return at > 0 ? eventId.slice(0, at) : eventId;
}

/**
 * Extract the resonance pair id from a fire event. Resonance fires use
 * the form `resonance:<pairId>` so HUD listeners can pulse both halves
 * of the pair and the postmortem can attribute contribution to both
 * catalysts.
 *
 *   'resonance:symphony' → 'symphony'
 *   'stratifier'         → null
 *   'edition:foil@x'     → null
 */
export function resonanceIdFromEvent(eventId: string): string | null {
  if (!eventId) return null;
  if (!eventId.startsWith('resonance:')) return null;
  return eventId.slice('resonance:'.length);
}
