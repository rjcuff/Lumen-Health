import { createInterface } from 'readline';
import { getConfig, setConfig, getLatestHealthData } from '../db/queries';
import { computeAndSaveScore } from '../ai/scoring';
import { todayDateString } from '../utils/normalize';
import { blank, dim, val, good, warn, bad, DOT, footer, heading, scoreColor } from '../utils/format';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Goal {
  id: string;
  name: string;
  type: 'sleep_min' | 'recovery_score' | 'steps_daily' | 'rhr_max' | 'streak_recovery' | 'custom';
  target?: number;
  deadline?: string;
  created_at: string;
}

function loadGoals(): Goal[] {
  try {
    const raw = getConfig('goals');
    return raw ? (JSON.parse(raw) as Goal[]) : [];
  } catch {
    return [];
  }
}

function saveGoals(goals: Goal[]): void {
  setConfig('goals', JSON.stringify(goals));
}

// ─── Progress computation ─────────────────────────────────────────────────────

function computeProgress(goal: Goal): { value?: number; label: string; status: 'good' | 'warn' | 'bad' | 'none' } {
  if (goal.type === 'custom') return { label: '', status: 'none' };

  const records = getLatestHealthData(7);

  if (goal.type === 'sleep_min') {
    const durations = records
      .filter(r => r.data_type === 'sleep' && r.sleep_duration_min != null)
      .map(r => r.sleep_duration_min!);
    if (!durations.length) return { label: 'no sleep data', status: 'none' };
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const h   = Math.floor(avg / 60);
    const m   = Math.round(avg % 60);
    const status = avg >= (goal.target ?? 480) ? 'good' : avg >= (goal.target ?? 480) * 0.9 ? 'warn' : 'bad';
    return { value: avg, label: `${h}h ${m}m avg this week`, status };
  }

  if (goal.type === 'recovery_score') {
    const scores = records
      .filter(r => r.data_type === 'recovery' && r.recovery_score != null)
      .map(r => r.recovery_score!);
    if (!scores.length) return { label: 'no recovery data', status: 'none' };
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const status = avg >= (goal.target ?? 67) ? 'good' : avg >= (goal.target ?? 67) * 0.85 ? 'warn' : 'bad';
    return { value: avg, label: `${avg.toFixed(0)}/100 avg this week`, status };
  }

  if (goal.type === 'steps_daily') {
    const stepData = records
      .filter(r => r.data_type === 'activity' && r.steps != null)
      .map(r => r.steps!);
    if (!stepData.length) return { label: 'no activity data', status: 'none' };
    const avg = stepData.reduce((a, b) => a + b, 0) / stepData.length;
    const status = avg >= (goal.target ?? 10000) ? 'good' : avg >= (goal.target ?? 10000) * 0.8 ? 'warn' : 'bad';
    return { value: avg, label: `${Math.round(avg).toLocaleString()} avg steps/day`, status };
  }

  if (goal.type === 'rhr_max') {
    const rhrs = records
      .filter(r => r.data_type === 'recovery' && r.resting_hr_bpm != null)
      .map(r => r.resting_hr_bpm!);
    if (!rhrs.length) return { label: 'no rhr data', status: 'none' };
    const latest = rhrs[0];
    const status = latest <= (goal.target ?? 60) ? 'good' : latest <= (goal.target ?? 60) * 1.1 ? 'warn' : 'bad';
    return { value: latest, label: `currently ${latest.toFixed(0)}bpm`, status };
  }

  if (goal.type === 'streak_recovery') {
    const score = computeAndSaveScore(todayDateString());
    const current = score.streak_recovery;
    const status = current >= (goal.target ?? 7) ? 'good' : current >= Math.floor((goal.target ?? 7) / 2) ? 'warn' : 'bad';
    return { value: current, label: `${current}d streak`, status };
  }

  return { label: '', status: 'none' };
}

// ─── Display ──────────────────────────────────────────────────────────────────

function colorStatus(s: string, status: 'good' | 'warn' | 'bad' | 'none'): string {
  if (status === 'good') return good(s);
  if (status === 'warn') return warn(s);
  if (status === 'bad')  return bad(s);
  return dim(s);
}

const EMOJI: Record<Goal['type'], string> = {
  sleep_min:        '😴',
  recovery_score:   '💚',
  steps_daily:      '👟',
  rhr_max:          '❤️',
  streak_recovery:  '💪',
  custom:           '🎯',
};

// ─── Show goals ───────────────────────────────────────────────────────────────

