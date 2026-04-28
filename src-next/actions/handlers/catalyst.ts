import type { ActionHandler } from './types';

export const catalystHandler: ActionHandler = (a, s) => {
  switch (a.type) {
    case 'GRANT_CATALYST': {
      if (s.run.catalysts.includes(a.id)) return { state: s, events: [] };
      return {
        state: { ...s, run: { ...s.run, catalysts: [...s.run.catalysts, a.id] } },
        events: [],
      };
    }
    case 'REVOKE_CATALYST':
      return {
        state: { ...s, run: { ...s.run, catalysts: s.run.catalysts.filter((x) => x !== a.id) } },
        events: [],
      };
    default:
      return { state: s, events: [] };
  }
};
