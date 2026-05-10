import ora from 'ora';
import { getProfile, getHealthDataForDate, getLatestHealthData } from '../db/queries';
import { generateDailyPlan } from '../ai/agent';
import { todayDateString } from '../utils/normalize';
import { printAiResponse, printError, blank, dim, footer, dateLine } from '../utils/format';
import { ensureAiReady } from '../utils/checkAi';

export async function runPlan(): Promise<void> {
  const profile = getProfile();
  if (!profile) { printError('run lumen setup first'); process.exit(1); }

  const today   = getHealthDataForDate(todayDateString());
  const history = getLatestHealthData(7);

  await ensureAiReady();

  blank();
  dateLine(todayDateString());
  blank();

  const spinner = ora({ text: '', prefixText: dim('building your plan'), color: 'white' }).start();

  try {
    const plan = await generateDailyPlan({ profile, today, history });
    spinner.stop();
    printAiResponse(plan);
    footer(['lumen', 'lumen ask "..." for follow-up questions']);
  } catch (err) {
    spinner.stop();
    printError((err as Error).message);
    process.exit(1);
  }
}
