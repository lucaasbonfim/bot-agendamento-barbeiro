import 'dotenv/config';

const optional = (value) => {
  if (!value || value.trim().length === 0) {
    return undefined;
  }

  return value.trim();
};

const booleanEnv = (name, fallback) => {
  const value = process.env[name];

  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'sim'].includes(value.toLowerCase());
};

const numberEnv = (name, fallback) => {
  const value = process.env[name];

  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} precisa ser um numero valido.`);
  }

  return parsed;
};

export const loadConfig = () => {
  const bookingUrl = optional(process.env.BOOKING_URL);

  if (!bookingUrl) {
    throw new Error('BOOKING_URL e obrigatorio. Copie .env.example para .env e preencha a URL.');
  }

  return {
    bookingUrl,
    username: optional(process.env.BARBER_USERNAME),
    password: optional(process.env.BARBER_PASSWORD),
    customerName: optional(process.env.CUSTOMER_NAME),
    customerPhone: optional(process.env.CUSTOMER_PHONE),
    branchName: optional(process.env.BRANCH_NAME) ?? 'Imbariê',
    professionalName: optional(process.env.PROFESSIONAL_NAME) ?? 'Weslley gomes',
    serviceName: optional(process.env.SERVICE_NAME) ?? 'Corte de cabelo',
    preferredDate: optional(process.env.PREFERRED_DATE),
    preferredTime: optional(process.env.PREFERRED_TIME) ?? '11:00',
    fallbackAfterTime: optional(process.env.FALLBACK_AFTER_TIME) ?? '16:30',
    bookingDaysAhead: numberEnv('BOOKING_DAYS_AHEAD', 7),
    targetWeekday: optional(process.env.TARGET_WEEKDAY) ?? 'friday',
    timezone: optional(process.env.TIMEZONE) ?? 'America/Sao_Paulo',
    waitUntilTime: optional(process.env.WAIT_UNTIL_TIME),
    waitGraceMinutes: numberEnv('WAIT_GRACE_MINUTES', 5),
    waitMaxMinutes: numberEnv('WAIT_MAX_MINUTES', 15),
    skipWait: booleanEnv('SKIP_WAIT', false),
    dryRun: booleanEnv('DRY_RUN', false),
    headless: booleanEnv('HEADLESS', true),
    notifyWebhookUrl: optional(process.env.NOTIFY_WEBHOOK_URL),
    emailSmtpHost: optional(process.env.EMAIL_SMTP_HOST) ?? 'smtp.gmail.com',
    emailSmtpPort: numberEnv('EMAIL_SMTP_PORT', 465),
    emailSmtpSecure: booleanEnv('EMAIL_SMTP_SECURE', true),
    emailSmtpUser: optional(process.env.EMAIL_SMTP_USER),
    emailSmtpPass: optional(process.env.EMAIL_SMTP_PASS),
    emailFrom: optional(process.env.EMAIL_FROM) ?? optional(process.env.EMAIL_SMTP_USER),
    emailTo: optional(process.env.EMAIL_TO)
  };
};
