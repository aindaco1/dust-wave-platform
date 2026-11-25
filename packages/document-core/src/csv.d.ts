export type CsvIssue = "characters" | "rows" | "columns" | "cell" | "incomplete";
export function readCsvRows(text: string, options?: {
  maxChars?: number;
  maxRows?: number;
  maxColumns?: number;
  maxCellChars?: number;
  includeRow?: (row: readonly string[], atEnd: boolean) => boolean;
  incomplete?: "keep" | "drop";
}): { rows: string[][]; issues: CsvIssue[] };
