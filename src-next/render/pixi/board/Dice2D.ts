import { Container, Graphics } from 'pixi.js';
import { store } from '../../../state/store';
import { dispatch } from '../../../actions/dispatch';
import type { DieSnapshot } from '../../../events/types';

const DIE_W = 72;
const DIE_GAP = 16;
const PIP_R = 6;
const ROW_Y = 380;

const PIP_LAYOUT: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

export class Dice2D {
  readonly container = new Container();
  private dieGfx: Graphics[] = [];
  private unsubscribe: () => void;

  constructor() {
    this.unsubscribe = store.subscribe((s, prev) => {
      if (s.round.dice !== prev.round.dice) this.render(s.round.dice);
    });
    this.render(store.getState().round.dice);
  }

  destroy() {
    this.unsubscribe();
    this.container.destroy({ children: true });
  }

  private render(dice: DieSnapshot[]) {
    while (this.dieGfx.length < dice.length) {
      const idx = this.dieGfx.length;
      const g = new Graphics();
      g.eventMode = 'static';
      g.cursor = 'pointer';
      g.on('pointertap', () => dispatch({ type: 'TOGGLE_LOCK', dieIdx: idx }));
      this.dieGfx.push(g);
      this.container.addChild(g);
    }
    while (this.dieGfx.length > dice.length) {
      this.dieGfx.pop()?.destroy();
    }

    const totalW = dice.length * DIE_W + (dice.length - 1) * DIE_GAP;
    const startX = (960 - totalW) / 2;

    dice.forEach((d, i) => {
      const g = this.dieGfx[i]!;
      g.clear();
      const x = startX + i * (DIE_W + DIE_GAP);
      const y = ROW_Y;
      const fill = d.locked ? 0xf5c451 : 0xdcd4ff;
      const stroke = d.locked ? 0xff7847 : 0x9577ff;
      g.roundRect(x, y, DIE_W, DIE_W, 12).fill({ color: fill, alpha: 0.92 }).stroke({ color: stroke, width: 2 });

      const cx = x + DIE_W / 2;
      const cy = y + DIE_W / 2;
      const off = 18;
      const pips = PIP_LAYOUT[d.face] ?? [];
      for (const [dx, dy] of pips) {
        g.circle(cx + dx * off, cy + dy * off, PIP_R).fill({ color: 0x1c1245 });
      }
    });
  }
}
