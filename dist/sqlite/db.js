import initSqlJs from 'sql.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
export class Database {
    SQL;
    db; // sql.js Database
    async init() {
        this.SQL = await initSqlJs({
            locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm'),
        });
        this.db = new this.SQL.Database();
    }
    exec(sql, params) {
        const stmt = this.db.prepare(sql);
        try {
            if (params)
                stmt.bind(params);
            const rows = [];
            while (stmt.step()) {
                const row = stmt.getAsObject();
                rows.push(row);
            }
            return rows;
        }
        finally {
            stmt.free();
        }
    }
    run(sql) {
        this.db.run(sql);
    }
    loadJsonTable(name, rows) {
        if (rows.length === 0)
            return;
        // If table exists, use its column list; otherwise create table based on row keys.
        const exists = this.exec(`SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name=${JSON.stringify(name)} LIMIT 1`).length > 0;
        let columns;
        if (exists) {
            const pragma = this.exec(`PRAGMA table_info(${JSON.stringify(name)})`);
            columns = pragma.map((c) => String(c.name));
        }
        else {
            columns = Array.from(rows.reduce((set, r) => {
                for (const k of Object.keys(r))
                    set.add(k);
                return set;
            }, new Set()));
            const colDefs = columns.map((c) => `${JSON.stringify(c)} TEXT`).join(', ');
            this.run(`CREATE TABLE ${JSON.stringify(name)} (${colDefs});`);
        }
        const placeholders = columns.map(() => '?').join(',');
        const insert = this.db.prepare(`INSERT INTO ${JSON.stringify(name)} (${columns.map((c) => JSON.stringify(c)).join(',')}) VALUES (${placeholders})`);
        try {
            this.db.run('BEGIN');
            for (const r of rows) {
                insert.bind(columns.map((c) => r[c] ?? null));
                insert.step();
                insert.reset();
            }
            this.db.run('COMMIT');
        }
        finally {
            insert.free();
        }
    }
}
//# sourceMappingURL=db.js.map