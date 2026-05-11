import { safeReadJSON, safeWriteJSON } from '../../state/storage';
import {
  getInspectorState,
  replaceOverrides,
  subscribeInspector,
  type InspectorOverride,
} from './store';

const KEY = 'ff_next_inspect_overrides';

export function loadOverridesFromStorage(): void {
  const parsed = safeReadJSON<Record<string, InspectorOverride>>(KEY);
  if (parsed && typeof parsed === 'object') {
    replaceOverrides(parsed);
  }
}

let persistInstalled = false;
let lastRef: Record<string, InspectorOverride> | null = null;
export function installOverridePersistence(): void {
  if (persistInstalled) return;
  persistInstalled = true;
  subscribeInspector(() => {
    const cur = getInspectorState().overrides;
    if (cur === lastRef) return;
    lastRef = cur;
    safeWriteJSON(KEY, cur);
  });
}
