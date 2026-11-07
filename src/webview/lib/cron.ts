/** Cron expression parser, matcher and humanizer. */

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const DOW_NAMES: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

const MACROS: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
};

export interface ParsedCron {
  raw: string;
  minutes: number[];
  hours: number[];
  daysOfMonth: number[];
  months: number[];
  daysOfWeek: number[];
  domRestricted: boolean;
  dowRestricted: boolean;
}

function toValue(token: string, names?: Record<string, number>): number {
  const trimmed = token.trim().toLowerCase();
  if (names && trimmed in names) return names[trimmed];
  const value = Number(trimmed);
  if (!Number.isInteger(value)) throw new Error(`Invalid value "${token}"`);
  return value;
}

function parseField(raw: string, min: number, max: number, names?: Record<string, number>): number[] {
  const values = new Set<number>();
  for (const part of raw.split(',')) {
    const piece = part.trim();
    if (!piece) throw new Error(`Empty item in field "${raw}"`);
    const [rangePart, stepPart] = piece.split('/');
    const step = stepPart === undefined ? 1 : Number(stepPart);
    if (!Number.isInteger(step) || step < 1) throw new Error(`Invalid step "/${stepPart}"`);

    let start: number;
    let end: number;
    if (rangePart === '*' || rangePart === '?') {
      start = min;
      end = max;
    } else if (rangePart.includes('-')) {
      const [from, to] = rangePart.split('-');
      start = toValue(from, names);
      end = toValue(to, names);
    } else {
      start = toValue(rangePart, names);
      end = stepPart === undefined ? start : max;
    }

    if (start < min || start > max || end < min || end > max) {
      throw new Error(`Value out of range ${min}-${max} in "${piece}"`);
    }
    if (end < start) throw new Error(`Invalid range "${piece}"`);
    for (let value = start; value <= end; value += step) values.add(value);
  }
  return [...values].sort((a, b) => a - b);
}

export function parseCron(expression: string): ParsedCron {
  const raw = expression.trim();
  if (!raw) throw new Error('Expression is empty');
  const expanded = MACROS[raw.toLowerCase()] ?? raw;
  const fields = expanded.split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(`Expected 5 fields (minute hour day month weekday), got ${fields.length}`);
  }
  const daysOfWeek = parseField(fields[4], 0, 7, DOW_NAMES).map((day) => (day === 7 ? 0 : day));
  return {
    raw: expanded,
    minutes: parseField(fields[0], 0, 59),
    hours: parseField(fields[1], 0, 23),
    daysOfMonth: parseField(fields[2], 1, 31),
    months: parseField(fields[3], 1, 12, MONTH_NAMES),
    daysOfWeek: [...new Set(daysOfWeek)].sort((a, b) => a - b),
    domRestricted: fields[2] !== '*' && fields[2] !== '?',
    dowRestricted: fields[4] !== '*' && fields[4] !== '?',
  };
}

export function cronMatches(cron: ParsedCron, date: Date): boolean {
  if (!cron.minutes.includes(date.getMinutes())) return false;
  if (!cron.hours.includes(date.getHours())) return false;
  if (!cron.months.includes(date.getMonth() + 1)) return false;

  const domOk = cron.daysOfMonth.includes(date.getDate());
  const dowOk = cron.daysOfWeek.includes(date.getDay());
  if (cron.domRestricted && cron.dowRestricted) return domOk || dowOk;
  if (cron.domRestricted) return domOk;
  if (cron.dowRestricted) return dowOk;
  return true;
}

export function nextRuns(cron: ParsedCron, from: Date, count: number): Date[] {
  const result: Date[] = [];
  const cursor = new Date(from.getTime());
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);
  const limit = from.getTime() + 3 * 366 * 24 * 60 * 60 * 1000;
  while (result.length < count && cursor.getTime() < limit) {
    if (cronMatches(cron, cursor)) result.push(new Date(cursor.getTime()));
    cursor.setMinutes(cursor.getMinutes() + 1);
  }
  return result;
}

function isFull(values: number[], min: number, max: number): boolean {
  return values.length === max - min + 1 && values[0] === min;
}

