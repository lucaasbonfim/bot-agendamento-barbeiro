import { mkdir } from 'node:fs/promises';
import { loadConfig } from './config.js';
import { runBookingBot } from './bookingBot.js';
import { notify } from './notifier.js';
import { waitUntilConfiguredTime } from './waitUntil.js';

const main = async () => {
  await mkdir('artifacts', { recursive: true });

  const config = loadConfig();

  await waitUntilConfiguredTime(config);

  const result = await runBookingBot(config);

  await notify(config.notifyWebhookUrl, `[${result.status}] ${result.details}`);
};

main().catch(async (error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);

  try {
    const config = loadConfig();
    await notify(config.notifyWebhookUrl, `[erro] ${message}`);
  } catch {
    // Sem config valida, apenas falha o processo.
  }

  process.exitCode = 1;
});
