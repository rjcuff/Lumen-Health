import chalk from 'chalk';
import { computeAndSaveScore, getUnlockedAchievements } from '../ai/scoring';
import { getAuditLog } from '../ai/audit';
import { todayDateString } from '../utils/normalize';
import { blank, dim, val, good, warn, bad, bar, DOT, footer } from '../utils/format';

export async function runScore(): Promise<void> {
  const date  = todayDateString();
  const score = computeAndSaveScore(date);
  const achievements = getUnlockedAchievements();

  blank();

  // Main score line
  const scoreStr = score.score >= 67
    ? chalk.hex('#22c55e')(String(score.score))
    : score.score >= 34
      ? chalk.hex('#fbbf24')(String(score.score))
      : chalk.hex('#ef4444')(String(score.score));

  console.log(
    scoreStr + dim('/100') + DOT + dim(score.label) + DOT + dim(date)
  );
  console.log(bar(score.score, 24));

  blank();

  // Component breakdown
  if (score.recovery_score != null)
    console.log(dim('recovery  ') + val(score.recovery_score.toFixed(0)));
  if (score.sleep_score != null)
    console.log(dim('sleep     ') + val(score.sleep_score.toFixed(0)));
  if (score.hrv_ms != null)
    console.log(dim('hrv       ') + val(score.hrv_ms.toFixed(0) + 'ms'));
  if (score.sleep_duration_min != null) {
    const h = Math.floor(score.sleep_duration_min / 60);
    const m = Math.round(score.sleep_duration_min % 60);
    console.log(dim('sleep dur ') + val(`${h}h ${m}m`));
  }

  blank();

  // Streaks
  const streaks = [
    { label: 'recovery ≥ 67', days: score.streak_recovery },
    { label: 'sleep ≥ 7h',    days: score.streak_sleep },
    { label: 'training',       days: score.streak_training },
  ].filter(s => s.days > 0);

  if (streaks.length) {
    console.log(dim('streaks'));
    for (const s of streaks) {
      const icon = s.days >= 7 ? '🔥' : s.days >= 3 ? '⚡' : '·';
      console.log(dim('  ' + icon + ' ') + val(String(s.days) + 'd') + dim(' ' + s.label));
    }
    blank();
  }

  // Achievements
  if (achievements.length) {
    console.log(dim('achievements'));
    for (const a of achievements) {
      console.log(good('  ✓') + dim(' ') + val(a.name) + dim('  ' + a.description));
    }
    blank();
  }

  // Recent AI calls (audit log)
  const log = getAuditLog(5);
  if (log.length) {
    console.log(dim('recent ai calls'));
    for (const entry of log) {
      const tokens = entry.prompt_tokens != null
        ? dim(` · ${entry.prompt_tokens + (entry.completion_tokens ?? 0)} tokens`)
        : '';
      console.log(
        dim('  ' + entry.called_at.slice(0, 16)) +
        dim(' · ') + val(entry.type) +
        dim(' · ' + entry.provider + ' / ' + entry.model) +
        tokens
      );
    }
    blank();
  }

  footer(['lumen', 'lumen ask "what should I focus on today?"']);
}
