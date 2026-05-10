import chalk from 'chalk';
import { upsertProfile, upsertHealthData } from '../db/queries';
import { blank, good, dim } from '../utils/format';

export async function runDemo(): Promise<void> {
  blank();
  console.log(chalk.hex('#f9fafb')('seeding demo data...'));
  blank();

  // Demo profile
  upsertProfile({
    name: 'Demo',
    age: 29,
    gender: 'male',
    height_in: 71,
    weight_lbs: 178,
    health_goal: 'athletic_performance',
    activity_level: 'active',
  });

  // 7 days of realistic WHOOP-style data
  const days: Array<{
    date: string;
    rec: number; hrv: number; rhr: number;
    sleep: number; efficiency: number; sleepScore: number;
    deep: number; rem: number; light: number;
    strain: number; steps: number; kcal: number;
  }> = [
    { date: offset(0), rec: 73, hrv: 58.2, rhr: 54, sleep: 428, efficiency: 89, sleepScore: 82, deep: 74, rem: 96, light: 258, strain: 11.4, steps: 9240, kcal: 2810 },
    { date: offset(1), rec: 61, hrv: 47.1, rhr: 58, sleep: 392, efficiency: 86, sleepScore: 76, deep: 58, rem: 81, light: 253, strain: 13.8, steps: 11200, kcal: 3020 },
    { date: offset(2), rec: 88, hrv: 71.4, rhr: 50, sleep: 461, efficiency: 92, sleepScore: 89, deep: 92, rem: 108, light: 261, strain: 7.2,  steps: 6800, kcal: 2640 },
    { date: offset(3), rec: 42, hrv: 36.8, rhr: 63, sleep: 348, efficiency: 82, sleepScore: 66, deep: 41, rem: 72, light: 235, strain: 16.1, steps: 13400, kcal: 3280 },
    { date: offset(4), rec: 79, hrv: 63.5, rhr: 52, sleep: 441, efficiency: 91, sleepScore: 85, deep: 88, rem: 99, light: 254, strain: 9.6,  steps: 8100, kcal: 2750 },
    { date: offset(5), rec: 55, hrv: 44.2, rhr: 60, sleep: 374, efficiency: 84, sleepScore: 72, deep: 52, rem: 78, light: 244, strain: 14.3, steps: 10600, kcal: 2950 },
    { date: offset(6), rec: 93, hrv: 77.8, rhr: 48, sleep: 476, efficiency: 94, sleepScore: 93, deep: 101, rem: 114, light: 261, strain: 5.4,  steps: 5900, kcal: 2580 },
  ];

  for (const d of days) {
    upsertHealthData({
      date: d.date, source: 'whoop', data_type: 'recovery',
      recovery_score: d.rec, hrv_ms: d.hrv, resting_hr_bpm: d.rhr,
    });
    upsertHealthData({
      date: d.date, source: 'whoop', data_type: 'sleep',
      sleep_duration_min: d.sleep, sleep_efficiency_pct: d.efficiency,
      sleep_score: d.sleepScore, sleep_deep_min: d.deep,
      sleep_rem_min: d.rem, sleep_light_min: d.light,
    });
    upsertHealthData({
      date: d.date, source: 'whoop', data_type: 'activity',
      strain_score: d.strain, steps: d.steps, calories_total: d.kcal,
    });
  }

  console.log(good('✓') + '  ' + chalk.hex('#f9fafb')('7 days of demo data loaded'));
  blank();
  console.log(dim('try it:'));
  console.log(chalk.hex('#f9fafb')('  lumen status'));
  console.log(chalk.hex('#f9fafb')('  lumen history'));
  console.log(chalk.hex('#f9fafb')('  lumen ask "am I ready to train hard today?"'));
  console.log(chalk.hex('#f9fafb')('  lumen plan'));
  blank();
  console.log(dim('when ready, run lumen link whoop or lumen link garmin to use real data'));
  blank();
}

function offset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}
