import test from "node:test";
import assert from "node:assert/strict";
import { readCsvRows } from "../src/csv.js";

test("preserves quoted data, blank rows, empty fields and BOMs", () => {
  assert.deepEqual(readCsvRows('\uFEFFa,b\r\n"A\r\nB""C",\r\n\r\n""').rows,
    [["\uFEFFa", "b"], ['A\r\nB"C', ""], [""], [""]]);
  assert.deepEqual(readCsvRows("").rows, []);
});

test("adapters choose how to handle incomplete final fields", () => {
  const input = 'id,note\n1,"unfinished';
  assert.deepEqual(readCsvRows(input), { rows: [["id", "note"]], issues: ["incomplete"] });
  assert.deepEqual(readCsvRows(input, { incomplete: "keep" }).rows[1], ["1", "unfinished"]);
  assert.deepEqual(readCsvRows('a\n"xy"', { maxChars: 5, incomplete: "keep" }), { rows: [["a"]], issues: ["characters", "incomplete"] });
});

test("enforces all bounds, counts included rows and reports each issue once", () => {
  const value = readCsvRows('abc,def\n\nxyz,abc\nmore', { maxChars: 18, maxRows: 1, maxColumns: 1, maxCellChars: 2, includeRow: row => row.some(Boolean) });
  assert.deepEqual(value, { rows: [["ab"]], issues: ["characters", "cell", "columns", "rows"] });
  assert.throws(() => readCsvRows("", { maxRows: Infinity }), RangeError);
});

test("zero limits are valid consumer policy", () => {
  assert.deepEqual(readCsvRows("x", { maxChars: 0 }), { rows: [], issues: ["characters"] });
  assert.deepEqual(readCsvRows("x", { maxRows: 0 }), { rows: [], issues: ["rows"] });
  assert.deepEqual(readCsvRows("x", { maxCellChars: 0, maxColumns: 0 }), { rows: [[]], issues: ["cell", "columns"] });
});

test("can skip a final row with no retained fields without skipping terminated rows", () => {
  const options = { skipUnretainedFinalRow: true, maxColumns: 0, maxCellChars: 0 };
  assert.deepEqual(readCsvRows('""', options), { rows: [], issues: [] });
  assert.deepEqual(readCsvRows("x", options), { rows: [], issues: ["cell"] });
  assert.deepEqual(readCsvRows('""\n', options), { rows: [[]], issues: ["columns"] });
});