export async function runGoals(subcommand?: string, args?: string[]): Promise<void> {
  if (subcommand === 'add') {
    await addGoal(args?.join(' '));
    return;
  }
  if (subcommand === 'remove' || subcommand === 'delete') {
    await removeGoal();
    return;
  }

  const goals = loadGoals();
  blank();

  if (goals.length === 0) {
    console.log(heading('Goals'));
    blank();
    console.log(dim('  no goals set yet'));
    blank();
    console.log(dim('  add one:') + '  ' + val('lumen goals add "run 5k in under 25min"'));
    blank();
    footer(['lumen', 'lumen goals add "..."']);
    return;
  }

  console.log(heading('Goals'));
  blank();

  for (const goal of goals) {
    const progress = computeProgress(goal);
    const emoji    = EMOJI[goal.type] ?? '🎯';

    const parts: string[] = [val(goal.name)];
    if (progress.label) parts.push(colorStatus(progress.label, progress.status));
    if (goal.deadline) {
      const daysOut = Math.ceil(
        (new Date(goal.deadline).getTime() - Date.now()) / 86400000
      );
      if (daysOut > 0) parts.push(dim(`${daysOut}d out`));
      else if (daysOut === 0) parts.push(warn('today'));
    }

    console.log('  ' + emoji + '  ' + parts.join(DOT));
  }

  blank();
  footer(['lumen', 'try: lumen ask "am I on track for my goals?"', 'lumen goals add "..."']);
}

// ─── Add goal (interactive) ───────────────────────────────────────────────────

const TYPE_MAP: Record<string, Goal['type']> = {
  '1': 'sleep_min',
  '2': 'recovery_score',
  '3': 'steps_daily',
  '4': 'rhr_max',
  '5': 'streak_recovery',
  '6': 'custom',
};

const TYPE_LABELS: Record<Goal['type'], string> = {
  sleep_min:       'Average nightly sleep duration',
  recovery_score:  'Average weekly recovery score',
  steps_daily:     'Daily step count',
  rhr_max:         'Resting heart rate target (lower is better)',
  streak_recovery: 'Recovery streak (consecutive days ≥ 67)',
  custom:          'Custom / free text goal',
};

const DEFAULT_TARGETS: Partial<Record<Goal['type'], number>> = {
  sleep_min:       480,
  recovery_score:  67,
  steps_daily:     10000,
  rhr_max:         55,
  streak_recovery: 7,
};

async function addGoal(nameArg?: string): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> =>
    new Promise(res => rl.question(q, res));

  blank();
  console.log(heading('Add a Goal'));
  blank();

  const name = nameArg?.trim() || await ask('  Goal name: ');
  if (!name) { rl.close(); return; }

  console.log('');
  console.log(dim('  Type:'));
  for (const [k, t] of Object.entries(TYPE_MAP)) {
    console.log(dim(`    ${k}. `) + val(TYPE_LABELS[t]));
  }
  console.log('');

  const typeChoice = await ask('  Choose type (1–6, default 6): ');
  const type: Goal['type'] = TYPE_MAP[typeChoice.trim()] ?? 'custom';

  let target: number | undefined;
  if (type !== 'custom') {
    const defaultTarget = DEFAULT_TARGETS[type];
    const targetStr = await ask(
      `  Target value (default ${defaultTarget}): `
    );
    target = targetStr.trim() ? parseFloat(targetStr) : defaultTarget;
  }

  const deadlineStr = await ask('  Deadline (YYYY-MM-DD, or leave blank): ');
  const deadline    = deadlineStr.trim() || undefined;

  rl.close();

  const goals = loadGoals();
  goals.push({
    id:         Date.now().toString(),
    name:       name.trim(),
    type,
    target,
    deadline,
    created_at: new Date().toISOString(),
  });
  saveGoals(goals);

  blank();
  console.log(good('✓') + '  goal added: ' + val(name.trim()));
  blank();
}

// ─── Remove goal (interactive) ────────────────────────────────────────────────

async function removeGoal(): Promise<void> {
  const goals = loadGoals();

  if (goals.length === 0) {
    blank();
    console.log(dim('  no goals to remove'));
    blank();
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> =>
    new Promise(res => rl.question(q, res));

  blank();
  console.log(heading('Remove a Goal'));
  blank();

  goals.forEach((g, i) => {
    console.log(dim(`  ${i + 1}. `) + val(g.name));
  });

  blank();
  const choice = await ask('  Which goal to remove (number): ');
  rl.close();

  const idx = parseInt(choice) - 1;
  if (isNaN(idx) || idx < 0 || idx >= goals.length) {
    blank();
    console.log(bad('✗') + '  invalid selection');
    blank();
    return;
  }

  const removed = goals.splice(idx, 1)[0];
  saveGoals(goals);

  blank();
  console.log(good('✓') + '  removed: ' + val(removed.name));
  blank();
}
