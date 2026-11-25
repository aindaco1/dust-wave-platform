import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyLocalTime,
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

test('classifies Denver event times without moving missing times or choosing a repeated hour', () => {
  const resolve = (day, time) => classifyLocalTime(day, time, 'America/Denver');
  assert.deepEqual(resolve('2026-03-08', '01:59'), { kind: 'unique', instant: '2026-03-08T08:59:00.000Z' });
  assert.deepEqual(resolve('2026-03-08', '02:30'), { kind: 'missing' });
  assert.deepEqual(resolve('2026-03-08', '03:00'), { kind: 'unique', instant: '2026-03-08T09:00:00.000Z' });
  assert.deepEqual(resolve('2026-11-01', '01:00'), { kind: 'repeated' });
  assert.deepEqual(resolve('2026-11-01', '01:59'), { kind: 'repeated' });
  assert.deepEqual(resolve('2026-11-01', '02:00'), { kind: 'unique', instant: '2026-11-01T09:00:00.000Z' });
  for (const [date, time] of [['2026-02-29', '12:00'], ['2026-09-21', '24:00'], ['2026-09-21', '7:05'], ['x', '12:00']]) {
    assert.deepEqual(resolve(date, time), { kind: 'missing' });
  }
  assert.deepEqual(classifyLocalTime('2026-09-21', '19:00', 'Unknown/Zone'), { kind: 'missing' });
});

test('handles positive offsets, half-hour transitions, and skipped dates', () => {
  assert.deepEqual(classifyLocalTime('2026-10-25', '02:30', 'Europe/Paris'), { kind: 'repeated' });
  assert.deepEqual(classifyLocalTime('2026-04-05', '01:45', 'Australia/Lord_Howe'), { kind: 'repeated' });
  assert.deepEqual(classifyLocalTime('2026-10-04', '02:15', 'Australia/Lord_Howe'), { kind: 'missing' });
  assert.deepEqual(classifyLocalTime('2026-10-04', '02:30', 'Australia/Lord_Howe'), { kind: 'unique', instant: '2026-10-03T15:30:00.000Z' });
  assert.deepEqual(classifyLocalTime('2011-12-30', '12:00', 'Pacific/Apia'), { kind: 'missing' });
});
