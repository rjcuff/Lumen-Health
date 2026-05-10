import type { Profile, HealthData } from '../db/schema';
import { formatDuration, formatHeight } from '../utils/normalize';
import { getMemories } from '../db/queries';

// ─── System prompt ─────────────────────────────────────────────────────────────

export function buildSystemPrompt(): string {
  return `You are Lumen — a knowledgeable, evidence-based personal health coach embedded in the user's terminal.

Your job is to interpret real biometric data and give specific, actionable health guidance. You have access to the user's wearable data from WHOOP and/or Garmin.

Core principles:
- Always be specific. Never give generic advice that ignores the actual data.
- Explain WHY behind every recommendation. Connect it to the user's numbers.
- Acknowledge uncertainty honestly — wearables have limitations.
- Prioritize recovery and sleep as foundations for everything else.
- Be direct and concise. No fluff, no unnecessary encouragement.
- Always end with ONE clear next action for the user to take right now.

Tone: Confident, precise, knowledgeable. Like a sports medicine doctor who is also a coach — not a cheerleader.

Data interpretation guidelines:
- Recovery score <33: Recommend rest or light activity only
- Recovery score 34-66: Moderate training is appropriate
- Recovery score 67+: High-intensity training is well-supported
- HRV significantly below personal baseline: Prioritize recovery
- Resting HR elevated >5bpm: Flag potential illness or overtraining
- Sleep efficiency <85%: Address sleep quality
- Deep sleep <15% of total: Flag recovery impact
- Strain score >15: High physical load, monitor recovery next day`;
}

// ─── Context builder ──────────────────────────────────────────────────────────

export interface HealthContext {
  profile: Profile;
  today: HealthData[];
  history: HealthData[];
}

export function buildUserContext(ctx: HealthContext): string {
  const { profile, today, history } = ctx;

  const bmi = (profile.weight_lbs / (profile.height_in ** 2) * 703).toFixed(1);

  // PII is stripped — name never leaves the local machine
  const profileBlock = `## User Profile
- Age: ${profile.age} years
- Gender: ${profile.gender}
- Height: ${formatHeight(profile.height_in)} (${profile.height_in.toFixed(1)} inches)
- Weight: ${profile.weight_lbs} lbs
- BMI: ${bmi}
- Primary Health Goal: ${profile.health_goal.replace(/_/g, ' ')}
- Activity Level: ${profile.activity_level}`;

  const memories = getMemories();
  const memoryBlock = memories.length > 0
    ? `## Context & Notes\n${memories.map(m => `- ${m}`).join('\n')}`
    : '';

  const todayBlock = buildDayBlock("Today's Data", today);
  const historyBlock = buildHistoryBlock(history);

  const noDataNote = today.length === 0 && history.length === 0
    ? '\n> Note: No biometric data is synced yet. Provide general guidance based on the user profile only.\n'
    : '';

  return [profileBlock, memoryBlock, noDataNote + todayBlock, historyBlock]
    .filter(Boolean)
    .join('\n\n');
}

