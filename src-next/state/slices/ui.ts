export type Screen = 'title' | 'nameentry' | 'hub' | 'round' | 'shop' | 'forge' | 'runes' | 'scores' | 'pause' | 'win';

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
