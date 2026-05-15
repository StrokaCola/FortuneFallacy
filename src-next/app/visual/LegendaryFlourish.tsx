// Per-legendary signature flourish — small mechanic-hinting micro
// animation rendered inside the card so the four legendaries don't
// read as identical. Each catalyst gets a tailored idle accent that
// hints at its mechanic without being literal:
//
//   all_band      — tier-up mechanic → upward shimmer wave
//   eclipse_pact  — fires every hand → tiny orbital dot
//   heirloom_locket — carries half across runs → faint chain link
//   recursion_lens — retrigger twice → ghosted concentric echo
//
// Returns null for unknown catalyst ids so this is a drop-in for
// any future legendary too.

type Props = {
  catalystId: string;
};

export function LegendaryFlourish({ catalystId }: Props) {
  switch (catalystId) {
    case 'all_band':
      return <div className="ff-flourish-allband" aria-hidden="true" />;
    case 'eclipse_pact':
      return <div className="ff-flourish-eclipse" aria-hidden="true" />;
    case 'heirloom_locket':
      return (
        <div className="ff-flourish-heirloom" aria-hidden="true" title="">
          ⚭
        </div>
      );
    case 'recursion_lens':
      return <div className="ff-flourish-recursion" aria-hidden="true" />;
    default:
      return null;
  }
}

// Idle drift embers — two tiny gold sparks that float upward from
// a legendary card. Anchored absolutely inside the card; staggered
// so the second ember kicks in halfway through the first's cycle.
export function LegendaryEmbers() {
  return (
    <>
      <div className="ff-ember ff-ember-1" style={{ bottom: 6 }} aria-hidden="true" />
      <div className="ff-ember ff-ember-2" style={{ bottom: 6 }} aria-hidden="true" />
    </>
  );
}
