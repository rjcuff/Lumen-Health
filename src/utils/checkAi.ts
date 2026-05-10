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
      console.log(chalk.hex('#ef4444')('✗') + '  no api key configured');
      console.log(dim('\n  run lumen setup --reset to add your key\n'));
      process.exit(1);
    }
    return;
  }

  // ── Ollama checks ────────────────────────────────────────────────────────

  const model = process.env.LUMEN_MODEL ?? getConfig('ai_model') ?? 'llama3.1';

  // 1. Installed?
  if (!isOllamaInstalled()) {
    blank();
    console.log(chalk.hex('#ef4444')('✗') + '  ollama is not installed');
    console.log(dim('\n  opening ollama.com/download in your browser...'));
    console.log(dim('  install it, then run this command again\n'));
    await openOllamaDownloadPage();
    process.exit(1);
  }

  // 2. Running?
  if (!await isOllamaRunning()) {
    blank();
    console.log(warn('⚠') + '  ollama is not running — starting it...');
    startOllamaBackground();

    const spinner = ora({ text: 'waiting for ollama to start...', color: 'white' }).start();
    for (let i = 0; i < 10; i++) {
      await sleep(1000);
      if (await isOllamaRunning()) {
        spinner.stopAndPersist({ symbol: good('✓'), text: chalk.hex('#f9fafb')('ollama started') });
        break;
      }
      if (i === 9) {
        spinner.fail(chalk.hex('#ef4444')('ollama failed to start'));
        console.log(dim('\n  open a new terminal and run: ollama serve\n'));
        process.exit(1);
      }
    }
  }

  // 3. Model pulled?
  if (!await ollamaHasModel(model)) {
    blank();
    console.log(warn('⚠') + '  model ' + chalk.hex('#f9fafb')(model) + dim(' not found — pulling it now...'));
    console.log(dim('  this only happens once\n'));

    try {
      execSync(`ollama pull ${model}`, { stdio: 'inherit' });
      blank();
      console.log(good('✓') + '  ' + chalk.hex('#f9fafb')(model) + dim(' ready'));
    } catch {
      console.log(chalk.hex('#ef4444')('✗') + `  failed to pull ${model}`);
      console.log(dim(`\n  try manually: ollama pull ${model}\n`));
      process.exit(1);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function warn(s: string): string {
  return chalk.hex('#fbbf24')(s);
}

function good(s: string): string {
  return chalk.hex('#22c55e')(s);
}
