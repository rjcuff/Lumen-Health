import { getLatestHealthData } from '../db/queries';
import { blank, dim, val, good, warn, bad, bar, scoreColor, scoreWithLabel, DOT, footer, heading } from '../utils/format';
import { formatDuration } from '../utils/normalize';

export async function runRecovery(): Promise<void> {
  const records = getLatestHealthData(14);

  if (records.length === 0) {
    blank();
    console.log(bad('✗') + '  no recovery data found');
    blank();
    footer(['lumen', 'run lumen sync to pull your data']);
    blank();
    return;
  }

  // Build per-date map of recovery records
  const byDate = new Map<string, {
    recovery_score?: number;
    hrv_ms?: number;
    resting_hr_bpm?: number;
    sleep_score?: number;
    sleep_duration_min?: number;
  }>();

  for (const r of records) {
    const d = byDate.get(r.date) ?? {};
    if (r.data_type === 'recovery') {
      if (r.recovery_score != null)    d.recovery_score    = r.recovery_score;
      if (r.hrv_ms != null)            d.hrv_ms            = r.hrv_ms;
      if (r.resting_hr_bpm != null)    d.resting_hr_bpm    = r.resting_hr_bpm;
    }
    if (r.data_type === 'sleep') {
      if (r.sleep_score != null)       d.sleep_score       = r.sleep_score;
      if (r.sleep_duration_min != null) d.sleep_duration_min = r.sleep_duration_min;
    }
    byDate.set(r.date, d);
  }

  const rows = [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 7);

  blank();
  console.log(heading('Recovery Trend') + dim('  last 7 days'));
  blank();

  let totalRecovery = 0; let countRecovery = 0;
  let totalHrv = 0;      let countHrv = 0;
  let totalRhr = 0;      let countRhr = 0;

  for (const [date, d] of rows) {
    const d2 = new Date(date + 'T00:00:00');
    const label = d2.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase();

    if (d.recovery_score != null) {
      console.log(
        '  ' + dim(label.padEnd(8)) + '  ' +
        scoreWithLabel(d.recovery_score) + '  ' +
        bar(d.recovery_score)
      );
      totalRecovery += d.recovery_score; countRecovery++;
    } else if (d.resting_hr_bpm != null) {
      console.log(
        '  ' + dim(label.padEnd(8)) + '  ' +
        dim('rhr ') + val(d.resting_hr_bpm.toFixed(0) + 'bpm')
      );
    } else {
      console.log('  ' + dim(label.padEnd(8)) + '  ' + dim('no data'));
    }

    if (d.hrv_ms != null)         { totalHrv += d.hrv_ms;         countHrv++; }
    if (d.resting_hr_bpm != null) { totalRhr += d.resting_hr_bpm; countRhr++; }
  }

  blank();

  // Averages
  const avgParts: string[] = [];
  if (countRecovery > 0) avgParts.push(dim('avg recovery ') + scoreColor(Math.round(totalRecovery / countRecovery)) + dim('/100'));
  if (countHrv > 0)      avgParts.push(dim('avg hrv ') + val((totalHrv / countHrv).toFixed(0) + 'ms'));
  if (countRhr > 0)      avgParts.push(dim('avg rhr ') + val((totalRhr / countRhr).toFixed(0) + 'bpm'));
  if (avgParts.length)   console.log('  ' + avgParts.join(DOT));

  blank();
  footer(['lumen', 'try: lumen ask "why was my recovery low this week?"']);
}
