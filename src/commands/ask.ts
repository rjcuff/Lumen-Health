import ora from 'ora';
import chalk from 'chalk';
import { getProfile, getHealthDataForDate, getLatestHealthData } from '../db/queries';
import { askLumen } from '../ai/agent';
import { todayDateString } from '../utils/normalize';
import { printAiResponse, printError, blank, dim, footer } from '../utils/format';
import { ensureAiReady } from '../utils/checkAi';

export async function runAsk(question: string): Promise<void> {
  const profile = getProfile();
  if (!profile) {
    printError('run lumen setup first');
    process.exit(1);
  }
  if (!question.trim()) {
    printError('provide a question', 'example: lumen ask "am I ready to train today?"');
    process.exit(1);
  }

  await ensureAiReady();

  blank();
  console.log(chalk.hex('#4b5563')('❯ ') + chalk.hex('#f9fafb')(question));
  blank();

  const spinner = ora({
    text: chalk.hex('#6b7280')('thinking...'),
    color: 'white',
    spinner: 'dots',
  }).start();

  try {
    const answer = await askLumen(question, {
      profile,
      today:   getHealthDataForDate(todayDateString()),
      history: getLatestHealthData(7),
    });
    spinner.stop();
    printAiResponse(answer);
    footer(['lumen', 'try: lumen plan for a full day plan']);
  } catch (err) {
    spinner.stop();
    printError((err as Error).message);
    process.exit(1);
  }
}
