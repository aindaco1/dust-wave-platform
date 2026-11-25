// Gregorian civil dates. UTC is used solely for ordinal arithmetic.
function dateFromParts(year, month, day) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

function parseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError("Expected YYYY-MM-DD");
  const [year, month, day] = value.split("-").map(Number);
  const date = dateFromParts(year, month, day);
  if (year < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
    throw new RangeError("Invalid calendar date");
  }
  return date;
}

function shift(date, months) {
  const ordinal = date.getUTCFullYear() * 12 + date.getUTCMonth() + months;
  const year = Math.floor(ordinal / 12);
  if (year < 1 || year > 9999) throw new RangeError("Result outside supported calendar years");
  const month = ordinal % 12 + 1;
  const lastDay = dateFromParts(year, month + 1, 0).getUTCDate();
  return dateFromParts(year, month, Math.min(date.getUTCDate(), lastDay));
}

export function addCalendarMonths(value, months) {
  if (!Number.isSafeInteger(months)) throw new TypeError("Expected an integer number of months");
  return shift(parseDate(value), months).toISOString().slice(0, 10);
}

export function calendarDifference(start, end) {
  const first = parseDate(start);
  const last = parseDate(end);
  if (last < first) throw new RangeError("End date precedes start date");
  let wholeMonths = (last.getUTCFullYear() - first.getUTCFullYear()) * 12 + last.getUTCMonth() - first.getUTCMonth();
  if (shift(first, wholeMonths) > last) wholeMonths--;
  const days = (last.getTime() - shift(first, wholeMonths).getTime()) / 86_400_000;
  return { years: Math.floor(wholeMonths / 12), months: wholeMonths % 12, days };
}
