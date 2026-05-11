export const DEFAULT_TIME_ZONE = "Europe/Istanbul";
export const DEFAULT_NIGHT_START_HOUR = 20;

export interface LocalDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekDay: number;
}

const weekdayNumbers: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6
};

export function resolveTimeZone(timeZone?: string) {
  const candidate = timeZone?.trim() || DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function getLocalDateParts(value: string | Date, timeZone?: string): LocalDateParts {
  const date = typeof value === "string" ? new Date(value) : value;
  const resolvedTimeZone = resolveTimeZone(timeZone);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: resolvedTimeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const weekday = parts.weekday?.slice(0, 3).toLocaleLowerCase("en-US") ?? "";

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekDay: weekdayNumbers[weekday] ?? 0
  };
}

export function isLocalNight(value: string | Date, timeZone?: string, nightStartHour = DEFAULT_NIGHT_START_HOUR) {
  return getLocalDateParts(value, timeZone).hour >= nightStartHour;
}

export function isLocalWeekend(value: string | Date, timeZone?: string) {
  const day = getLocalDateParts(value, timeZone).weekDay;
  return day === 0 || day === 6;
}

export function isLocalWeekendNight(value: string | Date, timeZone?: string, nightStartHour = DEFAULT_NIGHT_START_HOUR) {
  return isLocalWeekend(value, timeZone) && isLocalNight(value, timeZone, nightStartHour);
}
