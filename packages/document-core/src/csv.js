// Limits count UTF-16 code units, matching String.length and slice.
export function readCsvRows(text, {
  maxChars = 1_048_576, maxRows = 10_000, maxColumns = 256, maxCellChars = 65_536,
  includeRow = () => true, incomplete = "drop", skipUnretainedFinalRow = false
} = {}) {
  if (typeof text !== "string" || typeof includeRow !== "function") throw new TypeError("Expected CSV text and a row predicate");
  if (!["keep", "drop"].includes(incomplete)) throw new TypeError("Unknown incomplete row policy");
  for (const value of [maxChars, maxRows, maxColumns, maxCellChars]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError("CSV limits must be nonnegative safe integers");
  }
  const issues = new Set();
  const rows = [];
  const end = Math.min(text.length, maxChars);
  if (end < text.length) issues.add("characters");
  let row = [];
  let field = "";
  let quoted = false;
  let rowStart = 0;

  function finishField() {
    if (row.length < maxColumns) row.push(field);
    else issues.add("columns");
    field = "";
  }
  function finishRow(atEnd) {
    finishField();
    if (includeRow(row, atEnd)) {
      if (rows.length === maxRows) {
        issues.add("rows");
        return false;
      }
      rows.push(row);
    }
    row = [];
    return true;
  }
  for (let i = 0; i < end; i++) {
    const c = text[i];
    if (c === '"') {
      if (!quoted || i + 1 >= end || text[i + 1] !== '"') {
        quoted = !quoted;
        continue;
      }
      i++;
    } else if (!quoted && c === ",") {
      finishField();
      continue;
    } else if (!quoted && (c === "\n" || c === "\r")) {
      if (c === "\r" && i + 1 < end && text[i + 1] === "\n") i++;
      rowStart = i + 1;
      if (!finishRow(false)) return { rows, issues: [...issues] };
      continue;
    }
    if (field.length < maxCellChars) field += c;
    else issues.add("cell");
  }
  if (quoted) issues.add("incomplete");
  const hasFinalRow = skipUnretainedFinalRow ? row.length > 0 || field.length > 0 : end > rowStart;
  if (end === text.length && (!quoted || incomplete === "keep") && hasFinalRow) {
    finishRow(true);
  }
  return { rows, issues: [...issues] };
}
