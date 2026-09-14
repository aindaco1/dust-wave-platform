/** Consumer owns the SQLite connection, schema, foreign-key policy and closing resources. */
export interface SQLiteConnection {
  prepare(query: string): unknown;
  exec(query: string): void;
}
export interface SQLiteD1Result<T> {
  success: true;
  results: T[];
  meta: {
    changes: number;
    last_row_id?: number;
    duration: 0;
    rows_read: number;
    rows_written: number;
    changed_db: boolean;
    size_after: 0;
  };
}
export interface SQLiteD1Statement {
  bind(...values: unknown[]): SQLiteD1Statement;
  run<T = unknown>(): Promise<SQLiteD1Result<T>>;
  all<T = Record<string, unknown>>(): Promise<SQLiteD1Result<T>>;
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
  raw<T = unknown[]>(): Promise<T[]>;
}
export interface SQLiteD1Adapter {
  prepare(query: string): SQLiteD1Statement;
  batch<T = unknown>(statements: SQLiteD1Statement[]): Promise<SQLiteD1Result<T>[]>;
  exec(query: string): Promise<{ count: 0; duration: 0 }>;
  withSession(): never;
  dump(): never;
}
/** Minimal unit-test seam, not a complete D1 emulator. Statements in a batch must belong to this adapter. */
export function createD1TestAdapter(sqlite: SQLiteConnection): SQLiteD1Adapter;
