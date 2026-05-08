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
 *   ''                        → null
 */
export function catalystIdFromEvent(eventId: string): string | null {
  if (!eventId) return null;
  if (eventId.startsWith('mod:')) return null;
  if (eventId.startsWith('edition:')) {
    const at = eventId.indexOf('@');
    return at > 0 ? eventId.slice(at + 1) : null;
  }
  const at = eventId.indexOf('@');
  return at > 0 ? eventId.slice(0, at) : eventId;
}
