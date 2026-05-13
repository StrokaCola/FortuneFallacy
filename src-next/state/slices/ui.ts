export type Screen = 'title' | 'nameentry' | 'constellation_select' | 'hub' | 'round' | 'shop' | 'forge' | 'scores' | 'pause' | 'win' | 'fail' | 'settings' | 'codex' | 'challenges' | 'astral_forge' | 'event';

export type DieTipPointer = 'mouse' | 'touch' | 'pen';

// Active long-press tooltip on an in-round die. `screenX`/`screenY` are CSS
// pixels captured at hold-fire time so the tip stays anchored even if the
// die animates afterwards.
export type DieTipState = {
  dieIdx: number;
  screenX: number;
  screenY: number;
  pointerType: DieTipPointer;
};

export type UiSlice = {
  screen: Screen;
  paused: boolean;
  tooltip: string | null;
  transition: 'idle' | 'sliding';
  dieTip: DieTipState | null;
};

export const initialUiSlice = (): UiSlice => ({
  screen: 'title',
  paused: false,
  tooltip: null,
  transition: 'idle',
  dieTip: null,
});
