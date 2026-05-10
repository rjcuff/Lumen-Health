import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'child_process';
import { getConfig } from '../db/queries';
import { isOllamaInstalled, isOllamaRunning, ollamaHasModel, startOllamaBackground, openOllamaDownloadPage } from './ollama';
import { blank, dim } from './format';

export async function ensureAiReady(): Promise<void> {
  const provider = process.env.LUMEN_PROVIDER ?? getConfig('ai_provider') ?? 'anthropic';

  if (provider !== 'ollama') {
    const key = process.env.ANTHROPIC_API_KEY ?? getConfig('anthropic_api_key') ?? getConfig('openai_api_key');
    if (!key) {
      blank();
      console.log(bad('✗') + '  ' + chalk.hex('#d1d5db')('no api key configured'));
      console.log('   ' + dim('run lumen setup --reset to add your key'));
      blank();
      process.exit(1);
    }
    return;
  }

  // ── Ollama checks ──────────────────────────────────────────────────────────

  const model = process.env.LUMEN_MODEL ?? getConfig('ai_model') ?? 'llama3.1';

  // 1. Installed?
  if (!isOllamaInstalled()) {
    blank();
    console.log(bad('✗') + '  ' + chalk.hex('#d1d5db')('ollama is not installed'));
    blank();
    console.log('   ' + dim('to use local ai, install it at ollama.com/download'));
    console.log('   ' + dim('or switch to claude: run ') + chalk.hex('#f9fafb')('lumen setup --reset') + dim(' to choose a different ai provider'));
    blank();
    await openOllamaDownloadPage();
    process.exit(1);
  }

  // 2. Running?
  if (!await isOllamaRunning()) {
    blank();
    console.log(warnColor('⚠') + '  ' + chalk.hex('#d1d5db')('ollama is not running — starting it...'));
    startOllamaBackground();

    const spinner = ora({ text: 'waiting for ollama to start...', color: 'white' }).start();
    for (let i = 0; i < 10; i++) {
      await sleep(1000);
      if (await isOllamaRunning()) {
        spinner.stopAndPersist({ symbol: good('✓'), text: chalk.hex('#f9fafb')('ollama started') });
        break;
      }
      if (i === 9) {
        spinner.fail(bad('ollama failed to start'));
        console.log('   ' + dim('open a new terminal and run: ollama serve'));
        blank();
        process.exit(1);
      }
    }
  }

  // 3. Model pulled?
  if (!await ollamaHasModel(model)) {
    blank();
    console.log(
      warnColor('⚠') + '  ' +
      chalk.hex('#f9fafb')(model) +
      chalk.hex('#6b7280')(' not found — pulling it now (this only happens once)...')
    );
    blank();

    try {
      execSync(`ollama pull ${model}`, { stdio: 'inherit' });
      blank();
      console.log(good('✓') + '  ' + chalk.hex('#f9fafb')(model) + dim(' ready'));
    } catch {
      console.log(bad('✗') + `  failed to pull ${model}`);
      console.log('   ' + dim(`try manually: ollama pull ${model}`));
      blank();
      process.exit(1);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function warnColor(s: string): string { return chalk.hex('#fbbf24')(s); }
function good(s: string): string      { return chalk.hex('#22c55e')(s); }
function bad(s: string): string       { return chalk.hex('#ef4444')(s); }
