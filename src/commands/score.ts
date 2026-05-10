import { computeAndSaveScore, getUnlockedAchievements } from '../ai/scoring';
import { getAuditLog } from '../ai/audit';
import { todayDateString } from '../utils/normalize';
import { blank, dim, val, good, bar, DOT, footer, heading, scoreWithLabel, padColumns } from '../utils/format';

export async function runScore(): Promise<void> {
  const date         = todayDateString();
  const score        = computeAndSaveScore(date);
  const achievements = getUnlockedAchievements();

  blank();

  // ── Main score ─────────────────────────────────────────────────────────────
  console.log(heading('Readiness Score'));
  console.log('  ' + scoreWithLabel(score.score) + '  ' + bar(score.score, 24));
  console.log('  ' + dim(score.label));
  blank();

  // ── Component breakdown ────────────────────────────────────────────────────
  const metrics: [string, string][] = [];
  if (score.recovery_score != null)
    metrics.push([dim('recovery'), val(score.recovery_score.toFixed(0))]);
  if (score.sleep_score != null)
    metrics.push([dim('sleep'), val(score.sleep_score.toFixed(0))]);
  if (score.hrv_ms != null)
    metrics.push([dim('hrv'), val(score.hrv_ms.toFixed(0) + 'ms')]);
  if (score.sleep_duration_min != null) {
    const h = Math.floor(score.sleep_duration_min / 60);
    const m = Math.round(score.sleep_duration_min % 60);
    metrics.push([dim('sleep duration'), val(`${h}h ${m}m`)]);
  }

  if (metrics.length) {
    console.log(padColumns(metrics));
    blank();
  }

  // ── Streaks ────────────────────────────────────────────────────────────────
  const streaks = [
    { label: 'recovery ≥ 67', days: score.streak_recovery },
    { label: 'sleep ≥ 7h',    days: score.streak_sleep },
    { label: 'training',       days: score.streak_training },
  ].filter(s => s.days > 0);

  if (streaks.length) {
    console.log(heading('Streaks'));
    for (const s of streaks) {
      const icon = s.days >= 7 ? '🔥' : s.days >= 3 ? '⚡' : dim('·');
      console.log('  ' + icon + ' ' + val(String(s.days) + 'd') + dim('  ' + s.label));
    }
    blank();
  }

  // ── Achievements ───────────────────────────────────────────────────────────
  if (achievements.length) {
    console.log(heading('Achievements'));
    for (const a of achievements) {
      console.log(good('  ✓') + '  ' + val(a.name) + dim('  ' + a.description));
    }
    blank();
  }

  // ── Recent AI calls ────────────────────────────────────────────────────────
  const log = getAuditLog(5);
  if (log.length) {
    console.log(heading('Recent AI Calls'));
    for (const entry of log) {
      const tokens = entry.prompt_tokens != null
        ? dim(` · ${entry.prompt_tokens + (entry.completion_tokens ?? 0)} tokens`)
        : '';
      console.log(
        '  ' +
        dim(entry.called_at.slice(0, 16)) + DOT +
        val(entry.type) +
        dim(' · ' + entry.provider + ' / ' + entry.model) +
        tokens
      );
    }
    blank();
  }

  footer(['lumen', 'try: lumen ask "what should I focus on today?"']);
}
