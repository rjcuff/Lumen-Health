#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { getProfile } from './db/queries';
import { runSetup } from './commands/setup';
import { linkGarmin } from './commands/link';
import { runStatus } from './commands/status';
import { runAsk } from './commands/ask';
import { runPlan } from './commands/plan';
import { runSync } from './commands/sync';
import { runHistory } from './commands/history';
import { runRemember } from './commands/remember';
import { runDoctor } from './commands/doctor';
import { runDemo } from './commands/demo';
import { runScore } from './commands/score';
import { runRecovery } from './commands/recovery';
import { runGoals } from './commands/goals';

// ─── First-run detection ──────────────────────────────────────────────────────

function checkFirstRun(): boolean {
  try {
    const profile = getProfile();
    return profile === null;
  } catch {
    return true;
  }
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name('lumen')
  .description(chalk.hex('#6366f1')('◉ Lumen') + ' — personal health advisor in the terminal')
  .version('1.0.0', '-v, --version')
  .addHelpText('before', '\n' + chalk.bold.hex('#6366f1')('  ◉  LUMEN') + chalk.hex('#9ca3af')('  personal health advisor') + '\n');

// ─── setup ────────────────────────────────────────────────────────────────────

program
  .command('setup')
  .description('Set up or update your health profile')
  .option('--reset', 'Reset and re-run the full setup')
  .action(async (opts) => {
    await runSetup({ force: opts.reset });
  });

// ─── link ─────────────────────────────────────────────────────────────────────

const link = program
  .command('link')
  .description('Connect a health data source');

link
  .command('garmin')
  .description('Connect your Garmin Connect account')
  .option('--disconnect', 'Remove Garmin connection')
  .action(async (opts) => {
    await guardSetup();
    await linkGarmin(opts);
  });

link
  .command('whoop')
  .description('WHOOP support — coming soon')
  .action(async () => {
    console.log('');
    console.log(chalk.hex('#f9fafb')('whoop support coming soon'));
    console.log(chalk.hex('#4b5563')('\nfor now, connect garmin: lumen link garmin\n'));
  });

// ─── sync ─────────────────────────────────────────────────────────────────────

program
  .command('sync')
  .description('Pull latest data from all connected devices')
  .option('--days <n>', 'Number of days to sync', '7')
  .action(async (opts) => {
    await guardSetup();
    await runSync({ days: parseInt(opts.days, 10) });
  });

// ─── status ───────────────────────────────────────────────────────────────────

program
  .command('status')
  .description("Show today's health summary")
  .action(async () => {
    await guardSetup();
    await runStatus();
  });

// ─── history ──────────────────────────────────────────────────────────────────

program
  .command('history')
  .description('Show last 7 days of sleep, recovery, and strain')
  .action(async () => {
    await guardSetup();
    await runHistory();
  });

// ─── ask ──────────────────────────────────────────────────────────────────────

program
  .command('ask [question...]')
  .description('Ask your AI health advisor a question')
  .action(async (words: string[]) => {
    await guardSetup();
    await runAsk(words.join(' '));
  });

// ─── plan ─────────────────────────────────────────────────────────────────────

program
  .command('plan')
  .description('Generate a personalized daily plan based on your data')
  .action(async () => {
    await guardSetup();
    await runPlan();
  });

// ─── remember ─────────────────────────────────────────────────────────────────

program
  .command('remember [note]')
  .description('Save context that Lumen will use in every AI response')
  .action(async (note?: string) => {
    await guardSetup();
    await runRemember(note);
  });

// ─── score ────────────────────────────────────────────────────────────────────

program
  .command('score')
  .description('Daily readiness score, streaks, achievements, and AI audit log')
  .action(async () => {
    await guardSetup();
    await runScore();
  });

// ─── recovery ─────────────────────────────────────────────────────────────────

program
  .command('recovery')
  .description('Show 7-day recovery trend — HRV, RHR, and recovery scores')
  .action(async () => {
    await guardSetup();
    await runRecovery();
  });

// ─── goals ────────────────────────────────────────────────────────────────────

program
  .command('goals [subcommand] [args...]')
  .description('Set and track your health and training goals')
  .action(async (subcommand?: string, args?: string[]) => {
    await guardSetup();
    await runGoals(subcommand, args);
  });

// ─── demo ─────────────────────────────────────────────────────────────────────

program
  .command('demo')
  .description('Seed realistic fake data so you can try every command without a device')
  .action(async () => {
    await runDemo();
  });

// ─── doctor ───────────────────────────────────────────────────────────────────

program
  .command('doctor')
  .description('Check what is configured and what still needs setup')
  .action(async () => {
    await runDoctor();
  });

// ─── Default: first-run detection ─────────────────────────────────────────────

async function guardSetup(): Promise<void> {
  if (checkFirstRun()) {
    console.log('');
    console.log(chalk.bold.hex('#6366f1')('  ◉  Welcome to Lumen!\n'));
    console.log(chalk.hex('#9ca3af')("  Looks like this is your first time. Let's set up your profile.\n"));
    await runSetup();
    process.exit(0);
  }
}

// ─── Parse ────────────────────────────────────────────────────────────────────

program.parseAsync(process.argv).catch((err: Error) => {
  console.error('\n  ' + chalk.red('✗') + '  ' + chalk.red(err.message) + '\n');
  process.exit(1);
});
