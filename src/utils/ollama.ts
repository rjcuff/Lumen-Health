import { execSync, exec } from 'child_process';
import * as os from 'os';
import open from 'open';

export function isOllamaInstalled(): boolean {
  try {
    execSync('ollama --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export async function isOllamaRunning(): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function ollamaHasModel(model: string): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
    const data = await res.json() as { models?: { name: string }[] };
    return (data.models ?? []).some(m => m.name.startsWith(model.replace(':latest', '')));
  } catch {
    return false;
  }
}

export function startOllamaBackground(): void {
  const platform = os.platform();
  if (platform === 'win32') {
    exec('start /B ollama serve', { shell: 'cmd.exe' });
  } else {
    exec('ollama serve &');
  }
}

export async function openOllamaDownloadPage(): Promise<void> {
  await open('https://ollama.com/download');
}
