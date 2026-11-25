import assert from 'node:assert/strict';
import test from 'node:test';
import { escapeIcsText, foldIcsLine } from '../src/icalendar.js';

test('escapes text punctuation and all newline conventions exactly once', () => {
  assert.equal(escapeIcsText('a\\b;c,d\r\ne\rf\ng'), 'a\\\\b\\;c\\,d\\ne\\nf\\ng');
  assert.equal(escapeIcsText(''), '');
});

test('counts continuation spaces and folds between complete UTF-8 characters', () => {
  const prefix = 'x'.repeat(75);
  assert.equal(foldIcsLine(prefix), prefix);
  assert.equal(foldIcsLine(prefix + 'tail'), prefix + '\r\n tail');
  for (const char of ['a', 'é', '中', '🎬']) {
    for (const lead of [71, 72, 73, 74, 75]) {
      const line = 'a'.repeat(lead) + char.repeat(160);
      const folded = foldIcsLine(line);
      for (const physical of folded.split('\r\n')) {
        assert.ok(new TextEncoder().encode(physical).length <= 75);
        assert.ok(physical.isWellFormed());
      }
      assert.equal(folded.replaceAll('\r\n ', ''), line);
    }
  }
});
