import { Database } from './sqlite/db.js';
import { SchemaIntrospector } from './schema/introspect.js';
import { parseIntentToIR } from './parser/intent.js';
import { optimizeIR } from './optimizer/optimizer.js';
import { generateSQL } from './generator/sql.js';
import { explain } from './explain/explainer.js';
export class NL2SQL {
    async run(opts) {
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
//# sourceMappingURL=NL2SQL.js.map