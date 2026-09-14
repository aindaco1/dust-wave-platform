class TestD1Statement {
  statement;
  values = [];
  constructor(statement) {
    this.statement = statement;
  }
  bind(...values) {
    this.values = values;
    return this;
  }
  async run() {
    return this.runSync();
  }
  async all() {
    return this.allSync();
  }
  async first(columnName) {
    const row = this.statement.get(...this.values);
    if (!row) return null;
    return columnName ? row[columnName] : row;
  }
  async raw() {
    this.statement.setReturnArrays(true);
    try {
      return this.statement.all(...this.values);
    } finally {
      this.statement.setReturnArrays(false);
    }
  }
  runSync() {
    const result = this.statement.run(...this.values);
    return {
      success: true,
      results: [],
      meta: {
        changes: Number(result.changes),
        last_row_id: Number(result.lastInsertRowid),
        duration: 0,
        rows_read: 0,
        rows_written: Number(result.changes),
        changed_db: result.changes > 0,
        size_after: 0
      }
    };
  }
  allSync() {
    const results = this.statement.all(...this.values);
    return {
      success: true,
      results,
      meta: {
        changes: 0,
        duration: 0,
        rows_read: results.length,
        rows_written: 0,
        changed_db: false,
        size_after: 0
      }
    };
  }
}
export function createD1TestAdapter(sqlite) {
  const db = {
    prepare(query) {
      return new TestD1Statement(sqlite.prepare(query));
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = statements.map((statement) => statement.runSync());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
    async exec(query) {
      sqlite.exec(query);
      return {
        count: 0,
        duration: 0
      };
    },
    withSession() {
      throw new Error("D1 sessions are not implemented by the unit-test adapter");
    },
    dump() {
      throw new Error("D1 dump is not implemented by the unit-test adapter");
    }
  };
  return db;
}
