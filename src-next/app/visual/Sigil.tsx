export const SIGILS: Record<string, string> = {
  serpent: '∞',
  fool: '☉',
  tower: '♅',
  devil: '⛧',
  priestess: '⚜',
  empress: '♀',
  star: '✦',
  moon: '☽',
  sun: '☀',
  comet: '☄',
};

export function Sigil({
  kind = 'star',
  size = 22,
  color = '#7be3ff',
}: { kind?: keyof typeof SIGILS | string; size?: number; color?: string }) {
  return (
    <span
      className="f-display"
      style={{
        fontSize: size,
        color,
        lineHeight: 1,
        filter: `drop-shadow(0 0 6px ${color}80)`,
        display: 'inline-block',
      }}>
      {SIGILS[kind] ?? '✦'}
    </span>
  );
}
