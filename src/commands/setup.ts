import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { upsertProfile, getProfile, setConfig, getConfig, getToken } from '../db/queries';
import { connectGarmin } from '../integrations/garmin';
import { blank } from '../utils/format';
import type { HealthGoal, ActivityLevel, Gender } from '../db/schema';

export async function runSetup(opts: { force?: boolean } = {}): Promise<void> {
  blank();
  const existing = getProfile();
  if (existing && !opts.force) {
    const hasKey = !!(process.env.ANTHROPIC_API_KEY ?? getConfig('anthropic_api_key'));
    const whoopLinked = !!getToken('whoop');
    const garminLinked = !!getToken('garmin');

    console.log(chalk.hex('#6b7280')(`  ${existing.name} · ${existing.age}y · ${existing.health_goal.replace(/_/g, ' ')}`));
    console.log(chalk.hex('#6b7280')(`  AI key ${hasKey ? chalk.green('✓') : chalk.red('✗')}  ·  WHOOP ${whoopLinked ? chalk.green('✓') : chalk.hex('#4b5563')('—')}  ·  Garmin ${garminLinked ? chalk.green('✓') : chalk.hex('#4b5563')('—')}`));
    blank();
    console.log(chalk.hex('#9ca3af')(`  Already set up. Run ${chalk.white('lumen setup --reset')} to start over.\n`));
    return;
  }

  if (existing && opts.force) {
    console.log(chalk.hex('#9ca3af')('  Resetting your profile.\n'));
  } else {
    console.log(chalk.bold.white('  Welcome. Let\'s get you set up.\n'));
    console.log(chalk.hex('#6b7280')('  Takes about 2 minutes. Everything stays on your machine.\n'));
  }

  // ── Profile ────────────────────────────────────────────────────────────────

  const profile = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'First name',
      validate: (v: string) => v.trim().length > 0 || 'Required',
      filter: (v: string) => v.trim(),
    },
    {
      type: 'number',
      name: 'age',
      message: 'Age',
      validate: (v: number) => (v >= 13 && v <= 120) || 'Enter a valid age',
    },
    {
      type: 'list',
      name: 'gender',
      message: 'Gender',
      choices: [
        { name: 'Male', value: 'male' },
        { name: 'Female', value: 'female' },
        { name: 'Other', value: 'other' },
      ],
    },
    {
      type: 'number',
      name: 'height_ft',
      message: 'Height — feet',
      validate: (v: number) => (v >= 3 && v <= 8) || 'Enter a valid height',
    },
    {
      type: 'number',
      name: 'height_in',
      message: 'Height — inches (0–11)',
      validate: (v: number) => (v >= 0 && v <= 11) || 'Enter 0–11',
    },
    {
      type: 'number',
      name: 'weight_lbs',
      message: 'Weight (lbs)',
      validate: (v: number) => (v >= 50 && v <= 700) || 'Enter a valid weight',
    },
    {
      type: 'list',
      name: 'health_goal',
      message: 'Primary goal',
      choices: [
        { name: 'Athletic performance', value: 'athletic_performance' },
        { name: 'Weight loss', value: 'weight_loss' },
        { name: 'Longevity', value: 'longevity' },
        { name: 'General wellness', value: 'general_wellness' },
      ],
    },
    {
      type: 'list',
      name: 'activity_level',
      message: 'Activity level',
      choices: [
        { name: 'Athlete (2× daily or competitive)', value: 'athlete' },
        { name: 'Active (hard exercise 5–6×/week)', value: 'active' },
        { name: 'Moderate (light exercise 3–4×/week)', value: 'moderate' },
        { name: 'Sedentary (desk job, little exercise)', value: 'sedentary' },
      ],
    },
  ]);

  upsertProfile({
    name: profile.name,
    age: profile.age,
    gender: profile.gender as Gender,
    height_in: profile.height_ft * 12 + profile.height_in,
    weight_lbs: profile.weight_lbs,
    health_goal: profile.health_goal as HealthGoal,
    activity_level: profile.activity_level as ActivityLevel,
  });

  // ── AI provider ────────────────────────────────────────────────────────────

  blank();

  const { aiProvider } = await inquirer.prompt([{
    type: 'list',
    name: 'aiProvider',
    message: 'AI provider',
    choices: [
      { name: 'Ollama  (free, runs locally — install from ollama.com)', value: 'ollama' },
      { name: 'Anthropic Claude  (best quality, requires API key)', value: 'anthropic' },
      { name: 'OpenAI / compatible endpoint', value: 'openai' },
    ],
    default: getConfig('ai_provider') ?? 'ollama',
  }]);

  setConfig('ai_provider', aiProvider);

  if (aiProvider === 'ollama') {
    const { ollamaModel } = await inquirer.prompt([{
      type: 'input',
      name: 'ollamaModel',
      message: 'Ollama model',
      default: getConfig('ai_model') ?? 'llama3.1',
    }]);
    setConfig('ai_model', ollamaModel);
    console.log(chalk.hex('#6b7280')(
      '\n  Make sure Ollama is running: ollama serve\n' +
      '  Pull a model if needed:      ollama pull ' + ollamaModel + '\n'
    ));
  } else if (aiProvider === 'anthropic') {
    const existingKey = process.env.ANTHROPIC_API_KEY ?? getConfig('anthropic_api_key');
    const { apiKey } = await inquirer.prompt([{
      type: 'password',
      name: 'apiKey',
      message: existingKey ? 'Anthropic API key (enter to keep existing)' : 'Anthropic API key',
      mask: '•',
    }]);
    const trimmed = (apiKey as string).trim();
    if (trimmed) setConfig('anthropic_api_key', trimmed);
    else if (!existingKey) console.log(chalk.hex('#6b7280')('\n  No key saved — get one at console.anthropic.com\n'));
    setConfig('ai_model', 'claude-sonnet-4-20250514');
  } else {
    const { baseUrl, apiKey, model } = await inquirer.prompt([
      { type: 'input',    name: 'baseUrl', message: 'Base URL', default: 'https://api.openai.com/v1' },
      { type: 'password', name: 'apiKey',  message: 'API key', mask: '•' },
      { type: 'input',    name: 'model',   message: 'Model', default: 'gpt-4o' },
    ]);
    if ((baseUrl as string).trim())  setConfig('ai_base_url', (baseUrl as string).trim());
    if ((apiKey as string).trim())   setConfig('openai_api_key', (apiKey as string).trim());
    if ((model as string).trim())    setConfig('ai_model', (model as string).trim());
  }

  // ── Devices ────────────────────────────────────────────────────────────────

  blank();
  console.log(chalk.hex('#6b7280')('  Connect a device (or skip and do it later with lumen link garmin).\n'));

  const { device } = await inquirer.prompt([{
    type: 'list',
    name: 'device',
    message: 'Connect a device now?',
    choices: [
      { name: 'Garmin', value: 'garmin' },
      { name: 'Skip for now', value: 'skip' },
    ],
  }]);

  if (device === 'garmin') {
    await setupGarmin();
  }

  // ── Done ──────────────────────────────────────────────────────────────────

  blank();
  console.log(chalk.green('  ✓') + chalk.white('  All set.\n'));

  const garminLinked = !!getToken('garmin');

  if (garminLinked) {
    console.log(chalk.hex('#6b7280')('  Run ') + chalk.white('lumen sync') + chalk.hex('#6b7280')(' to pull your data, then ') + chalk.white('lumen status') + chalk.hex('#6b7280')(' to see today.\n'));
  } else {
    console.log(chalk.hex('#6b7280')('  Run ') + chalk.white('lumen link garmin') + chalk.hex('#6b7280')(' when you\'re ready.\n'));
  }
}

// ─── Inline WHOOP setup ───────────────────────────────────────────────────────

// ─── Inline Garmin setup ──────────────────────────────────────────────────────

async function setupGarmin(): Promise<void> {
  blank();
  console.log(chalk.hex('#6b7280')('  Your Garmin credentials are stored locally — never sent anywhere except Garmin.\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'username',
      message: 'Garmin Connect email',
      validate: (v: string) => v.includes('@') || 'Enter a valid email',
    },
    {
      type: 'password',
      name: 'password',
      message: 'Password',
      mask: '•',
      validate: (v: string) => v.length > 0 || 'Required',
    },
  ]);

  const spinner = ora({ text: 'Connecting to Garmin...', color: 'cyan' }).start();
  try {
    await connectGarmin(answers.username, answers.password);
    spinner.succeed(chalk.green('Garmin connected.'));
  } catch (err) {
    spinner.fail(chalk.red(`Garmin failed: ${(err as Error).message}`));
    console.log(chalk.hex('#6b7280')('\n  Try again later with: lumen link garmin\n'));
  }
}
