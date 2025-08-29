import { Database } from './sqlite/db.js';
import { SchemaIntrospector } from './schema/introspect.js';
import { parseIntentToIR } from './parser/intent.js';
import { optimizeIR } from './optimizer/optimizer.js';
import { generateSQL } from './generator/sql.js';
import { explain } from './explain/explainer.js';
import type { SqlDialect } from './ir/types.js';

export interface RunOptions {
  prompt: string;
  schemaSql?: string; // optional SQL schema (CREATE TABLE ...)
  datasets?: Record<string, Record<string, unknown>[]>; // tableName -> rows
  execute?: boolean;
  dialect?: SqlDialect; // affects SQL generation; execution demo supports sqlite only
}

export class NL2SQL {
  async run(opts: RunOptions): Promise<{ sql: string; explanation: string; rows?: any[]; note?: string }> {
    const db = new Database();
    await db.init();

    if (opts.schemaSql) {
      db.run(opts.schemaSql);
    }
    if (opts.datasets) {
      for (const [table, rows] of Object.entries(opts.datasets)) {
        db.loadJsonTable(table, rows);
      }
    }

    const schema = new SchemaIntrospector(db).getSchema();
    const ir = parseIntentToIR(opts.prompt, schema, { defaultTable: schema.tables[0]?.name });
    const optimized = optimizeIR(ir);
    const sql = generateSQL(optimized, opts.dialect ?? 'sqlite');
    const summary = explain(optimized);

    if (opts.execute) {
      if (opts.dialect && opts.dialect !== 'sqlite') {
        return { sql, explanation: summary, rows: [], note: 'Execution demo supports sqlite only. SQL generated for selected dialect.' };
      }
      const rows = db.exec(sql);
      return { sql, explanation: summary, rows };
    }
    return { sql, explanation: summary };
  }
}
