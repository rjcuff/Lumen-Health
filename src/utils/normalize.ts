import type { HealthData, DataSource } from '../db/schema';

// ─── Whoop normalizers ────────────────────────────────────────────────────────

export interface WhoopCycle {
  id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  score_state: string;
  score?: {
    strain: number;
    kilojoule: number;
    average_heart_rate: number;
    max_heart_rate: number;
  };
}

export interface WhoopRecovery {
  cycle_id: number;
  sleep_id: number;
  created_at: string;
  updated_at: string;
  score_state: string;
  score?: {
    user_calibrating: boolean;
    recovery_score: number;
    resting_heart_rate: number;
    hrv_rmssd_milli: number;
    spo2_percentage?: number;
    skin_temp_celsius?: number;
  };
}

export interface WhoopSleep {
  id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  nap: boolean;
  score_state: string;
  score?: {
    stage_summary: {
      total_awake_time_milli: number;
      total_no_data_time_milli: number;
      total_light_sleep_time_milli: number;
      total_slow_wave_sleep_time_milli: number;
      total_rem_sleep_time_milli: number;
      sleep_cycle_count: number;
      disturbance_count: number;
    };
    sleep_needed: {
      baseline_milli: number;
      need_from_sleep_debt_milli: number;
      need_from_recent_strain_milli: number;
      need_from_recent_nap_milli: number;
    };
    respiratory_rate: number;
    sleep_performance_percentage: number;
    sleep_consistency_percentage: number;
    sleep_efficiency_percentage: number;
  };
}

export function normalizeWhoopSleep(sleep: WhoopSleep): HealthData {
  const date = sleep.start.split('T')[0];
  const score = sleep.score;

  const totalSleepMin = score
    ? msToMin(
        score.stage_summary.total_light_sleep_time_milli +
        score.stage_summary.total_slow_wave_sleep_time_milli +
        score.stage_summary.total_rem_sleep_time_milli
      )
    : undefined;

  return {
    date,
    source: 'whoop' as DataSource,
    data_type: 'sleep',
    sleep_duration_min: totalSleepMin,
    sleep_efficiency_pct: score?.sleep_efficiency_percentage,
    sleep_score: score?.sleep_performance_percentage,
    sleep_deep_min: score ? msToMin(score.stage_summary.total_slow_wave_sleep_time_milli) : undefined,
    sleep_rem_min: score ? msToMin(score.stage_summary.total_rem_sleep_time_milli) : undefined,
    sleep_light_min: score ? msToMin(score.stage_summary.total_light_sleep_time_milli) : undefined,
    sleep_awake_min: score ? msToMin(score.stage_summary.total_awake_time_milli) : undefined,
    raw_json: JSON.stringify(sleep),
  };
}

export function normalizeWhoopRecovery(recovery: WhoopRecovery, date: string): HealthData {
  const score = recovery.score;
  return {
    date,
    source: 'whoop' as DataSource,
    data_type: 'recovery',
    recovery_score: score?.recovery_score,
    hrv_ms: score?.hrv_rmssd_milli,
    resting_hr_bpm: score?.resting_heart_rate,
    spo2_pct: score?.spo2_percentage,
    skin_temp_c: score?.skin_temp_celsius,
    raw_json: JSON.stringify(recovery),
  };
}

export function normalizeWhoopCycle(cycle: WhoopCycle): HealthData {
  const date = cycle.start.split('T')[0];
  const score = cycle.score;
  const kcal = score ? score.kilojoule / 4.184 : undefined;

  return {
    date,
    source: 'whoop' as DataSource,
    data_type: 'activity',
    strain_score: score?.strain,
    calories_total: kcal,
    raw_json: JSON.stringify(cycle),
  };
}

// ─── Garmin normalizers ───────────────────────────────────────────────────────

export interface GarminDailySummary {
  calendarDate: string;
  totalKilocalories?: number;
  activeKilocalories?: number;
  steps?: number;
  floorsAscended?: number;
  floorsDescended?: number;
  intensityMinutesGoal?: number;
  moderateIntensityMinutes?: number;
  vigorousIntensityMinutes?: number;
  distanceInMeters?: number;
  restingHeartRate?: number;
  averageStressLevel?: number;
  maxStressLevel?: number;
  bodyBatteryChargedValue?: number;
  bodyBatteryDrainedValue?: number;
  minHeartRate?: number;
  maxHeartRate?: number;
  highlyActiveSeconds?: number;
  activeSeconds?: number;
  sedentarySeconds?: number;
  sleepingSeconds?: number;
}

