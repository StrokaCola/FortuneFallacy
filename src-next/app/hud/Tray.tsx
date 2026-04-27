export function Tray() {
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: '50%',
        bottom: 80,
        transform: 'translateX(-50%)',
        width: 800,
        height: 140,
        borderRadius: 32,
        border: '1.5px solid rgba(149, 119, 255, 0.4)',
        background: 'rgba(28, 18, 69, 0.35)',
        boxShadow: '0 0 40px rgba(149, 119, 255, 0.2) inset',
      }}
    />
  );
}
