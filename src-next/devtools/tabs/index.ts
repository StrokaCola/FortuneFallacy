import type { ReactNode } from 'react';
import { stateTab } from './StateTab';
import { flagsTab } from './FlagsTab';
import { seedTab } from './SeedTab';
import { screenTab } from './ScreenTab';
import { traceTab } from './TraceTab';
import { audioTab } from './AudioTab';
import { scoringTab } from './ScoringTab';
import { perfTab } from './PerfTab';
import { inspectTab } from './InspectTab';
import { moverTab } from './MoverTab';
import { emitTab } from './EmitTab';
import { actionsTab } from './ActionsTab';
import { effectsTab } from './EffectsTab';

export type DevTab = {
  id: string;
  label: string;
  render: () => ReactNode;
};

export const tabs: DevTab[] = [
  stateTab,
  flagsTab,
  seedTab,
  screenTab,
  traceTab,
  audioTab,
  scoringTab,
  perfTab,
  inspectTab,
  moverTab,
  emitTab,
  actionsTab,
  effectsTab,
];
