import { getDb } from '../db/schema';
import { getLatestHealthData } from '../db/queries';
import type { HealthData } from '../db/schema';

export interface DailyScore {
  date: string;
  score: number;
  label: string;
  recovery_score?: number;
  sleep_score?: number;
  hrv_ms?: number;
  sleep_duration_min?: number;
  streak_recovery: number;
  streak_sleep: number;
  streak_training: number;
}

export interface Achievement {
  key: string;
  name: string;
  description: string;
}

const ACHIEVEMENTS: Achievement[] = [
  { key: 'green_7',      name: 'Week in the Green',    description: '7 consecutive days with recovery ≥ 67' },
  { key: 'sleep_king',   name: 'Sleep King',           description: '7 consecutive nights with 8+ hours' },
  { key: 'hrv_peak',     name: 'HRV Peak',             description: 'HRV above 70ms for 3 consecutive days' },
  { key: 'comeback',     name: 'Comeback',             description: 'Recovery jumped 30+ points from previous day' },
  { key: 'dialed_in',    name: 'Dialed In',            description: 'Recovery + sleep both ≥ 80 on same day' },
  { key: 'consistency',  name: 'Consistent',           description: '14 days with sleep data logged' },
];

function scoreFromData(recovery?: HealthData, sleep?: HealthData): number {
  let score = 50;
  let hasAnyData = false;

  if (recovery?.recovery_score != null) {
    score += (recovery.recovery_score - 50) * 0.4;
    hasAnyData = true;
  }
  if (sleep?.sleep_score != null) {
    score += (sleep.sleep_score - 50) * 0.35;
    hasAnyData = true;
  }
  if (recovery?.hrv_ms != null) {
    const hrvDelta = (recovery.hrv_ms - 60) / 2;
    score += Math.max(-10, Math.min(10, hrvDelta));
    hasAnyData = true;
  }
  if (sleep?.sleep_duration_min != null) {
    const hoursDelta = (sleep.sleep_duration_min / 60 - 7.5) * 5;
    score += Math.max(-5, Math.min(5, hoursDelta));
    hasAnyData = true;
  }
  // Resting HR: 45bpm = +15, 55bpm = +5, 65bpm = -5, 75bpm = -15
  if (recovery?.resting_hr_bpm != null) {
    const rhrDelta = (60 - recovery.resting_hr_bpm);
    score += Math.max(-15, Math.min(15, rhrDelta));
    hasAnyData = true;
  }

  return hasAnyData ? Math.round(Math.max(0, Math.min(100, score))) : 50;
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'excellent';
  if (score >= 67) return 'good';
  if (score >= 50) return 'moderate';
  if (score >= 34) return 'low';
  return 'poor';
}

function calcStreak(
  history: HealthData[],
  dataType: 'recovery' | 'sleep',
  field: keyof HealthData,
  threshold: number
): number {
  const byDate = new Map<string, HealthData>();
  for (const r of history) {
    if (r.data_type === dataType && !byDate.has(r.date)) byDate.set(r.date, r);
  }

  const dates = [...byDate.keys()].sort().reverse();
  let streak = 0;
  for (const date of dates) {
    const val = byDate.get(date)?.[field] as number | undefined;
    if (val != null && val >= threshold) streak++;
    else break;
  }
  return streak;
}

