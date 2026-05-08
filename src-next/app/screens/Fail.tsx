// Thin route adapter — actual content lives in RunPostmortem so wins and
// busts share the same layout, stats, and "One More Run" hook.
import { RunPostmortem } from './RunPostmortem';

export function Fail() {
  return <RunPostmortem mode="fail" />;
}