export interface GarminSleepData {
  dailySleepDTO?: {
    calendarDate: string;
    sleepTimeSeconds?: number;
    napTimeSeconds?: number;
    sleepStartTimestampLocal?: number;
    sleepEndTimestampLocal?: number;
    sleepWindowConfirmed?: boolean;
    sleepWindowConfirmationType?: string;
    retro?: boolean;
    averageSpO2Value?: number;
    lowestSpO2Value?: number;
    highestSpO2Value?: number;
    averageSpO2HRVariability?: number;
    averageRespirationValue?: number;
    lowestRespirationValue?: number;
    highestRespirationValue?: number;
    awakeCount?: number;
    avgSleepStress?: number;
    ageGroup?: string;
    sleepScoreFeedback?: string;
    sleepScoreInsight?: string;
    sleepScores?: {
      totalDuration?: { qualifierKey: string; value: number };
      stress?: { qualifierKey: string; value: number };
      awakeCount?: { qualifierKey: string; value: number };
      overall?: { value: number; qualifierKey: string };
    };
    deepSleepSeconds?: number;
    lightSleepSeconds?: number;
    remSleepSeconds?: number;
    awakeSleepSeconds?: number;
    unmeasurableSleepSeconds?: number;
    averageHRV?: number;
    lowestHRV?: number;
    highestHRV?: number;
    hrvStatus?: string;
    restingHeartRate?: number;
  };
}

export function normalizeGarminActivity(summary: GarminDailySummary): HealthData {
  const activeMin = summary.moderateIntensityMinutes != null && summary.vigorousIntensityMinutes != null
    ? summary.moderateIntensityMinutes + summary.vigorousIntensityMinutes * 2
    : undefined;

  return {
    date: summary.calendarDate,
    source: 'garmin' as DataSource,
    data_type: 'activity',
    calories_total: summary.totalKilocalories,
    calories_active: summary.activeKilocalories,
    steps: summary.steps,
    active_minutes: activeMin,
    distance_km: summary.distanceInMeters ? summary.distanceInMeters / 1000 : undefined,
    resting_hr_bpm: summary.restingHeartRate,
    raw_json: JSON.stringify(summary),
  };
}

export function normalizeGarminSleep(data: GarminSleepData): HealthData | null {
  const dto = data.dailySleepDTO;
  if (!dto?.calendarDate) return null;

  const durationMin = dto.sleepTimeSeconds ? dto.sleepTimeSeconds / 60 : undefined;
  const deepMin = dto.deepSleepSeconds ? dto.deepSleepSeconds / 60 : undefined;
  const remMin = dto.remSleepSeconds ? dto.remSleepSeconds / 60 : undefined;
  const lightMin = dto.lightSleepSeconds ? dto.lightSleepSeconds / 60 : undefined;
  const awakeMin = dto.awakeSleepSeconds ? dto.awakeSleepSeconds / 60 : undefined;

  const sleepScore = dto.sleepScores?.overall?.value;

  let efficiency: number | undefined;
  if (durationMin && awakeMin != null) {
    const total = durationMin + awakeMin;
    efficiency = total > 0 ? (durationMin / total) * 100 : undefined;
  }

  return {
    date: dto.calendarDate,
    source: 'garmin' as DataSource,
    data_type: 'sleep',
    sleep_duration_min: durationMin,
    sleep_efficiency_pct: efficiency,
    sleep_score: sleepScore,
    sleep_deep_min: deepMin,
    sleep_rem_min: remMin,
    sleep_light_min: lightMin,
    sleep_awake_min: awakeMin,
    hrv_ms: dto.averageHRV,
    resting_hr_bpm: dto.restingHeartRate,
    spo2_pct: dto.averageSpO2Value,
    raw_json: JSON.stringify(data),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function msToMin(ms: number): number {
  return ms / 1000 / 60;
}

export function formatHeight(inches: number): string {
  const ft = Math.floor(inches / 12);
  const inch = Math.round(inches % 12);
  return `${ft}'${inch}"`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function todayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

export function dateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}