function stepOf(values: number[], min: number, max: number): number | null {
  if (values.length < 2 || values[0] !== min) return null;
  const step = values[1] - values[0];
  if (step < 2) return null;
  for (let index = 1; index < values.length; index++) {
    if (values[index] - values[index - 1] !== step) return null;
  }
  if (values[values.length - 1] + step <= max) return null;
  return step;
}

const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_LABELS_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const DOW_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DOW_LABELS_RU = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
export const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export interface CronDescription {
  summary: string;
  details: Array<[string, string]>;
}

export function describeCron(cron: ParsedCron, lang: 'en' | 'ru'): CronDescription {
  const ru = lang === 'ru';
  const allMinutes = isFull(cron.minutes, 0, 59);
  const allHours = isFull(cron.hours, 0, 23);
  const minuteStep = stepOf(cron.minutes, 0, 59);
  const hourStep = stepOf(cron.hours, 0, 23);
  let time: string;

  if (allMinutes && allHours) {
    time = ru ? 'каждую минуту' : 'every minute';
  } else if (minuteStep && allHours) {
    time = ru ? `каждые ${minuteStep} мин.` : `every ${minuteStep} minutes`;
  } else if (allMinutes && hourStep) {
    time = ru ? `каждую минуту каждые ${hourStep} ч.` : `every minute, every ${hourStep} hours`;
  } else if (cron.minutes.length === 1 && allHours) {
    time = ru ? `в ${pad(cron.minutes[0])} мин. каждого часа` : `at minute ${cron.minutes[0]} of every hour`;
  } else if (allMinutes && cron.hours.length === 1) {
    time = ru ? `каждую минуту в течение часа ${cron.hours[0]}` : `every minute during hour ${cron.hours[0]}`;
  } else if (cron.minutes.length === 1 && cron.hours.length === 1) {
    time = ru ? `в ${pad(cron.hours[0])}:${pad(cron.minutes[0])}` : `at ${pad(cron.hours[0])}:${pad(cron.minutes[0])}`;
  } else if (cron.minutes.length === 1) {
    time = ru
      ? `в ${pad(cron.minutes[0])} мин. в часы ${cron.hours.join(', ')}`
      : `at minute ${cron.minutes[0]} during hours ${cron.hours.join(', ')}`;
  } else {
    time = ru
      ? `в минуты ${cron.minutes.join(', ')} и часы ${cron.hours.join(', ')}`
      : `at minutes ${cron.minutes.join(', ')} during hours ${cron.hours.join(', ')}`;
  }

  const parts: string[] = [time];

  if (cron.domRestricted) {
    parts.push(ru ? `${cron.daysOfMonth.join(', ')} числа` : `on day ${cron.daysOfMonth.join(', ')} of the month`);
  }
  if (cron.months.length !== 12) {
    const names = cron.months.map((month) => (ru ? MONTH_LABELS_RU[month - 1] : MONTH_LABELS[month - 1]));
    parts.push(ru ? `в ${names.join(', ')}` : `in ${names.join(', ')}`);
  }
  if (cron.dowRestricted) {
    const names = cron.daysOfWeek.map((day) => (ru ? DOW_LABELS_RU[day] : DOW_LABELS[day]));
    parts.push(ru ? `по ${names.join(', ')}` : `on ${names.join(', ')}`);
  }

  const summary = parts.join(ru ? ', ' : ', ');
  const details: Array<[string, string]> = [
    [ru ? 'Минуты' : 'Minutes', cron.minutes.join(', ')],
    [ru ? 'Часы' : 'Hours', cron.hours.join(', ')],
    [ru ? 'День месяца' : 'Day of month', cron.daysOfMonth.join(', ')],
    [ru ? 'Месяц' : 'Month', cron.months.map((month) => (ru ? MONTH_LABELS_RU[month - 1] : MONTH_LABELS[month - 1])).join(', ')],
    [ru ? 'День недели' : 'Day of week', cron.daysOfWeek.map((day) => (ru ? DOW_LABELS_RU[day] : DOW_LABELS[day])).join(', ')],
  ];

  return { summary: summary.charAt(0).toUpperCase() + summary.slice(1), details };
}
