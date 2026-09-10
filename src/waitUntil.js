const TIME_PATTERN = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

export const waitUntilConfiguredTime = async (config) => {
  if (config.skipWait) {
    console.log('SKIP_WAIT=true; seguindo sem aguardar WAIT_UNTIL_TIME.');
    return;
  }

  if (!config.waitUntilTime) {
    return;
  }

  const plan = getWaitPlan({
    now: new Date(),
    targetTime: config.waitUntilTime,
    timezone: config.timezone,
    graceMinutes: config.waitGraceMinutes,
    maxWaitMinutes: config.waitMaxMinutes
  });

  if (plan.reason === 'already-in-grace') {
    console.log(`Horario alvo ${config.waitUntilTime} ja passou ha ${plan.lateBySeconds}s; seguindo dentro da tolerancia.`);
    return;
  }

  if (plan.waitMs === 0) {
    return;
  }

  console.log(`Aguardando ${plan.waitSeconds}s ate ${config.waitUntilTime} (${config.timezone}).`);
  await sleep(plan.waitMs);
};

export const getWaitPlan = ({
  now,
  targetTime,
  timezone,
  graceMinutes,
  maxWaitMinutes
}) => {
  const target = parseTargetTime(targetTime);
  const currentParts = zonedParts(now, timezone);
  const targetToday = zonedDateTimeToUtc(
    {
      year: currentParts.year,
      month: currentParts.month,
      day: currentParts.day,
      ...target
    },
    timezone
  );

  const graceMs = minutesToMs(graceMinutes);
  const maxWaitMs = minutesToMs(maxWaitMinutes);
  const lateByMs = now.getTime() - targetToday.getTime();

  if (lateByMs >= 0 && lateByMs <= graceMs) {
    return {
      reason: 'already-in-grace',
      waitMs: 0,
      waitSeconds: 0,
      lateBySeconds: Math.ceil(lateByMs / 1000)
    };
  }

  const nextTarget = now < targetToday ? targetToday : nextLocalTarget(currentParts, target, timezone);
  const waitMs = nextTarget.getTime() - now.getTime();

  if (waitMs > maxWaitMs) {
    throw new Error(
      `Proximo horario alvo (${targetTime} em ${timezone}) esta em ${Math.ceil(waitMs / 60000)} minutos, acima de WAIT_MAX_MINUTES=${maxWaitMinutes}.`
    );
  }

  return {
    reason: 'wait',
    waitMs,
    waitSeconds: Math.ceil(waitMs / 1000),
    lateBySeconds: 0
  };
};

const nextLocalTarget = (currentParts, target, timezone) => {
  const nextDay = new Date(Date.UTC(currentParts.year, currentParts.month - 1, currentParts.day + 1));

  return zonedDateTimeToUtc(
    {
      year: nextDay.getUTCFullYear(),
      month: nextDay.getUTCMonth() + 1,
      day: nextDay.getUTCDate(),
      ...target
    },
    timezone
  );
};

const parseTargetTime = (value) => {
  const match = TIME_PATTERN.exec(value.trim());

  if (!match) {
    throw new Error('WAIT_UNTIL_TIME precisa estar no formato HH:mm ou HH:mm:ss.');
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? '0');

  if (hour > 23 || minute > 59 || second > 59) {
    throw new Error('WAIT_UNTIL_TIME precisa ser um horario valido.');
  }

  return { hour, minute, second };
};

const zonedDateTimeToUtc = (parts, timezone) => {
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  let utc = localAsUtc;

  for (let index = 0; index < 3; index += 1) {
    utc = localAsUtc - timezoneOffsetMs(new Date(utc), timezone);
  }

  return new Date(utc);
};

const timezoneOffsetMs = (date, timezone) => {
  const parts = zonedParts(date, timezone);
  const zonedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  return zonedAsUtc - date.getTime();
};

const zonedParts = (date, timezone) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    hour12: false,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const values = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );

  const hour = Number(values.hour);

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: hour === 24 ? 0 : hour,
    minute: Number(values.minute),
    second: Number(values.second)
  };
};

const minutesToMs = (minutes) => minutes * 60 * 1000;

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});
