import chalk from 'chalk';
import { formatDuration, formatHeight, todayDateString } from './normalize';
import type { HealthData, Profile } from '../db/schema';

// ─── Palette ──────────────────────────────────────────────────────────────────

const GREEN  = '#22c55e';
const YELLOW = '#fbbf24';
const RED    = '#ef4444';
const DIM    = '#4b5563';
const MUTED  = '#6b7280';
const WHITE  = '#f9fafb';
const SOFT   = '#d1d5db';

// ─── Core color helpers ───────────────────────────────────────────────────────

export function dim(s: string): string    { return chalk.hex(MUTED)(s); }
export function val(s: string): string    { return chalk.hex(WHITE)(s); }
export function good(s: string): string   { return chalk.hex(GREEN)(s); }
export function warn(s: string): string   { return chalk.hex(YELLOW)(s); }
export function bad(s: string): string    { return chalk.hex(RED)(s); }
export function heading(s: string): string { return chalk.bold(chalk.hex(WHITE)(s)); }
export function blank(): void { console.log(''); }

// ─── Score coloring ───────────────────────────────────────────────────────────

export function scoreColor(score: number): string {
  if (score >= 67) return chalk.hex(GREEN)(score.toFixed(0));
  if (score >= 34) return chalk.hex(YELLOW)(score.toFixed(0));
  return chalk.hex(RED)(score.toFixed(0));
}

export function scoreWithLabel(score: number): string {
  return scoreColor(score) + chalk.hex(DIM)('/100');
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

export function bar(pct: number, width = 16): string {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled  = Math.round((clamped / 100) * width);
  const color   = pct >= 67 ? GREEN : pct >= 34 ? YELLOW : RED;
  return (
    chalk.hex(color)('█'.repeat(filled)) +
    chalk.hex(DIM)('░'.repeat(width - filled)) +
    '  ' + chalk.hex(DIM)(Math.round(pct) + '%')
  );
}

// ─── ANSI-aware column alignment ─────────────────────────────────────────────

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

export function padColumns(rows: [string, string][], gap = 2): string {
  const maxLeft = Math.max(...rows.map(([l]) => stripAnsi(l).length));
  return rows.map(([left, right]) => {
    const pad = maxLeft - stripAnsi(left).length + gap;
    return '  ' + left + ' '.repeat(pad) + right;
  }).join('\n');
}

// ─── Inline separators ────────────────────────────────────────────────────────

export const DOT = chalk.hex(DIM)(' · ');

// ─── Date line ────────────────────────────────────────────────────────────────

export function dateLine(dateStr: string): void {
  const d = new Date(dateStr + 'T00:00:00');
  const label = d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  }).toLowerCase();
  console.log(dim(label));
}

// ─── Footer ───────────────────────────────────────────────────────────────────

export function footer(parts: string[]): void {
  console.log(dim(parts.join(' · ')));
}

// ─── Status card ──────────────────────────────────────────────────────────────

