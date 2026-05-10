import { GarminConnect } from 'garmin-connect';
import { getToken, upsertToken } from '../db/queries';
import { normalizeGarminActivity, normalizeGarminSleep } from '../utils/normalize';
import type { HealthData } from '../db/schema';

interface GarminCreds {
  username: string;
  password: string;
}

interface GarminStepsData {
  startGMT?: string;
  startDate?: string;
  totalSteps?: number;
  totalDistance?: number;
  dailyStepGoal?: number;
  stepData?: unknown[];
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

// ─── Data fetchers ─────────────────────────────────────────────────────────────

export async function fetchGarminData(startDate: string, endDate: string): Promise<HealthData[]> {
  const client = await getGarminClient();
  const items: HealthData[] = [];

  const dates = getDatesInRange(startDate, endDate);

  await Promise.allSettled(
    dates.map(async (dateStr) => {
      const date = new Date(dateStr + 'T12:00:00');

      const [stepsResult, sleepResult, heartRateResult] = await Promise.allSettled([
        client.getSteps(date),
        client.getSleepData(date),
        client.getHeartRate(date),
      ]);

      // Build activity record from steps + heart rate
      const stepsData = stepsResult.status === 'fulfilled' ? stepsResult.value as GarminStepsData : null;
      const hrData = heartRateResult.status === 'fulfilled' ? heartRateResult.value as { restingHeartRate?: number; heartRateValues?: unknown[] } : null;

      if (stepsData || hrData) {
        const activityNorm = normalizeGarminActivity({
          calendarDate: dateStr,
          steps: stepsData?.totalSteps,
          distanceInMeters: stepsData?.totalDistance,
          restingHeartRate: hrData?.restingHeartRate,
        });
        items.push(activityNorm);

        // Create a recovery record so resting HR shows in status
        if (hrData?.restingHeartRate) {
          items.push({
            date: dateStr,
            source: 'garmin',
            data_type: 'recovery',
            resting_hr_bpm: hrData.restingHeartRate,
          });
        }
      }

      if (sleepResult.status === 'fulfilled' && sleepResult.value) {
        const normalized = normalizeGarminSleep(sleepResult.value as any);
        if (normalized) items.push(normalized);
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
