import { getHealthDataForDate, getLatestHealthData, getLinkedProviders, getToken } from '../db/queries';
import { todayDateString } from '../utils/normalize';
import { printStatusCard, footer, printWarning, blank } from '../utils/format';
import type { HealthData } from '../db/schema';

export async function runStatus(): Promise<void> {
  let date = todayDateString();
  let records = getHealthDataForDate(date);
  const providers = getLinkedProviders();

  // If today has no useful data, show the most recent day that does
  const hasUsefulData = (r: HealthData[]) =>
    r.some(x => x.sleep_duration_min != null || x.recovery_score != null || x.resting_hr_bpm != null || x.steps != null);

  if (!hasUsefulData(records)) {
    const recent = getLatestHealthData(7);
    const latestDate = recent.find(r =>
      r.sleep_duration_min != null || r.recovery_score != null || r.resting_hr_bpm != null
    )?.date;
    if (latestDate && latestDate !== date) {
      date = latestDate;
      records = getHealthDataForDate(date);
    }
  }

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
  const sleep    = pickBestWithData(records, 'sleep',    ['whoop', 'garmin']);
  const activity = pickBest(records, 'activity', ['whoop', 'garmin']);

  blank();
  printStatusCard({ date, recovery, sleep, activity });

  const sources = [...new Set(records.map(r => r.source))];
  const isToday = date === todayDateString();
  footer(['lumen', ...sources, isToday ? 'lumen ask "..." for insights' : `most recent · ${date}`]);
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

// Like pickBest but skips records that have no meaningful data
function pickBestWithData(
  records: HealthData[],
  dataType: HealthData['data_type'],
  order: Array<HealthData['source']>
): HealthData | undefined {
  const candidates = records.filter(r =>
    r.data_type === dataType &&
    (r.sleep_duration_min != null || r.sleep_score != null || r.sleep_deep_min != null)
  );
  for (const source of order) {
    const match = candidates.find(r => r.source === source);
    if (match) return match;
  }
  return candidates[0];
}
