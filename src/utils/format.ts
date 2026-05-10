import chalk from 'chalk';
import { formatDuration } from './normalize';

// ─── Palette ──────────────────────────────────────────────────────────────────

const DIM    = '#4b5563';
const MUTED  = '#6b7280';
const WHITE  = '#f9fafb';
const GREEN  = '#22c55e';
const YELLOW = '#fbbf24';
const RED    = '#ef4444';
const PURPLE = '#818cf8';

// ─── Score coloring ───────────────────────────────────────────────────────────

export function scoreColor(score: number): string {
  if (score >= 67) return chalk.hex(GREEN)(score.toFixed(0));
  if (score >= 34) return chalk.hex(YELLOW)(score.toFixed(0));
  return chalk.hex(RED)(score.toFixed(0));
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

export function bar(pct: number, width = 16): string {
  const filled = Math.round(Math.min(1, pct / 100) * width);
  const color = pct >= 67 ? GREEN : pct >= 34 ? YELLOW : RED;
  return (
    chalk.hex(color)('█'.repeat(filled)) +
    chalk.hex(DIM)('░'.repeat(width - filled))
  );
}

// ─── Inline separators ────────────────────────────────────────────────────────

export const DOT = chalk.hex(DIM)(' · ');

export function dim(s: string): string  { return chalk.hex(MUTED)(s); }
export function val(s: string): string  { return chalk.hex(WHITE)(s); }
export function good(s: string): string { return chalk.hex(GREEN)(s); }
export function warn(s: string): string { return chalk.hex(YELLOW)(s); }
export function bad(s: string): string  { return chalk.hex(RED)(s); }
export function accent(s: string): string { return chalk.hex(PURPLE)(s); }

export function blank(): void { console.log(''); }

// ─── Date line ────────────────────────────────────────────────────────────────

export function dateLine(dateStr: string): void {
  const d = new Date(dateStr + 'T00:00:00');
  const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toLowerCase();
  console.log(dim(label));
}

// ─── Footer ───────────────────────────────────────────────────────────────────

export function footer(parts: string[]): void {
  console.log(dim(parts.join(' · ')));
}

// ─── Status card (Ray-style) ──────────────────────────────────────────────────

import type { HealthData } from '../db/schema';

export function printStatusCard(opts: {
  date: string;
  recovery?: HealthData;
  sleep?: HealthData;
  activity?: HealthData;
}): void {
  const { date, recovery, sleep, activity } = opts;

  dateLine(date);
  blank();

  // Recovery row
  if (recovery) {
    const parts: string[] = [];
    if (recovery.recovery_score != null)
      parts.push(dim('recovery ') + scoreColor(recovery.recovery_score) + chalk.hex(DIM)('/100'));
    if (recovery.hrv_ms != null)
      parts.push(dim('hrv ') + val(recovery.hrv_ms.toFixed(0) + 'ms'));
    if (recovery.resting_hr_bpm != null)
      parts.push(dim('rhr ') + val(recovery.resting_hr_bpm.toFixed(0) + 'bpm'));
    if (recovery.spo2_pct != null)
      parts.push(dim('spo2 ') + val(recovery.spo2_pct.toFixed(1) + '%'));
    if (parts.length) console.log(parts.join(DOT));
  }

  // Sleep row
  if (sleep) {
    const parts: string[] = [];
    if (sleep.sleep_score != null)
      parts.push(dim('sleep ') + scoreColor(sleep.sleep_score) + chalk.hex(DIM)('/100'));
    if (sleep.sleep_duration_min != null)
      parts.push(val(formatDuration(sleep.sleep_duration_min)));
    if (sleep.sleep_efficiency_pct != null)
      parts.push(val(sleep.sleep_efficiency_pct.toFixed(0) + '%') + dim(' efficient'));
    if (parts.length) console.log(parts.join(DOT));
  }

  // Activity row
  if (activity) {
    const parts: string[] = [];
    if (activity.strain_score != null)
      parts.push(dim('strain ') + scoreColor(activity.strain_score * (100 / 21)));
    if (activity.steps != null)
      parts.push(val(activity.steps.toLocaleString()) + dim(' steps'));
    if (activity.calories_total != null)
      parts.push(val(Math.round(activity.calories_total).toLocaleString()) + dim(' kcal'));
    if (activity.active_minutes != null)
      parts.push(val(Math.round(activity.active_minutes) + 'min') + dim(' active'));
    if (parts.length) console.log(parts.join(DOT));
  }

  // Sleep stage bars
  if (sleep?.sleep_duration_min) {
    const total = sleep.sleep_duration_min;
    blank();
    const stages = [
      { label: 'deep ', min: sleep.sleep_deep_min },
      { label: 'rem  ', min: sleep.sleep_rem_min },
      { label: 'light', min: sleep.sleep_light_min },
    ];
    for (const s of stages) {
      if (s.min == null) continue;
      const pct = (s.min / total) * 100;
      console.log(
        bar(pct) + '  ' +
        dim(s.label) + '  ' +
        val(formatDuration(s.min)) +
        dim('  ' + pct.toFixed(0) + '%')
      );
    }
  }

  blank();
}

// ─── History table (Ray-style) ────────────────────────────────────────────────

export interface HistoryRow {
  date: string;
  recovery_score?: number;
  sleep_score?: number;
  sleep_duration_min?: number;
  hrv_ms?: number;
  resting_hr_bpm?: number;
  strain_score?: number;
  steps?: number;
}

export function printHistoryTable(rows: HistoryRow[]): void {
  console.log(dim('last 7 days'));
  blank();

  for (const r of rows) {
    const parts: string[] = [chalk.hex(WHITE)(r.date)];

    if (r.recovery_score != null)
      parts.push(dim('rec ') + scoreColor(r.recovery_score));
    if (r.sleep_score != null)
      parts.push(dim('sleep ') + scoreColor(r.sleep_score));
    if (r.sleep_duration_min != null)
      parts.push(val(formatDuration(r.sleep_duration_min)));
    if (r.hrv_ms != null)
      parts.push(dim('hrv ') + val(r.hrv_ms.toFixed(0) + 'ms'));
    if (r.resting_hr_bpm != null)
      parts.push(dim('rhr ') + val(r.resting_hr_bpm.toFixed(0) + 'bpm'));
    if (r.strain_score != null)
      parts.push(dim('strain ') + val(r.strain_score.toFixed(1)));

    console.log(parts.join(DOT));
  }

  blank();
}

// ─── Doctor / status checks ───────────────────────────────────────────────────

export function printCheck(label: string, status: 'ok' | 'warn' | 'missing', detail: string, fix?: string): void {
  const icon = status === 'ok' ? good('✓') : status === 'warn' ? warn('⚠') : bad('✗');
  console.log(icon + '  ' + chalk.hex(WHITE)(label.padEnd(20)) + dim(detail));
  if (fix && status !== 'ok') {
    console.log('     ' + dim('→ ') + chalk.hex(WHITE)(fix));
  }
}

// ─── AI response ──────────────────────────────────────────────────────────────

export function printAiResponse(text: string): void {
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.trim() === '') {
      console.log('');
    } else if (line.startsWith('## ')) {
      console.log(chalk.hex(WHITE)(line.slice(3)));
    } else if (line.startsWith('# ')) {
      console.log(chalk.bold.hex(WHITE)(line.slice(2)));
    } else if (line.startsWith('**') && line.endsWith('**')) {
      console.log(chalk.hex(WHITE)(line.replace(/\*\*/g, '')));
    } else if (line.startsWith('- ') || line.startsWith('• ')) {
      console.log(dim('  · ') + chalk.hex(WHITE)(line.slice(2)));
    } else if (/^\d+\./.test(line)) {
      console.log(dim('  ') + chalk.hex(WHITE)(line));
    } else {
      console.log(chalk.hex('#d1d5db')(line));
    }
  }
  blank();
}

// ─── Error / success ──────────────────────────────────────────────────────────

export function printError(msg: string): void {
  console.error(bad('✗') + '  ' + chalk.hex('#d1d5db')(msg));
}

export function printSuccess(msg: string): void {
  console.log(good('✓') + '  ' + chalk.hex('#d1d5db')(msg));
}

export function printInfo(msg: string): void {
  console.log(dim(msg));
}

export function printWarning(msg: string): void {
  console.log(warn('⚠') + '  ' + chalk.hex('#d1d5db')(msg));
}

// ─── Profile print ────────────────────────────────────────────────────────────

import type { Profile } from '../db/schema';
import { formatHeight } from './normalize';

export function printProfile(profile: Profile): void {
  const goal = profile.health_goal.replace(/_/g, ' ');
  const level = profile.activity_level;
  console.log(
    val(profile.name) + DOT +
    val(String(profile.age) + 'y') + DOT +
    dim(profile.gender) + DOT +
    dim(formatHeight(profile.height_in)) + DOT +
    dim(profile.weight_lbs + 'lbs')
  );
  console.log(dim(goal) + DOT + dim(level));
  blank();
}