function buildDayBlock(title: string, records: HealthData[]): string {
  if (records.length === 0) return `## ${title}\nNo data synced for this period.`;

  const lines: string[] = [`## ${title}`];

  const recovery = records.find(r => r.data_type === 'recovery');
  const sleep = records.find(r => r.data_type === 'sleep');
  const activity = records.find(r => r.data_type === 'activity');

  if (recovery) {
    lines.push('\n### Recovery');
    if (recovery.recovery_score != null) lines.push(`- Recovery Score: ${recovery.recovery_score.toFixed(0)}/100`);
    if (recovery.hrv_ms != null) lines.push(`- HRV (RMSSD): ${recovery.hrv_ms.toFixed(1)} ms`);
    if (recovery.resting_hr_bpm != null) lines.push(`- Resting Heart Rate: ${recovery.resting_hr_bpm.toFixed(0)} bpm`);
    if (recovery.spo2_pct != null) lines.push(`- SpO2: ${recovery.spo2_pct.toFixed(1)}%`);
    if (recovery.skin_temp_c != null) lines.push(`- Skin Temperature: ${recovery.skin_temp_c.toFixed(2)}°C`);
    if (recovery.source) lines.push(`- Source: ${recovery.source}`);
  }

  if (sleep) {
    lines.push('\n### Sleep');
    if (sleep.sleep_duration_min != null) lines.push(`- Duration: ${formatDuration(sleep.sleep_duration_min)} (${sleep.sleep_duration_min.toFixed(0)} min)`);
    if (sleep.sleep_score != null) lines.push(`- Sleep Score: ${sleep.sleep_score.toFixed(0)}/100`);
    if (sleep.sleep_efficiency_pct != null) lines.push(`- Efficiency: ${sleep.sleep_efficiency_pct.toFixed(1)}%`);
    if (sleep.sleep_deep_min != null) lines.push(`- Deep Sleep: ${formatDuration(sleep.sleep_deep_min)}`);
    if (sleep.sleep_rem_min != null) lines.push(`- REM Sleep: ${formatDuration(sleep.sleep_rem_min)}`);
    if (sleep.sleep_light_min != null) lines.push(`- Light Sleep: ${formatDuration(sleep.sleep_light_min)}`);
    if (sleep.sleep_awake_min != null) lines.push(`- Time Awake: ${formatDuration(sleep.sleep_awake_min)}`);
    if (sleep.hrv_ms != null) lines.push(`- HRV: ${sleep.hrv_ms.toFixed(1)} ms`);
    if (sleep.resting_hr_bpm != null) lines.push(`- Overnight RHR: ${sleep.resting_hr_bpm.toFixed(0)} bpm`);
    if (sleep.source) lines.push(`- Source: ${sleep.source}`);
  }

  if (activity) {
    lines.push('\n### Activity / Strain');
    if (activity.strain_score != null) lines.push(`- Strain Score: ${activity.strain_score.toFixed(1)}/21`);
    if (activity.steps != null) lines.push(`- Steps: ${activity.steps.toLocaleString()}`);
    if (activity.calories_total != null) lines.push(`- Total Calories: ${Math.round(activity.calories_total)} kcal`);
    if (activity.calories_active != null) lines.push(`- Active Calories: ${Math.round(activity.calories_active)} kcal`);
    if (activity.active_minutes != null) lines.push(`- Active Minutes: ${Math.round(activity.active_minutes)} min`);
    if (activity.distance_km != null) lines.push(`- Distance: ${activity.distance_km.toFixed(2)} km`);
    if (activity.source) lines.push(`- Source: ${activity.source}`);
  }

  return lines.join('\n');
}

function buildHistoryBlock(records: HealthData[]): string {
  if (records.length === 0) return '## Last 7 Days\nNo historical data available.';

  const byDate = new Map<string, HealthData[]>();
  for (const r of records) {
    const existing = byDate.get(r.date) ?? [];
    existing.push(r);
    byDate.set(r.date, existing);
  }

  const dates = [...byDate.keys()].sort().reverse().slice(0, 7);
  const lines: string[] = ['## Last 7 Days'];

  for (const date of dates) {
    const dayRecords = byDate.get(date) ?? [];
    const recovery = dayRecords.find(r => r.data_type === 'recovery');
    const sleep = dayRecords.find(r => r.data_type === 'sleep');
    const activity = dayRecords.find(r => r.data_type === 'activity');

    const parts: string[] = [`**${date}**:`];
    if (recovery?.recovery_score != null) parts.push(`Recovery ${recovery.recovery_score.toFixed(0)}`);
    if (recovery?.hrv_ms != null) parts.push(`HRV ${recovery.hrv_ms.toFixed(0)}ms`);
    if (recovery?.resting_hr_bpm != null) parts.push(`RHR ${recovery.resting_hr_bpm.toFixed(0)}bpm`);
    if (sleep?.sleep_duration_min != null) parts.push(`Sleep ${formatDuration(sleep.sleep_duration_min)}`);
    if (sleep?.sleep_score != null) parts.push(`SleepScore ${sleep.sleep_score.toFixed(0)}`);
    if (activity?.strain_score != null) parts.push(`Strain ${activity.strain_score.toFixed(1)}`);
    if (activity?.steps != null) parts.push(`${activity.steps.toLocaleString()} steps`);
    lines.push('- ' + parts.join(' | '));
  }

  return lines.join('\n');
}
