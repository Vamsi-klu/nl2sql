/**
 * Query Executor
 * Safely executes SQL queries with sandboxing and validation
 */
import Database from 'better-sqlite3';
export class QueryExecutor {
    databasePath;
    db = null;
    constructor(databasePath = ':memory:') {
        this.databasePath = databasePath;
    }
    async execute(sql, options = {}) {
        const startTime = Date.now();
        try {
            // Validate SQL for safety
            this.validateSQL(sql, options.readonly);
            // Initialize database
            if (!this.db) {
                this.db = new Database(this.databasePath);
                // Set timeout
                if (options.timeout) {
                    this.db.pragma(`busy_timeout = ${options.timeout}`);
                }
                // Create schema if provided
                if (options.schema) {
                    await this.createSchema(options.schema);
                }
            }
            // Execute query
            let rows = [];
            let columns = [];
            if (this.isSelectQuery(sql)) {
                const stmt = this.db.prepare(sql);
                rows = stmt.all();
                // Get column info
                if (rows.length > 0) {
                    columns = Object.keys(rows[0]).map(name => ({
                        name,
                        type: typeof rows[0][name]
                    }));
                }
                // Limit rows if specified
                if (options.maxRows && rows.length > options.maxRows) {
                    rows = rows.slice(0, options.maxRows);
                }
            }
            else {
                // For non-SELECT queries
                const result = this.db.prepare(sql).run();
                rows = [{
                        changes: result.changes,
                        lastInsertRowid: result.lastInsertRowid
                    }];
                columns = [
                    { name: 'changes', type: 'number' },
                    { name: 'lastInsertRowid', type: 'number' }
                ];
            }
            const executionTime = Date.now() - startTime;
            return {
                rows,
                columns,
                rowCount: rows.length,
                executionTime
            };
        }
        catch (error) {
            const executionTime = Date.now() - startTime;
            return {
                rows: [],
                columns: [],
                rowCount: 0,
                executionTime,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    validateSQL(sql, readonly = false) {
        const normalizedSQL = sql.trim().toUpperCase();
        // Block dangerous operations
        const dangerousPatterns = [
            /DROP\s+DATABASE/,
            /DROP\s+SCHEMA/,
            /TRUNCATE/,
            /EXEC\s*\(/,
            /EXECUTE\s+IMMEDIATE/,
            /INTO\s+OUTFILE/,
            /LOAD\s+DATA/
        ];
        for (const pattern of dangerousPatterns) {
            if (pattern.test(normalizedSQL)) {
                throw new Error(`Dangerous SQL operation detected: ${pattern}`);
            }
        }
        // In readonly mode, block all modifications
        if (readonly) {
            const modifyingPatterns = [
                /^INSERT\s+/,
                /^UPDATE\s+/,
                /^DELETE\s+/,
                /^DROP\s+/,
                /^CREATE\s+/,
                /^ALTER\s+/,
                /^TRUNCATE\s+/
            ];
            for (const pattern of modifyingPatterns) {
                if (pattern.test(normalizedSQL)) {
                    throw new Error('Modification queries are not allowed in readonly mode');
                }
            }
        }
    }
    isSelectQuery(sql) {
        const normalized = sql.trim().toUpperCase();
        return normalized.startsWith('SELECT') ||
            normalized.startsWith('WITH') ||
            normalized.startsWith('EXPLAIN');
    }
    async createSchema(schema) {
        if (!this.db)
            return;
        // Create tables from schema definition
        if (schema.tables) {
            for (const table of schema.tables) {
                const createTableSQL = this.generateCreateTableSQL(table);
                this.db.prepare(createTableSQL).run();
                // Insert sample data if provided
                if (table.sampleData) {
                    this.insertSampleData(table.name, table.sampleData);
                }
            }
        }
    }
    generateCreateTableSQL(table) {
        const columns = table.columns.map((col) => {
            let columnDef = `${col.name} ${this.mapDataType(col.type)}`;
            if (!col.nullable) {
                columnDef += ' NOT NULL';
            }
            if (col.defaultValue !== undefined) {
                columnDef += ` DEFAULT ${this.formatDefaultValue(col.defaultValue)}`;
            }
            return columnDef;
        }).join(', ');
        let sql = `CREATE TABLE IF NOT EXISTS ${table.name} (${columns}`;
        if (table.primaryKey && table.primaryKey.length > 0) {
            sql += `, PRIMARY KEY (${table.primaryKey.join(', ')})`;
        }
        sql += ')';
        return sql;
    }
    mapDataType(type) {
        const upper = type.toUpperCase();
        // Map to SQLite types
        if (upper.includes('INT'))
            return 'INTEGER';
        if (upper.includes('VARCHAR') || upper.includes('CHAR') || upper.includes('TEXT'))
            return 'TEXT';
        if (upper.includes('DECIMAL') || upper.includes('NUMERIC') || upper.includes('FLOAT') || upper.includes('DOUBLE'))
            return 'REAL';
        if (upper.includes('BOOL'))
            return 'INTEGER';
        if (upper.includes('DATE') || upper.includes('TIME'))
            return 'TEXT';
        if (upper.includes('BLOB') || upper.includes('BINARY'))
            return 'BLOB';
        return 'TEXT'; // Default
    }
    formatDefaultValue(value) {
        if (value === null)
            return 'NULL';
        if (typeof value === 'string')
            return `'${value}'`;
        if (typeof value === 'boolean')
            return value ? '1' : '0';
        return String(value);
    }
    insertSampleData(tableName, data) {
        if (!this.db || data.length === 0)
            return;
        const columns = Object.keys(data[0]);
        const placeholders = columns.map(() => '?').join(', ');
        const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
        const stmt = this.db.prepare(sql);
        for (const row of data) {
            const values = columns.map(col => row[col]);
            stmt.run(values);
        }
    }
    async close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}
// Mock executor for testing without database
export class MockQueryExecutor extends QueryExecutor {
    async execute(sql, options = {}) {
        // Return mock data based on query
        const normalizedSQL = sql.trim().toUpperCase();
        if (normalizedSQL.includes('CUSTOMERS')) {
            return {
                rows: [
                    { id: 1, name: 'John Doe', email: 'john@example.com', country: 'USA' },
                    { id: 2, name: 'Jane Smith', email: 'jane@example.com', country: 'UK' }
                ],
                columns: [
                    { name: 'id', type: 'number' },
                    { name: 'name', type: 'string' },
                    { name: 'email', type: 'string' },
                    { name: 'country', type: 'string' }
                ],
                rowCount: 2,
                executionTime: 15
            };
        }
        if (normalizedSQL.includes('REVENUE')) {
            return {
                rows: [
                    { category: 'Electronics', total_revenue: 125000, order_count: 250 },
                    { category: 'Clothing', total_revenue: 87500, order_count: 175 }
                ],
                columns: [
                    { name: 'category', type: 'string' },
                    { name: 'total_revenue', type: 'number' },
                    { name: 'order_count', type: 'number' }
                ],
                rowCount: 2,
                executionTime: 25
            };
        }
        // Default response
        return {
            rows: [{ result: 'Query executed successfully' }],
            columns: [{ name: 'result', type: 'string' }],
            rowCount: 1,
            executionTime: 10
        };
    }
}
//# sourceMappingURL=query-executor.js.map