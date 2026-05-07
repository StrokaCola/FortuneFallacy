export type Screen = 'title' | 'nameentry' | 'constellation_select' | 'hub' | 'round' | 'shop' | 'forge' | 'scores' | 'pause' | 'win' | 'fail' | 'settings' | 'codex' | 'challenges' | 'astral_forge';

export type UiSlice = {
  screen: Screen;
  paused: boolean;
  tooltip: string | null;
  transition: 'idle' | 'sliding';
};

export const initialUiSlice = (): UiSlice => ({
  screen: 'title',
  paused: false,
  tooltip: null,
  transition: 'idle',
});
