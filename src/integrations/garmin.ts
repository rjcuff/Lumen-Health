import { GarminConnect } from 'garmin-connect';
import { getToken, upsertToken } from '../db/queries';
import { normalizeGarminActivity, normalizeGarminSleep } from '../utils/normalize';
import type { HealthData } from '../db/schema';

interface GarminCreds {
  username: string;
  password: string;
}

interface GarminHeartRate {
  restingHeartRate?: number;
}

interface GarminUserProfile {
  displayName?: string;
}

interface GarminDailySummaryRaw {
  totalKilocalories?: number;
  activeKilocalories?: number;
  totalSteps?: number;
  distanceInMeters?: number;
  restingHeartRate?: number;
  averageStressLevel?: number;
  maxStressLevel?: number;
  bodyBatteryChargedValue?: number;
  bodyBatteryDrainedValue?: number;
  highlyActiveSeconds?: number;
  activeSeconds?: number;
  moderateIntensityMinutes?: number;
  vigorousIntensityMinutes?: number;
  averageSpO2?: number;
  averageRespirationValue?: number;
  calendarDate?: string;
}

function getStoredCreds(): GarminCreds | null {
  const token = getToken('garmin');
  if (!token?.extra) return null;
  try {
    return JSON.parse(token.extra) as GarminCreds;
  } catch {
    return null;
  }
}

// ─── Connection ───────────────────────────────────────────────────────────────

export async function connectGarmin(username: string, password: string): Promise<void> {
  const client = new GarminConnect({ username, password });
  await client.login(username, password);
  upsertToken({
    provider: 'garmin',
    access_token: 'garmin_basic_auth',
    extra: JSON.stringify({ username, password }),
  });
}

async function getGarminClient(): Promise<GarminConnect> {
  const creds = getStoredCreds();
  if (!creds) throw new Error('Garmin not connected. Run: lumen link garmin');
  const client = new GarminConnect({ username: creds.username, password: creds.password });
  await client.login(creds.username, creds.password);
  return client;
}

// ─── Fetch display name for custom API calls ──────────────────────────────────

async function getDisplayName(client: GarminConnect): Promise<string | null> {
  try {
    const profile = await client.getUserProfile() as GarminUserProfile;
    return profile?.displayName ?? null;
  } catch {
    return null;
  }
}

// ─── Custom Garmin wellness API calls ─────────────────────────────────────────

const GC_PROXY = 'https://connect.garmin.com/modern/proxy';

async function getDailySummary(
  client: GarminConnect,
  displayName: string,
  date: string
): Promise<GarminDailySummaryRaw | null> {
  try {
    const url = `${GC_PROXY}/usersummary-service/usersummary/daily/${displayName}`;
    const data = await client.get(url, { calendarDate: date }) as GarminDailySummaryRaw;
    return data;
  } catch {
    return null;
  }
}

// ─── Data fetchers ─────────────────────────────────────────────────────────────

export async function fetchGarminData(startDate: string, endDate: string): Promise<HealthData[]> {
  const client = await getGarminClient();
  const items: HealthData[] = [];
  const dates = getDatesInRange(startDate, endDate);

  // Get display name once for custom API calls
  const displayName = await getDisplayName(client);

  await Promise.allSettled(
    dates.map(async (dateStr) => {
      const date = new Date(dateStr + 'T12:00:00');

      const [sleepResult, heartRateResult, summaryResult] = await Promise.allSettled([
        client.getSleepData(date),
        client.getHeartRate(date),
        displayName ? getDailySummary(client, displayName, dateStr) : Promise.resolve(null),
      ]);

      const hrData = heartRateResult.status === 'fulfilled'
        ? heartRateResult.value as GarminHeartRate
        : null;

      const summary = summaryResult.status === 'fulfilled'
        ? summaryResult.value
        : null;

      // ── Activity record ──────────────────────────────────────────────────
      const activityNorm = normalizeGarminActivity({
        calendarDate: dateStr,
        totalKilocalories: summary?.totalKilocalories,
        activeKilocalories: summary?.activeKilocalories,
        steps: summary?.totalSteps,
        distanceInMeters: summary?.distanceInMeters,
        restingHeartRate: summary?.restingHeartRate ?? hrData?.restingHeartRate,
        moderateIntensityMinutes: summary?.moderateIntensityMinutes,
        vigorousIntensityMinutes: summary?.vigorousIntensityMinutes,
      });

      const hasActivity = Object.values(activityNorm).some(
        (v, i) => i > 2 && v != null  // skip date, source, data_type
      );
      if (hasActivity) items.push(activityNorm);

      // ── Recovery record — resting HR + body battery + stress ─────────────
      const rhr = summary?.restingHeartRate ?? hrData?.restingHeartRate;
      const bodyBattery = summary?.bodyBatteryChargedValue;
      const stress = summary?.averageStressLevel;
      const spo2 = summary?.averageSpO2;

      if (rhr != null || bodyBattery != null || stress != null) {
        items.push({
          date: dateStr,
          source: 'garmin',
          data_type: 'recovery',
          resting_hr_bpm: rhr,
          recovery_score: bodyBattery,  // body battery maps to recovery score
          spo2_pct: spo2,
          raw_json: JSON.stringify({ bodyBattery, stress, rhr, spo2 }),
        });
      }

      // ── Sleep record ──────────────────────────────────────────────────────
      if (sleepResult.status === 'fulfilled' && sleepResult.value) {
        const normalized = normalizeGarminSleep(sleepResult.value as any);
        if (normalized) {
          // Also pull respiration from daily summary if available
          if (summary?.averageRespirationValue && normalized) {
            normalized.raw_json = JSON.stringify({
              ...(normalized.raw_json ? JSON.parse(normalized.raw_json) : {}),
              avgRespiration: summary.averageRespirationValue,
            });
          }
          items.push(normalized);
        }
      }
    })
  );

  return items;
}

export function isGarminConnected(): boolean {
  return getToken('garmin') !== null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}
