import ora from 'ora';
import chalk from 'chalk';
import { fetchGarminData, isGarminConnected } from '../integrations/garmin';
import { upsertHealthData } from '../db/queries';
import { todayDateString, dateNDaysAgo } from '../utils/normalize';
import { printWarning, printError, blank, dim, good, footer } from '../utils/format';
import type { HealthData } from '../db/schema';

export async function runSync(opts: { days?: number } = {}): Promise<void> {
  const days      = opts.days ?? 7;
  const endDate   = todayDateString();
  const startDate = dateNDaysAgo(days);

  if (!isGarminConnected()) {
    blank();
    printWarning('no devices connected');
    footer(['run lumen link garmin to connect']);
    blank();
    return;
  }

  blank();
  console.log(dim(`syncing ${days} days  ${startDate} → ${endDate}`));
  blank();

  const allData: HealthData[] = [];
  const errors: string[] = [];

  if (isGarminConnected()) {
    const s = ora({ text: 'garmin', color: 'white' }).start();
    try {
      const data = await fetchGarminData(startDate, endDate);
      allData.push(...data);
      s.stopAndPersist({ symbol: good('✓'), text: chalk.hex('#f9fafb')(`garmin  `) + dim(`${data.length} records`) });
    } catch (err) {
      s.stopAndPersist({ symbol: chalk.hex('#ef4444')('✗'), text: chalk.hex('#f9fafb')('garmin') });
      errors.push(`garmin: ${(err as Error).message}`);
    }
  }

  if (allData.length > 0) {
    for (const item of allData) upsertHealthData(item);
  }

  if (errors.length > 0) {
    blank();
    for (const e of errors) printError(e);
  }

  blank();
  footer(['lumen', 'synced just now', 'lumen status']);
  blank();
}
