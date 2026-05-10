import { getHealthDataForDate, getLinkedProviders, getToken } from '../db/queries';
import { todayDateString } from '../utils/normalize';
import { printStatusCard, footer, printWarning, blank } from '../utils/format';
import type { HealthData } from '../db/schema';

export async function runStatus(): Promise<void> {
  const date = todayDateString();
  const records = getHealthDataForDate(date);
  const providers = getLinkedProviders();

  if (records.length === 0) {
    blank();
    if (providers.length === 0) {
      printWarning('no devices connected');
      console.log('');
      footer(['lumen link whoop', 'lumen link garmin']);
    } else {
      printWarning('no data for today');
      footer(['run lumen sync to pull latest data']);
    }
    blank();
    return;
  }

  const recovery = pickBest(records, 'recovery', ['whoop', 'garmin']);
  const sleep    = pickBest(records, 'sleep',    ['whoop', 'garmin']);
  const activity = pickBest(records, 'activity', ['whoop', 'garmin']);

  blank();
  printStatusCard({ date, recovery, sleep, activity });

  const sources = [...new Set(records.map(r => r.source))];
  footer(['lumen', ...sources, 'lumen ask "..." for insights']);
}

function pickBest(
  records: HealthData[],
  dataType: HealthData['data_type'],
  order: Array<HealthData['source']>
): HealthData | undefined {
  const candidates = records.filter(r => r.data_type === dataType);
  for (const source of order) {
    const match = candidates.find(r => r.source === source);
    if (match) return match;
  }
  return candidates[0];
}
