import { getLatestHealthData } from '../db/queries';
import { printHistoryTable, printWarning, footer, blank, type HistoryRow } from '../utils/format';

export async function runHistory(): Promise<void> {
  const records = getLatestHealthData(7);

  if (records.length === 0) {
    blank();
    printWarning('no data found');
    footer(['run lumen sync to pull your data']);
    blank();
    return;
  }

  const byDate = new Map<string, { recovery?: (typeof records)[0]; sleep?: (typeof records)[0]; activity?: (typeof records)[0] }>();

  for (const r of records) {
    const d = byDate.get(r.date) ?? {};
    if (r.data_type === 'recovery' && !d.recovery)  d.recovery  = r;
    if (r.data_type === 'sleep'    && !d.sleep)      d.sleep     = r;
    if (r.data_type === 'activity' && !d.activity)   d.activity  = r;
    byDate.set(r.date, d);
  }

  const rows: HistoryRow[] = [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 7)
    .map(([date, d]) => ({
      date,
      recovery_score:    d.recovery?.recovery_score     ?? undefined,
      sleep_score:       d.sleep?.sleep_score           ?? undefined,
      sleep_duration_min:d.sleep?.sleep_duration_min    ?? undefined,
      hrv_ms:            d.recovery?.hrv_ms             ?? undefined,
      resting_hr_bpm:    d.recovery?.resting_hr_bpm     ?? undefined,
      strain_score:      d.activity?.strain_score       ?? undefined,
    }));

  blank();
  printHistoryTable(rows);
  footer(['lumen', 'lumen ask "how did I sleep this week?"']);
}
