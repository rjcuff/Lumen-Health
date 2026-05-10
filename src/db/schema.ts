import { DatabaseSync } from 'node:sqlite';

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const LUMEN_DIR = path.join(os.homedir(), '.lumen');
const DB_PATH = path.join(LUMEN_DIR, 'db.sqlite');

let _db: InstanceType<typeof DatabaseSync> | null = null;

export function getDb(): InstanceType<typeof DatabaseSync> {
  if (_db) return _db;

  if (!fs.existsSync(LUMEN_DIR)) {
    fs.mkdirSync(LUMEN_DIR, { recursive: true });
  }

  _db = new DatabaseSync(DB_PATH);

  _db.exec('PRAGMA journal_mode = WAL');
  _db.exec('PRAGMA foreign_keys = ON');

  initSchema(_db);
  return _db;
}

export function getLumenDir(): string {
  return LUMEN_DIR;
}

function initSchema(db: InstanceType<typeof DatabaseSync>): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profile (
      id          INTEGER PRIMARY KEY,
      name        TEXT    NOT NULL,
      age         INTEGER NOT NULL,
      gender      TEXT    NOT NULL,
      height_in   REAL    NOT NULL,
      weight_lbs  REAL    NOT NULL,
      health_goal TEXT    NOT NULL,
      activity_level TEXT NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS oauth_tokens (
      provider    TEXT PRIMARY KEY,
      access_token  TEXT NOT NULL,
      refresh_token TEXT,
      expires_at    TEXT,
      scope         TEXT,
      extra         TEXT,
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS health_data (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      date        TEXT    NOT NULL,
      source      TEXT    NOT NULL,
      data_type   TEXT    NOT NULL,

      sleep_duration_min   REAL,
      sleep_efficiency_pct REAL,
      sleep_score          REAL,
      sleep_deep_min       REAL,
      sleep_rem_min        REAL,
      sleep_light_min      REAL,
      sleep_awake_min      REAL,

      recovery_score       REAL,
      hrv_ms               REAL,
      resting_hr_bpm       REAL,
      spo2_pct             REAL,
      skin_temp_c          REAL,

      strain_score         REAL,
      calories_total       REAL,
      calories_active      REAL,
      steps                INTEGER,
      active_minutes       REAL,
      distance_km          REAL,

      raw_json    TEXT,
      synced_at   TEXT NOT NULL DEFAULT (datetime('now')),

      UNIQUE(date, source, data_type)
    );

    CREATE INDEX IF NOT EXISTS idx_health_data_date
      ON health_data(date DESC);

    CREATE INDEX IF NOT EXISTS idx_health_data_source
      ON health_data(source, date DESC);

    CREATE TABLE IF NOT EXISTS config (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS memory (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      content    TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_audit_log (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      type              TEXT NOT NULL,
      provider          TEXT NOT NULL,
      model             TEXT NOT NULL,
      prompt_tokens     INTEGER,
      completion_tokens INTEGER,
      called_at         TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS daily_scores (
      date              TEXT PRIMARY KEY,
      score             INTEGER NOT NULL,
      recovery_score    REAL,
      sleep_score       REAL,
      hrv_ms            REAL,
      sleep_duration_min REAL,
      streak_recovery   INTEGER NOT NULL DEFAULT 0,
      streak_sleep      INTEGER NOT NULL DEFAULT 0,
      streak_training   INTEGER NOT NULL DEFAULT 0
    );
  `);
}

export type HealthGoal = 'weight_loss' | 'athletic_performance' | 'longevity' | 'general_wellness';
export type ActivityLevel = 'sedentary' | 'moderate' | 'active' | 'athlete';
export type Gender = 'male' | 'female' | 'other';
export type DataSource = 'whoop' | 'garmin';
export type DataType = 'sleep' | 'recovery' | 'activity';

export interface Profile {
  id: number;
  name: string;
  age: number;
  gender: Gender;
  height_in: number;
  weight_lbs: number;
  health_goal: HealthGoal;
  activity_level: ActivityLevel;
  created_at: string;
  updated_at: string;
}

export interface OAuthToken {
  provider: string;
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  scope?: string;
  extra?: string;
  updated_at: string;
}

export interface HealthData {
  id?: number;
  date: string;
  source: DataSource;
  data_type: DataType;
  sleep_duration_min?: number;
  sleep_efficiency_pct?: number;
  sleep_score?: number;
  sleep_deep_min?: number;
  sleep_rem_min?: number;
  sleep_light_min?: number;
  sleep_awake_min?: number;
  recovery_score?: number;
  hrv_ms?: number;
  resting_hr_bpm?: number;
  spo2_pct?: number;
  skin_temp_c?: number;
  strain_score?: number;
  calories_total?: number;
  calories_active?: number;
  steps?: number;
  active_minutes?: number;
  distance_km?: number;
  raw_json?: string;
  synced_at?: string;
}
