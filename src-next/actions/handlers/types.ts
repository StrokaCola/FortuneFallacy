import type { GameState } from '../../state/store';
import type { GameEventEmission } from '../../events/types';
import type { Action } from '../types';

export type HandlerResult = {
  state: GameState;
  events: GameEventEmission[];
};

export type ActionHandler = (action: Action, state: GameState) => HandlerResult;
