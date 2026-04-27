type Kind = 'oracle' | 'voucher' | 'consumable';

const LINES: Record<Kind | 'default', string[]> = {
  oracle: [
    "Read the stars, traveler.",
    "An Oracle remembers you.",
    "The constellation listens.",
  ],
  voucher: [
    "Brass and dust — useful, perhaps.",
    "Take it. The void weighs nothing.",
  ],
  consumable: [
    "A small kindness, freely spent.",
    "Spend it well. Spend it once.",
  ],
  default: [
    "Choose well — the void keeps no change.",
  ],
};

export function vendorLine(kind?: string): string {
  const arr = LINES[(kind as Kind) ?? 'default'] ?? LINES.default;
  return arr[Math.floor(Math.random() * arr.length)]!;
}
