import { mkdir, writeFile } from 'node:fs/promises';
import { loadConfig } from './config.js';
import { runBookingBot } from './bookingBot.js';
import { notify } from './notifier.js';
import { waitUntilConfiguredTime } from './waitUntil.js';

const main = async () => {
  await mkdir('artifacts', { recursive: true });
  await writeRunInfo('started', {
    startedAt: new Date().toISOString(),
    event: process.env.GITHUB_EVENT_NAME,
    runId: process.env.GITHUB_RUN_ID
  });

  const config = loadConfig();
  await writeRunInfo('configured', {
    startedAt: new Date().toISOString(),
    bookingUrlSet: Boolean(config.bookingUrl),
    usernameSet: Boolean(config.username),
    branchName: config.branchName,
    professionalName: config.professionalName,
    serviceName: config.serviceName,
    preferredDate: config.preferredDate,
    preferredTime: config.preferredTime,
    fallbackAfterTime: config.fallbackAfterTime,
    targetWeekday: config.targetWeekday,
    timezone: config.timezone,
    waitUntilTime: config.waitUntilTime,
    waitGraceMinutes: config.waitGraceMinutes,
    waitMaxMinutes: config.waitMaxMinutes,
    skipWait: config.skipWait,
    dryRun: config.dryRun,
    headless: config.headless
  });

  await waitUntilConfiguredTime(config);

  const result = await runBookingBot(config);

  await notify(config.notifyWebhookUrl, `[${result.status}] ${result.details}`);
};

main().catch(async (error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  await writeRunInfo('error', {
    failedAt: new Date().toISOString(),
    error: message
  }).catch(() => undefined);

  try {
    const config = loadConfig();
    await notify(config.notifyWebhookUrl, `[erro] ${message}`);
  } catch {
    // Sem config valida, apenas falha o processo.
  }

  process.exitCode = 1;
});

const writeRunInfo = async (status, data) => {
  await writeFile(
    'artifacts/run-info.json',
    `${JSON.stringify({ status, ...data }, null, 2)}\n`
  );
};