export function computeAndSaveScore(date: string): DailyScore {
  const db = getDb();
  const history = getLatestHealthData(14);

  // Use most recent date that has meaningful data if today is empty
  const hasUseful = (d: string) => history.some(r =>
    r.date === d && (r.sleep_duration_min != null || r.recovery_score != null || r.resting_hr_bpm != null)
  );
  const effectiveDate = hasUseful(date)
    ? date
    : [...new Set(history.map(r => r.date))].sort().reverse().find(d => hasUseful(d)) ?? date;

  const today = history.filter(r => r.date === effectiveDate);

  const recovery = today.find(r => r.data_type === 'recovery');
  const sleep    = today.find(r => r.data_type === 'sleep');
  const activity = today.find(r => r.data_type === 'activity');

  const score = scoreFromData(recovery, sleep);

  const streakRecovery = calcStreak(history, 'recovery', 'recovery_score', 67);
  const streakSleep    = calcStreak(history, 'sleep',    'sleep_duration_min', 420); // 7h
  const activityHistory = history.filter(r => r.data_type === 'activity') as HealthData[];
  const streakTraining = (() => {
    const byDate = new Map<string, HealthData>();
    for (const r of activityHistory) if (!byDate.has(r.date)) byDate.set(r.date, r);
    const dates = [...byDate.keys()].sort().reverse();
    let streak = 0;
    for (const d of dates) {
      const v = byDate.get(d)?.strain_score;
      if (v != null && v >= 8) streak++; else break;
    }
    return streak;
  })();

  db.prepare(`
    INSERT INTO daily_scores
      (date, score, recovery_score, sleep_score, hrv_ms, sleep_duration_min,
       streak_recovery, streak_sleep, streak_training)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      score = excluded.score,
      recovery_score = excluded.recovery_score,
      sleep_score = excluded.sleep_score,
      hrv_ms = excluded.hrv_ms,
      sleep_duration_min = excluded.sleep_duration_min,
      streak_recovery = excluded.streak_recovery,
      streak_sleep = excluded.streak_sleep,
      streak_training = excluded.streak_training
  `).run(
    effectiveDate, score,
    recovery?.recovery_score ?? null,
    sleep?.sleep_score ?? null,
    recovery?.hrv_ms ?? null,
    sleep?.sleep_duration_min ?? null,
    streakRecovery, streakSleep, streakTraining
  );

  return {
    date: effectiveDate, score, label: scoreLabel(score),
    recovery_score: recovery?.recovery_score,
    sleep_score: sleep?.sleep_score,
    hrv_ms: recovery?.hrv_ms,
    sleep_duration_min: sleep?.sleep_duration_min,
    streak_recovery: streakRecovery,
    streak_sleep: streakSleep,
    streak_training: streakTraining,
  };
}

export function getUnlockedAchievements(): Achievement[] {
  const db = getDb();
  const unlocked: Achievement[] = [];
  const scores = db.prepare(
    "SELECT * FROM daily_scores ORDER BY date DESC LIMIT 30"
  ).all() as unknown as DailyScore[];

  if (!scores.length) return [];

  const maxStreakRecovery = Math.max(...scores.map(s => s.streak_recovery));
  const maxStreakSleep    = Math.max(...scores.map(s => s.streak_sleep));
  const maxStreakHRV      = getMaxHrvStreak(scores);
  const hasComeBack       = hasComeback(scores);
  const hasDialedIn       = scores.some(s => (s.recovery_score ?? 0) >= 80 && (s.sleep_score ?? 0) >= 80);
  const daysWithSleep     = scores.filter(s => s.sleep_duration_min != null).length;

  if (maxStreakRecovery >= 7) unlocked.push(ACHIEVEMENTS.find(a => a.key === 'green_7')!);
  if (maxStreakSleep    >= 7) unlocked.push(ACHIEVEMENTS.find(a => a.key === 'sleep_king')!);
  if (maxStreakHRV      >= 3) unlocked.push(ACHIEVEMENTS.find(a => a.key === 'hrv_peak')!);
  if (hasComeBack)            unlocked.push(ACHIEVEMENTS.find(a => a.key === 'comeback')!);
  if (hasDialedIn)            unlocked.push(ACHIEVEMENTS.find(a => a.key === 'dialed_in')!);
  if (daysWithSleep    >= 14) unlocked.push(ACHIEVEMENTS.find(a => a.key === 'consistency')!);

  return unlocked;
}

function getMaxHrvStreak(scores: DailyScore[]): number {
  let max = 0, cur = 0;
  for (const s of [...scores].reverse()) {
    if ((s.hrv_ms ?? 0) >= 70) cur++;
    else cur = 0;
    if (cur > max) max = cur;
  }
  return max;
}

function hasComeback(scores: DailyScore[]): boolean {
  const sorted = [...scores].sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].recovery_score ?? 0;
    const curr = sorted[i].recovery_score ?? 0;
    if (curr - prev >= 30) return true;
  }
  return false;
}
