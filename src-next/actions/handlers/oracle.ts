import type { ActionHandler } from './types';

export const oracleHandler: ActionHandler = (a, s) => {
  switch (a.type) {
    case 'GRANT_ORACLE': {
      if (s.run.oracles.includes(a.id)) return { state: s, events: [] };
      return {
        state: { ...s, run: { ...s.run, oracles: [...s.run.oracles, a.id] } },
        events: [],
      };
    }
    case 'REVOKE_ORACLE':
      return {
        state: { ...s, run: { ...s.run, oracles: s.run.oracles.filter((x) => x !== a.id) } },
        events: [],
      };
    default:
      return { state: s, events: [] };
  }
};
