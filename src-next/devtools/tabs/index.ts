import type { ReactNode } from 'react';
import { stateTab } from './StateTab';
import { flagsTab } from './FlagsTab';
import { seedTab } from './SeedTab';
import { screenTab } from './ScreenTab';
import { traceTab } from './TraceTab';
import { audioTab } from './AudioTab';
import { scoringTab } from './ScoringTab';
import { perfTab } from './PerfTab';

export type DevTab = {
  id: string;
  label: string;
  render: () => ReactNode;
};

export const tabs: DevTab[] = [stateTab, flagsTab, seedTab, screenTab, traceTab, audioTab, scoringTab, perfTab];
