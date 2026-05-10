import ora from 'ora';
import chalk from 'chalk';
import { getProfile, getHealthDataForDate, getLatestHealthData } from '../db/queries';
import { askLumen } from '../ai/agent';
import { todayDateString } from '../utils/normalize';
import { printAiResponse, printError, blank, dim, footer } from '../utils/format';

export async function runAsk(question: string): Promise<void> {
  const profile = getProfile();
  if (!profile) { printError('run lumen setup first'); process.exit(1); }
  if (!question.trim()) { printError('provide a question — lumen ask "am I ready to train?"'); process.exit(1); }

  blank();
  console.log(chalk.hex('#6b7280')('"') + chalk.hex('#f9fafb')(question) + chalk.hex('#6b7280')('"'));
  blank();

  const spinner = ora({ text: '', prefixText: dim('thinking'), color: 'white' }).start();

  try {
    const answer = await askLumen(question, {
      profile,
      today:   getHealthDataForDate(todayDateString()),
      history: getLatestHealthData(7),
    });
    spinner.stop();
    printAiResponse(answer);
    footer(['lumen', 'lumen plan for a full day plan']);
  } catch (err) {
    spinner.stop();
    printError((err as Error).message);
    process.exit(1);
  }
}
