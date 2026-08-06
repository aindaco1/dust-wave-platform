import assert from 'node:assert/strict';
import test from 'node:test';

import {
  dateAtTimeInTimeZone,
  getPlatformDateKey,
  getPlatformTimeParts,
  getPlatformTimeZone,
  isInPlatformDailyWindow,
  isPlatformDatePast,
  platformDateEnd,
  platformDateStart
} from '../src/date-time.js';

test('preserves Pool and Store platform date boundaries and local parts', () => {
  assert.equal(getPlatformTimeZone({}), 'America/Denver');
  assert.equal(
    platformDateStart('2026-04-21', { PLATFORM_TIMEZONE: 'America/Denver' }).toISOString(),
    '2026-04-21T06:00:00.000Z'
  );
  assert.equal(
    platformDateEnd('2026-04-21', { PLATFORM_TIMEZONE: 'America/Denver' }).toISOString(),
    '2026-04-22T05:59:59.000Z'
  );
  const instant = new Date('2026-04-21T05:30:00.000Z');
  assert.equal(getPlatformDateKey({ PLATFORM_TIMEZONE: 'America/Denver' }, instant), '2026-04-20');
  assert.deepEqual(
    getPlatformTimeParts({ PLATFORM_TIMEZONE: 'America/New_York' }, instant),
    {
      year: 2026,
      month: 4,
      day: 21,
      hour: 1,
      minute: 30,
      second: 0,
      timeZone: 'America/New_York'
    }
  );
});

test('handles spring and fall daylight-saving boundaries deterministically', () => {
  const springStart = platformDateStart('2026-03-08', 'America/Denver');
  const springEnd = platformDateEnd('2026-03-08', 'America/Denver');
  assert.equal(springStart.toISOString(), '2026-03-08T07:00:00.000Z');
  assert.equal(springEnd.toISOString(), '2026-03-09T05:59:59.000Z');
  assert.equal(springEnd.getTime() - springStart.getTime(), (23 * 60 * 60 * 1000) - 1000);

  const fallStart = platformDateStart('2026-11-01', 'America/Denver');
  const fallEnd = platformDateEnd('2026-11-01', 'America/Denver');
  assert.equal(fallStart.toISOString(), '2026-11-01T06:00:00.000Z');
  assert.equal(fallEnd.toISOString(), '2026-11-02T06:59:59.000Z');
  assert.equal(fallEnd.getTime() - fallStart.getTime(), (25 * 60 * 60 * 1000) - 1000);
});

test('preserves invalid-input, deadline, and daily-window failure semantics', () => {
  assert.equal(Number.isNaN(dateAtTimeInTimeZone('not-a-date').getTime()), true);
  assert.equal(isPlatformDatePast('not-a-date', {}, new Date()), false);
  assert.equal(
    isPlatformDatePast('2026-04-21', 'Asia/Tokyo', new Date('2026-04-21T15:00:00.000Z')),
    true
  );
  assert.equal(
    isInPlatformDailyWindow(
      { PLATFORM_TIMEZONE: 'America/Denver' },
      new Date('2026-04-21T06:04:59.000Z'),
      { hour: 0, minuteWindow: 5 }
    ),
    true
  );
});