export function printStatusCard(opts: {
  date: string;
  recovery?: HealthData;
  sleep?: HealthData;
  activity?: HealthData;
  stale?: boolean;
}): void {
  const { date, recovery, sleep, activity, stale } = opts;

  dateLine(date);

  if (stale) {
    blank();
    console.log(
      warn('⚠') + '  ' +
      dim('data from ' + date + ' · run ') +
      val('lumen sync') +
      dim(' to update')
    );
  }

  blank();

  // ── Recovery / Vitals ───────────────────────────────────────────────────────
  const hasScore = recovery?.recovery_score != null;
  const hasHrv   = recovery?.hrv_ms != null;
  const hasRhr   = recovery?.resting_hr_bpm != null;
  const hasSpo2  = recovery?.spo2_pct != null;

  if (recovery && (hasScore || hasHrv || hasRhr || hasSpo2)) {
    console.log(heading(hasScore ? 'Recovery' : 'Vitals'));

    if (hasScore) {
      console.log('  ' + scoreWithLabel(recovery.recovery_score!) + '  ' + bar(recovery.recovery_score!));
    }

    const vitals: string[] = [];
    if (hasHrv)  vitals.push(dim('hrv ')  + val(recovery.hrv_ms!.toFixed(0) + 'ms'));
    if (hasRhr)  vitals.push(dim('rhr ')  + val(recovery.resting_hr_bpm!.toFixed(0) + 'bpm'));
    if (hasSpo2) vitals.push(dim('spo2 ') + val(recovery.spo2_pct!.toFixed(1) + '%'));
    if (vitals.length) console.log('  ' + vitals.join(DOT));
    blank();
  }

  // ── Sleep ───────────────────────────────────────────────────────────────────
  const hasSleepScore = sleep?.sleep_score != null;
  const hasDuration   = sleep?.sleep_duration_min != null;

  if (sleep && (hasSleepScore || hasDuration)) {
    console.log(heading('Sleep'));

    if (hasSleepScore) {
      console.log('  ' + scoreWithLabel(sleep.sleep_score!) + '  ' + bar(sleep.sleep_score!));
    }

    const dur: string[] = [];
    if (hasDuration) dur.push(val(formatDuration(sleep.sleep_duration_min!)));
    if (sleep.sleep_efficiency_pct != null)
      dur.push(val(sleep.sleep_efficiency_pct.toFixed(0) + '%') + dim(' efficient'));
    if (dur.length) console.log('  ' + dur.join(DOT));

    // Sleep stages
    if (sleep.sleep_duration_min) {
      const total  = sleep.sleep_duration_min;
      const stages = [
        { label: 'deep ', min: sleep.sleep_deep_min },
        { label: 'rem  ', min: sleep.sleep_rem_min },
        { label: 'light', min: sleep.sleep_light_min },
      ].filter(s => s.min != null);

      if (stages.length) {
        blank();
        for (const s of stages) {
          const pct = (s.min! / total) * 100;
          console.log(
            '  ' + dim(s.label) + '  ' +
            val(formatDuration(s.min!)) +
            '  ' + bar(pct, 12)
          );
        }
      }
    }
    blank();
  }

  // ── Activity ────────────────────────────────────────────────────────────────
  const hasStrain  = activity?.strain_score != null;
  const hasSteps   = activity?.steps != null;
  const hasCals    = activity?.calories_total != null;
  const hasMinutes = activity?.active_minutes != null;

  if (activity && (hasStrain || hasSteps || hasCals || hasMinutes)) {
    console.log(heading('Activity'));

    const parts: string[] = [];
    if (hasStrain)  parts.push(dim('strain ') + scoreColor(activity.strain_score! * (100 / 21)));
    if (hasSteps)   parts.push(val(activity.steps!.toLocaleString()) + dim(' steps'));
    if (hasCals)    parts.push(val(Math.round(activity.calories_total!).toLocaleString()) + dim(' kcal'));
    if (hasMinutes) parts.push(val(Math.round(activity.active_minutes!) + 'min') + dim(' active'));
    if (parts.length) console.log('  ' + parts.join(DOT));
    blank();
  }
}

// ─── History table ────────────────────────────────────────────────────────────

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
  const today = todayDateString();
  console.log(dim('last 7 days'));
  blank();

  for (const r of rows) {
    const hasData =
      r.recovery_score != null || r.sleep_score != null ||
      r.sleep_duration_min != null || r.hrv_ms != null ||
      r.resting_hr_bpm != null || r.strain_score != null ||
      r.steps != null;

    if (!hasData) {
      const label = r.date === today ? dim('no data yet') : dim('no data');
      console.log(chalk.hex(WHITE)(r.date) + DOT + label);
      continue;
    }

    const parts: string[] = [chalk.hex(WHITE)(r.date)];
    if (r.recovery_score != null)
      parts.push(dim('recovery ') + scoreColor(r.recovery_score) + dim('/100'));
    if (r.sleep_score != null)
      parts.push(dim('sleep ') + scoreColor(r.sleep_score) + dim('/100'));
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
      continue;
    }

    // Section headers
    if (/^#{1,3}\s+/.test(line)) {
      console.log(heading(line.replace(/^#{1,3}\s+/, '')));
      continue;
    }

    // Bullet points
    if (/^\s*[-•]\s/.test(line)) {
      let body = line.replace(/^\s*[-•]\s/, '');
      body = formatInline(body);
      console.log(dim('  · ') + chalk.hex(SOFT)(body));
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      console.log(dim('  ') + chalk.hex(SOFT)(formatInline(line)));
      continue;
    }

    // Default body
    console.log(chalk.hex(SOFT)(formatInline(line)));
  }
  blank();
}

function formatInline(line: string): string {
  // Bold **text**
  line = line.replace(/\*\*(.+?)\*\*/g, (_, t) => chalk.bold(t));
  // Inline `code`
  line = line.replace(/`([^`]+)`/g, (_, t) => chalk.hex('#22d3ee')(t));
  // Percentages → yellow
  line = line.replace(/(\d+(?:\.\d+)?%)/g, m => chalk.hex(YELLOW)(m));
  return line;
}

// ─── Error / success ──────────────────────────────────────────────────────────

export function printError(msg: string, action?: string): void {
  console.error(bad('✗') + '  ' + chalk.hex(SOFT)(msg));
  if (action) console.error('   ' + dim(action));
}

export function printSuccess(msg: string): void {
  console.log(good('✓') + '  ' + chalk.hex(SOFT)(msg));
}

export function printInfo(msg: string): void {
  console.log(dim(msg));
}

export function printWarning(msg: string): void {
  console.log(warn('⚠') + '  ' + chalk.hex(SOFT)(msg));
}

// ─── Profile print ────────────────────────────────────────────────────────────

export function printProfile(profile: Profile): void {
  const goal  = profile.health_goal.replace(/_/g, ' ');
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
