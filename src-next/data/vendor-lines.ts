type Kind = 'catalyst' | 'voucher' | 'consumable';

const LINES: Record<Kind | 'default', string[]> = {
  catalyst: [
    "Bias the curve.",
    "Hot tip — the catalyst remembers.",
    "Tilt the table. Quietly.",
  ],
  voucher: [
    "Brass tokens. Bureaucratic. Useful.",
    "Permit's good through end of run.",
  ],
  consumable: [
    "Single use. Plan twice.",
    "Spend it once. Spend it well.",
  ],
  default: [
    "House doesn't refund.",
  ],
};

export function vendorLine(kind?: string): string {
  const arr = LINES[(kind as Kind) ?? 'default'] ?? LINES.default;
  return arr[Math.floor(Math.random() * arr.length)]!;
}
