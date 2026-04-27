import { useEffect, useRef } from 'react';
import { Application, Container, Graphics } from 'pixi.js';

export function PixiStage() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const app = new Application();
    let disposed = false;

    const layers = {
      bg: new Container(),
      board: new Container(),
      fx: new Container(),
      overlay: new Container(),
    };

    (async () => {
      await app.init({
        width: 960,
        height: 540,
        backgroundAlpha: 0,
        antialias: true,
      });
      if (disposed) { app.destroy(true, { children: true }); return; }
      host.appendChild(app.canvas);
      app.stage.addChild(layers.bg, layers.board, layers.fx, layers.overlay);

      const tray = new Graphics()
        .roundRect(80, 360, 800, 140, 32)
        .fill({ color: 0x1c1245, alpha: 0.35 })
        .stroke({ color: 0x9577ff, width: 1.5, alpha: 0.4 });
      layers.board.addChild(tray);
    })();

    return () => {
      disposed = true;
      try { app.destroy(true, { children: true }); } catch { /* ignore */ }
    };
  }, []);

  return (
    <div
      ref={ref}
      className="absolute inset-0 m-auto"
      style={{ width: 960, height: 540, pointerEvents: 'auto' }}
    />
  );
}
