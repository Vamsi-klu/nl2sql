export class SchemaIntrospector {
    db;
    constructor(db) {
        this.db = db;
    }
    getSchema() {
        // Works for SQLite via PRAGMA
        const tables = [];
        const rows = this.db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`);
        const tableNames = rows.map((r) => r.name);
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
//# sourceMappingURL=introspect.js.map