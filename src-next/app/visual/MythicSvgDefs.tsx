// Global SVG filter defs for the Mythic catalyst frame.
//
// The .is-mythic card-level animation cycles `filter: url(#myth-displace-a)`
// and `url(#myth-displace-b)` for the brief edge-warp bursts that fire
// every ~5.5s. These have to be DOM-resolvable from any card on screen,
// so they're mounted once at app root and referenced by URL fragment.
//
// Filter parameters lifted verbatim from the design package
// (project/Catalyst Card System Brief.html). Two filters with different
// turbulence frequencies + seeds give the warp visual variety across the
// glitch cycle.

export function MythicSvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none', width: 0, height: 0 }} aria-hidden>
      <defs>
        <filter id="myth-displace-a" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.025 0.85" numOctaves={2} seed={3}  result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={7}  xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="myth-displace-b" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05 0.6"  numOctaves={2} seed={11} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={10} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}
