import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import { connectGarmin, isGarminConnected } from '../integrations/garmin';
import { deleteToken } from '../db/queries';
import { printSuccess, printError, printInfo, blank, dim } from '../utils/format';

export async function linkGarmin(opts: { disconnect?: boolean } = {}): Promise<void> {
  blank();

  if (opts.disconnect) {
    deleteToken('garmin');
    printSuccess('Garmin disconnected.');
    return;
  }

  if (isGarminConnected()) {
    printInfo('Garmin is already connected.');
    console.log(dim('\n  run lumen link garmin --disconnect to remove it\n'));
    return;
  }

  console.log(chalk.hex('#f9fafb')('connect garmin\n'));
  console.log(dim('your credentials are stored locally in ~/.lumen/db.sqlite\nnever sent anywhere except garmin.com\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'username',
      message: 'Garmin Connect email',
      validate: (v: string) => v.includes('@') || 'enter a valid email',
    },
    {
      type: 'password',
      name: 'password',
      message: 'password',
      mask: '•',
      validate: (v: string) => v.length > 0 || 'required',
    },
  ]);

  const spinner = ora({ text: 'connecting...', color: 'white' }).start();

  try {
    await connectGarmin(answers.username, answers.password);
    spinner.succeed(chalk.hex('#22c55e')('garmin connected'));
    console.log(dim('\nrun lumen sync to pull your data\n'));
  } catch (err) {
    spinner.fail(chalk.hex('#ef4444')('connection failed'));
    printError((err as Error).message);
    process.exit(1);
  }
}
