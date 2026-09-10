const WEEKDAYS = {
  sunday: 0,
  domingo: 0,
  monday: 1,
  segunda: 1,
  tuesday: 2,
  terca: 2,
  terça: 2,
  wednesday: 3,
  quarta: 3,
  thursday: 4,
  quinta: 4,
  friday: 5,
  sexta: 5,
  'sexta-feira': 5,
  saturday: 6,
  sabado: 6,
  sábado: 6
};

export const getTargetDate = ({
  preferredDate,
  targetWeekday,
  bookingDaysAhead,
  timezone,
  now = new Date()
}) => {
  if (preferredDate) {
    return dateInfo(parsePreferredDate(preferredDate));
  }

  if (targetWeekday) {
    return dateInfo(nextWeekdayDateParts(now, targetWeekday, timezone));
  }

  return dateInfo(datePartsDaysAhead(now, bookingDaysAhead, timezone));
};

export const preferredDateLabel = (
  preferredDate,
  daysAhead,
  timezone
) => {
  return getTargetDate({
    preferredDate,
    bookingDaysAhead: daysAhead,
    timezone
  }).label;
};

const dateInfo = ({ year, month, day }) => {
  const label = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;

  return {
    year,
    month,
    day,
    label,
    dayText: String(day),
    iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  };
};

const nextWeekdayDateParts = (now, targetWeekday, timezone) => {
  const target = weekdayNumber(targetWeekday);
  const currentParts = localDateParts(now, timezone);
  const currentDate = Date.UTC(currentParts.year, currentParts.month - 1, currentParts.day);
  const currentWeekday = new Date(currentDate).getUTCDay();
  let diff = (target - currentWeekday + 7) % 7;

  if (diff === 0) {
    diff = 7;
  }

  const targetDate = new Date(currentDate + diff * 24 * 60 * 60 * 1000);

  return {
    year: targetDate.getUTCFullYear(),
    month: targetDate.getUTCMonth() + 1,
    day: targetDate.getUTCDate()
  };
};

const datePartsDaysAhead = (now, daysAhead, timezone) => {
  const currentParts = localDateParts(now, timezone);
  const currentDate = Date.UTC(currentParts.year, currentParts.month - 1, currentParts.day);
  const targetDate = new Date(currentDate + daysAhead * 24 * 60 * 60 * 1000);

  return {
    year: targetDate.getUTCFullYear(),
    month: targetDate.getUTCMonth() + 1,
    day: targetDate.getUTCDate()
  };
};

const localDateParts = (date, timezone) => {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const values = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day)
  };
};

const parsePreferredDate = (value) => {
  const trimmed = value.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const brMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);

  const parts = isoMatch
    ? { year: Number(isoMatch[1]), month: Number(isoMatch[2]), day: Number(isoMatch[3]) }
    : brMatch
      ? { year: Number(brMatch[3]), month: Number(brMatch[2]), day: Number(brMatch[1]) }
      : undefined;

  if (!parts || !isValidDate(parts)) {
    throw new Error('PREFERRED_DATE precisa estar no formato DD/MM/YYYY ou YYYY-MM-DD.');
  }

  return parts;
};

const isValidDate = ({ year, month, day }) => {
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
};

const weekdayNumber = (value) => {
  const normalized = value.trim().toLowerCase();
  const weekday = WEEKDAYS[normalized];

  if (weekday === undefined) {
    throw new Error(`TARGET_WEEKDAY invalido: ${value}. Use friday ou sexta.`);
  }

  return weekday;
};
