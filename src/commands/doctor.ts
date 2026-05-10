import chalk from 'chalk';
import { getProfile, getToken, getConfig, getMemories } from '../db/queries';
import { printCheck, blank, dim, val, DOT } from '../utils/format';

export async function runDoctor(): Promise<void> {
  blank();

  const profile = getProfile();
  const hasKey  = !!(process.env.ANTHROPIC_API_KEY ?? getConfig('anthropic_api_key'));
  const garmin  = getToken('garmin');
  const memories = getMemories();

  printCheck('profile',      profile ? 'ok' : 'missing',
    profile ? `${profile.name} · ${profile.age}y · ${profile.health_goal.replace(/_/g, ' ')}` : 'not configured',
    'lumen setup');

  printCheck('anthropic key', hasKey ? 'ok' : 'missing',
    hasKey ? 'configured' : 'missing — lumen ask and lumen plan won\'t work',
    'lumen setup --reset');

  printCheck('garmin', garmin ? 'ok' : 'missing',
    garmin ? 'connected' : 'not connected',
    'lumen link garmin');

  printCheck('context notes', memories.length > 0 ? 'ok' : 'warn',
    memories.length > 0 ? `${memories.length} saved` : 'none — add context for better answers',
    'lumen remember "..."');

  blank();

  const missing = [!profile, !hasKey, !garmin].filter(Boolean).length;
  if (missing === 0) {
    console.log(dim('all good · run lumen sync to pull latest data'));
  } else {
    console.log(dim(`${missing} item${missing !== 1 ? 's' : ''} need attention`));
  }
  blank();
}
