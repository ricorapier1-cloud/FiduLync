export type MarketSession = 'LONDON' | 'NEW_YORK' | 'CLOSED';

type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number };

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? NaN);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

function isWeekday(date: Date, timeZone: string): boolean {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
  return weekday !== 'Sat' && weekday !== 'Sun';
}

function zonedLocalTimeToUtc(parts: ZonedParts, hour: number, minute = 0, timeZone: string): number {
  const targetAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute);
  const observed = zonedParts(new Date(targetAsUtc), timeZone);
  const observedAsUtc = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute);
  return targetAsUtc - (observedAsUtc - targetAsUtc);
}

/** London remains the user's fixed 08:00–12:00 WAT window.
 * New York follows 08:00–12:00 America/New_York, automatically handling DST.
 */
export function getActiveMarketSession(now = new Date()): MarketSession {
  if (isWeekday(now, 'Africa/Lagos')) {
    const wat = zonedParts(now, 'Africa/Lagos');
    const hour = wat.hour + wat.minute / 60;
    if (hour >= 8 && hour < 12) return 'LONDON';
  }
  if (isWeekday(now, 'America/New_York')) {
    const ny = zonedParts(now, 'America/New_York');
    const hour = ny.hour + ny.minute / 60;
    if (hour >= 8 && hour < 12) return 'NEW_YORK';
  }
  return 'CLOSED';
}

export function getNextMarketSessionOpenUtc(now = new Date()): number {
  const candidates: number[] = [];
  for (let offset = 0; offset <= 8; offset++) {
    const probe = new Date(now.getTime() + offset * 86_400_000);
    if (isWeekday(probe, 'Africa/Lagos')) {
      candidates.push(zonedLocalTimeToUtc(zonedParts(probe, 'Africa/Lagos'), 8, 0, 'Africa/Lagos'));
    }
    if (isWeekday(probe, 'America/New_York')) {
      candidates.push(zonedLocalTimeToUtc(zonedParts(probe, 'America/New_York'), 8, 0, 'America/New_York'));
    }
  }
  return candidates.filter((candidate) => candidate > now.getTime()).sort((a, b) => a - b)[0] ?? now.getTime();
}

export function getActiveMarketSessionCloseUtc(now: Date, session: MarketSession): number {
  if (session === 'CLOSED') return now.getTime();
  const timeZone = session === 'LONDON' ? 'Africa/Lagos' : 'America/New_York';
  return zonedLocalTimeToUtc(zonedParts(now, timeZone), 12, 0, timeZone);
}

/** Forex is closed from Friday 17:00 New York until Sunday 17:00 New York. */
export function isForexMarketWeekendClosed(now = new Date()): boolean {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(now);
  const ny = zonedParts(now, 'America/New_York');
  const minuteOfDay = ny.hour * 60 + ny.minute;
  return weekday === 'Sat'
    || (weekday === 'Fri' && minuteOfDay >= 17 * 60)
    || (weekday === 'Sun' && minuteOfDay < 17 * 60);
}
