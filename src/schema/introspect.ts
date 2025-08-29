import { Database } from '../sqlite/db.js';

export interface TableInfo {
  name: string;
  columns: { name: string; type?: string; pk?: boolean }[];
}

export interface SchemaInfo {
  tables: TableInfo[];
}

export class SchemaIntrospector {
  constructor(private db: Database) {}

  getSchema(): SchemaInfo {
    // Works for SQLite via PRAGMA
    const tables: TableInfo[] = [];
    const rows = this.db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`);
    const tableNames = rows.map((r) => r.name as string);
    for (const t of tableNames) {
      const cols = this.db.exec(`PRAGMA table_info(${JSON.stringify(t)})`);
      tables.push({
        name: t,
        columns: cols.map((c) => ({ name: String(c.name), type: c.type ? String(c.type) : undefined, pk: c.pk === 1 })),
      });
    }
    return { tables };
  }
}

