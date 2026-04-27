import type { CSSProperties, ReactNode } from 'react';

export function OrnateFrame({
  children,
  style,
  color = 'rgba(245,196,81,0.5)',
}: { children?: ReactNode; style?: CSSProperties; color?: string }) {
  return (
    <div style={{ position: 'relative', ...style }}>
      <span className="flourish-corner tl" style={{ borderColor: color }} />
      <span className="flourish-corner tr" style={{ borderColor: color }} />
      <span className="flourish-corner bl" style={{ borderColor: color }} />
      <span className="flourish-corner br" style={{ borderColor: color }} />
      {children}
    </div>
  );
}
