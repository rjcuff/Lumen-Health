import { getHealthDataForDate, getLatestHealthData, getLinkedProviders, getToken } from '../db/queries';
import { todayDateString } from '../utils/normalize';
import { printStatusCard, footer, printWarning, blank } from '../utils/format';
import type { HealthData } from '../db/schema';

export async function runStatus(): Promise<void> {
  let date    = todayDateString();
  let records = getHealthDataForDate(date);
  const providers = getLinkedProviders();

  const hasUsefulData = (r: HealthData[]) =>
    r.some(x => x.sleep_duration_min != null || x.recovery_score != null || x.resting_hr_bpm != null || x.steps != null);

  if (!hasUsefulData(records)) {
    const recent     = getLatestHealthData(7);
    const latestDate = recent.find(r =>
      r.sleep_duration_min != null || r.recovery_score != null || r.resting_hr_bpm != null
    )?.date;
    if (latestDate && latestDate !== date) {
      date    = latestDate;
      records = getHealthDataForDate(date);
    }
  }

  if (records.length === 0) {
    blank();
    if (providers.length === 0) {
      printWarning('no devices connected');
      blank();
      footer(['lumen link garmin', 'lumen link whoop']);
    } else {
      printWarning('no data yet');
      blank();
      footer(['lumen', 'run lumen sync to pull your data']);
    }
    blank();
    return;
  }

  const recovery = pickBest(records, 'recovery', ['whoop', 'garmin']);
  const sleep    = pickBestWithData(records, 'sleep', ['whoop', 'garmin']);
  const activity = pickBest(records, 'activity', ['whoop', 'garmin']);
  const stale    = date !== todayDateString();

  blank();
  printStatusCard({ date, recovery, sleep, activity, stale });

  const sources = [...new Set(records.map(r => r.source))];
  const hint    = stale
    ? 'run lumen sync to update'
    : 'try: lumen ask "..." for insights';
  footer(['lumen', ...sources, hint]);
}

function pickBest(
  records: HealthData[],
  dataType: HealthData['data_type'],
  order: Array<HealthData['source']>,
): HealthData | undefined {
  const candidates = records.filter(r => r.data_type === dataType);
  for (const source of order) {
    const match = candidates.find(r => r.source === source);
    if (match) return match;
  }
  return candidates[0];
}

function pickBestWithData(
  records: HealthData[],
  dataType: HealthData['data_type'],
  order: Array<HealthData['source']>,
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
