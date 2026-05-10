import { getDb } from './schema';
import type { Profile, OAuthToken, HealthData, HealthGoal, ActivityLevel, Gender } from './schema';

// node:sqlite StatementSync returns plain objects; we cast to our types.

// ─── Profile ──────────────────────────────────────────────────────────────────

export function getProfile(): Profile | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM profile WHERE id = 1');
  const row = stmt.get() as Profile | undefined;
  return row ?? null;
}

export function upsertProfile(data: {
  name: string;
  age: number;
  gender: Gender;
  height_in: number;
  weight_lbs: number;
  health_goal: HealthGoal;
  activity_level: ActivityLevel;
}): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO profile (id, name, age, gender, height_in, weight_lbs, health_goal, activity_level, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      age = excluded.age,
      gender = excluded.gender,
      height_in = excluded.height_in,
      weight_lbs = excluded.weight_lbs,
      health_goal = excluded.health_goal,
      activity_level = excluded.activity_level,
      updated_at = datetime('now')
  `).run(data.name, data.age, data.gender, data.height_in, data.weight_lbs, data.health_goal, data.activity_level);
}

// ─── OAuth Tokens ─────────────────────────────────────────────────────────────

export function getToken(provider: string): OAuthToken | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM oauth_tokens WHERE provider = ?').get(provider) as OAuthToken | undefined;
  return row ?? null;
}

export function upsertToken(token: Omit<OAuthToken, 'updated_at'>): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO oauth_tokens (provider, access_token, refresh_token, expires_at, scope, extra, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(provider) DO UPDATE SET
      access_token  = excluded.access_token,
      refresh_token = excluded.refresh_token,
      expires_at    = excluded.expires_at,
      scope         = excluded.scope,
      extra         = excluded.extra,
      updated_at    = datetime('now')
  `).run(
    token.provider,
    token.access_token,
    token.refresh_token ?? null,
    token.expires_at ?? null,
    token.scope ?? null,
    token.extra ?? null
  );
}

export function deleteToken(provider: string): void {
  const db = getDb();
  db.prepare('DELETE FROM oauth_tokens WHERE provider = ?').run(provider);
}

// ─── Health Data ──────────────────────────────────────────────────────────────

export function upsertHealthData(data: HealthData): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO health_data (
      date, source, data_type,
      sleep_duration_min, sleep_efficiency_pct, sleep_score,
      sleep_deep_min, sleep_rem_min, sleep_light_min, sleep_awake_min,
      recovery_score, hrv_ms, resting_hr_bpm, spo2_pct, skin_temp_c,
      strain_score, calories_total, calories_active, steps, active_minutes, distance_km,
      raw_json, synced_at
    ) VALUES (
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, datetime('now')
    )
    ON CONFLICT(date, source, data_type) DO UPDATE SET
      sleep_duration_min   = excluded.sleep_duration_min,
      sleep_efficiency_pct = excluded.sleep_efficiency_pct,
      sleep_score          = excluded.sleep_score,
      sleep_deep_min       = excluded.sleep_deep_min,
      sleep_rem_min        = excluded.sleep_rem_min,
      sleep_light_min      = excluded.sleep_light_min,
      sleep_awake_min      = excluded.sleep_awake_min,
      recovery_score       = excluded.recovery_score,
      hrv_ms               = excluded.hrv_ms,
      resting_hr_bpm       = excluded.resting_hr_bpm,
      spo2_pct             = excluded.spo2_pct,
      skin_temp_c          = excluded.skin_temp_c,
      strain_score         = excluded.strain_score,
      calories_total       = excluded.calories_total,
      calories_active      = excluded.calories_active,
      steps                = excluded.steps,
      active_minutes       = excluded.active_minutes,
      distance_km          = excluded.distance_km,
      raw_json             = excluded.raw_json,
      synced_at            = datetime('now')
  `).run(
    data.date, data.source, data.data_type,
    data.sleep_duration_min ?? null,
    data.sleep_efficiency_pct ?? null,
    data.sleep_score ?? null,
    data.sleep_deep_min ?? null,
    data.sleep_rem_min ?? null,
    data.sleep_light_min ?? null,
    data.sleep_awake_min ?? null,
    data.recovery_score ?? null,
    data.hrv_ms ?? null,
    data.resting_hr_bpm ?? null,
    data.spo2_pct ?? null,
    data.skin_temp_c ?? null,
    data.strain_score ?? null,
    data.calories_total ?? null,
    data.calories_active ?? null,
    data.steps ?? null,
    data.active_minutes ?? null,
    data.distance_km ?? null,
    data.raw_json ?? null
  );
}

export function getHealthDataForDate(date: string): HealthData[] {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM health_data WHERE date = ? ORDER BY source, data_type'
  ).all(date) as unknown as HealthData[];
}

export function getHealthDataForRange(startDate: string, endDate: string): HealthData[] {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM health_data WHERE date BETWEEN ? AND ? ORDER BY date DESC, source, data_type'
  ).all(startDate, endDate) as unknown as HealthData[];
}

export function getLatestHealthData(days: number = 7): HealthData[] {
  const db = getDb();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const start = startDate.toISOString().split('T')[0];
  return db.prepare(
    "SELECT * FROM health_data WHERE date >= ? ORDER BY date DESC, source, data_type"
  ).all(start) as unknown as HealthData[];
}

// ─── Config ───────────────────────────────────────────────────────────────────

export function getConfig(key: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setConfig(key: string, value: string): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO config (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).run(key, value);
}

export function deleteConfig(key: string): void {
  const db = getDb();
  db.prepare('DELETE FROM config WHERE key = ?').run(key);
}

// ─── Memory ───────────────────────────────────────────────────────────────────

export function addMemory(content: string): void {
  const db = getDb();
  db.prepare("INSERT INTO memory (content) VALUES (?)").run(content.trim());
}

export function getMemories(): string[] {
  const db = getDb();
  const rows = db.prepare("SELECT content FROM memory ORDER BY created_at DESC").all() as { content: string }[];
  return rows.map(r => r.content);
}

export function deleteMemory(id: number): void {
  const db = getDb();
  db.prepare("DELETE FROM memory WHERE id = ?").run(id);
}

export function listMemories(): { id: number; content: string; created_at: string }[] {
  const db = getDb();
  return db.prepare("SELECT id, content, created_at FROM memory ORDER BY created_at DESC").all() as { id: number; content: string; created_at: string }[];
}

export function getLinkedProviders(): string[] {
  const db = getDb();
  const rows = db.prepare('SELECT provider FROM oauth_tokens').all() as { provider: string }[];
  return rows.map(r => r.provider);
}
