/**
 * Base Database Adapter Interface
 * Provides abstraction layer for multiple database systems
 */
export var IsolationLevel;
(function (IsolationLevel) {
    IsolationLevel["READ_UNCOMMITTED"] = "READ UNCOMMITTED";
    IsolationLevel["READ_COMMITTED"] = "READ COMMITTED";
    IsolationLevel["REPEATABLE_READ"] = "REPEATABLE READ";
    IsolationLevel["SERIALIZABLE"] = "SERIALIZABLE";
})(IsolationLevel || (IsolationLevel = {}));
export class BaseDatabaseAdapter {
    config;
    capabilities;
    pool;
    activeTransactions;
    preparedStatements;
    constructor(config) {
        this.config = config;
        this.capabilities = this.getCapabilities();
        this.activeTransactions = new Map();
        this.preparedStatements = new Map();
    }
    // Transaction management
    async beginTransaction(isolationLevel = IsolationLevel.READ_COMMITTED, readonly = false) {
        const handle = {
            id: this.generateTransactionId(),
            isolationLevel,
            readonly,
            active: true
        };
        const sql = this.buildTransactionSQL('BEGIN', isolationLevel, readonly);
        await this.execute(sql);
        this.activeTransactions.set(handle.id, handle);
        return handle;
    }
    async commit(transactionId) {
        const handle = this.activeTransactions.get(transactionId);
        if (!handle || !handle.active) {
            throw new Error(`Transaction ${transactionId} is not active`);
        }
        await this.execute('COMMIT');
        handle.active = false;
        this.activeTransactions.delete(transactionId);
    }
    async rollback(transactionId) {
        const handle = this.activeTransactions.get(transactionId);
        if (!handle || !handle.active) {
            throw new Error(`Transaction ${transactionId} is not active`);
        }
        await this.execute('ROLLBACK');
        handle.active = false;
        this.activeTransactions.delete(transactionId);
    }
    async savepoint(name) {
        if (!this.capabilities.savepoints) {
            throw new Error('Savepoints are not supported by this database');
        }
        await this.execute(`SAVEPOINT ${this.escapeIdentifier(name)}`);
    }
    async rollbackToSavepoint(name) {
        if (!this.capabilities.savepoints) {
            throw new Error('Savepoints are not supported by this database');
        }
        await this.execute(`ROLLBACK TO SAVEPOINT ${this.escapeIdentifier(name)}`);
    }
    // Prepared statements
    async prepare(sql, name) {
        if (!this.capabilities.preparedStatements) {
            throw new Error('Prepared statements are not supported by this database');
        }
        const statement = {
            id: name || this.generateStatementId(),
            sql,
            parameters: this.parseParameters(sql)
        };
        // Database-specific preparation logic would go here
        this.preparedStatements.set(statement.id, statement);
        return statement;
    }
    async executePrepared(statementId, params) {
        const statement = this.preparedStatements.get(statementId);
        if (!statement) {
            throw new Error(`Prepared statement ${statementId} not found`);
        }
        return this.execute(statement.sql, params);
    }
    async unprepare(statementId) {
        this.preparedStatements.delete(statementId);
    }
    // Streaming support
    async *stream(sql, params, options = {}) {
        const batchSize = options.batchSize || 1000;
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
            const batchSQL = `${sql} LIMIT ${batchSize} OFFSET ${offset}`;
            const result = await this.execute(batchSQL, params);
            for (const row of result.rows) {
                yield row;
            }
            hasMore = result.rows.length === batchSize;
            offset += batchSize;
        }
    }
    // Query building helpers
    buildSelect(options) {
        const parts = ['SELECT'];
        if (options.distinct) {
            parts.push('DISTINCT');
        }
        parts.push(options.columns.join(', '));
        parts.push('FROM', options.from);
        if (options.joins) {
            for (const join of options.joins) {
                parts.push(`${join.type} JOIN ${join.table} ON ${join.condition}`);
            }
        }
        if (options.where) {
            parts.push('WHERE', options.where);
        }
        if (options.groupBy) {
            parts.push('GROUP BY', options.groupBy.join(', '));
        }
        if (options.having) {
            parts.push('HAVING', options.having);
        }
        if (options.orderBy) {
            parts.push('ORDER BY', options.orderBy.join(', '));
        }
        if (options.limit) {
            parts.push('LIMIT', options.limit.toString());
        }
        if (options.offset) {
            parts.push('OFFSET', options.offset.toString());
        }
        return parts.join(' ');
    }
    buildInsert(table, data) {
        const columns = Object.keys(data);
        const values = columns.map(col => this.escapeLiteral(data[col]));
        return `INSERT INTO ${this.escapeIdentifier(table)} (${columns.map(c => this.escapeIdentifier(c)).join(', ')}) VALUES (${values.join(', ')})`;
    }
    buildUpdate(table, data, where) {
        const sets = Object.entries(data)
            .map(([col, val]) => `${this.escapeIdentifier(col)} = ${this.escapeLiteral(val)}`)
            .join(', ');
        let sql = `UPDATE ${this.escapeIdentifier(table)} SET ${sets}`;
        if (where) {
            sql += ` WHERE ${where}`;
        }
        return sql;
    }
    buildDelete(table, where) {
        let sql = `DELETE FROM ${this.escapeIdentifier(table)}`;
        if (where) {
            sql += ` WHERE ${where}`;
        }
        return sql;
    }
    // Utility methods
    async ping() {
        try {
            await this.execute('SELECT 1');
            return true;
        }
        catch {
            return false;
        }
    }
    async getVersion() {
        const result = await this.execute(this.getVersionQuery());
        return result.rows[0]?.version || 'unknown';
    }
    async analyze(table) {
        await this.execute(`ANALYZE ${this.escapeIdentifier(table)}`);
    }
    async vacuum(table) {
        const sql = table
            ? `VACUUM ${this.escapeIdentifier(table)}`
            : 'VACUUM';
        await this.execute(sql);
    }
    async explain(sql, analyze = false) {
        const explainSQL = analyze
            ? `EXPLAIN ANALYZE ${sql}`
            : `EXPLAIN ${sql}`;
        const result = await this.execute(explainSQL);
        return this.parseExplainOutput(result);
    }
    // Protected helper methods
    buildTransactionSQL(command, isolationLevel, readonly) {
        let sql = command;
        if (command === 'BEGIN') {
            if (readonly) {
                sql += ' READ ONLY';
            }
            sql += ` ISOLATION LEVEL ${isolationLevel}`;
        }
        return sql;
    }
    parseParameters(sql) {
        const params = [];
        const regex = /\$(\d+)|:(\w+)|\?/g;
        let match;
        let position = 1;
        while ((match = regex.exec(sql)) !== null) {
            if (match[1]) {
                // Positional parameter $1, $2, etc.
                params.push({
                    position: parseInt(match[1]),
                    type: 'unknown'
                });
            }
            else if (match[2]) {
                // Named parameter :name
                params.push({
                    position,
                    name: match[2],
                    type: 'unknown'
                });
            }
            else {
                // Question mark parameter
                params.push({
                    position,
                    type: 'unknown'
                });
            }
            position++;
        }
        return params;
    }
    parseExplainOutput(result) {
        // This would be implemented differently for each database
        return result.rows.map(row => ({
            operation: row.operation || 'Unknown',
            cost: parseFloat(row.cost || '0'),
            rows: parseInt(row.rows || '0'),
            width: parseInt(row.width || '0'),
            details: row
        }));
    }
    generateTransactionId() {
        return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateStatementId() {
        return `stmt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
export var SqlDialect;
(function (SqlDialect) {
    SqlDialect["POSTGRESQL"] = "postgresql";
    SqlDialect["MYSQL"] = "mysql";
    SqlDialect["SQLITE"] = "sqlite";
    SqlDialect["SQLSERVER"] = "sqlserver";
    SqlDialect["ORACLE"] = "oracle";
    SqlDialect["MARIADB"] = "mariadb";
    SqlDialect["SNOWFLAKE"] = "snowflake";
    SqlDialect["BIGQUERY"] = "bigquery";
    SqlDialect["REDSHIFT"] = "redshift";
    SqlDialect["CLICKHOUSE"] = "clickhouse";
})(SqlDialect || (SqlDialect = {}));
//# sourceMappingURL=base-adapter.js.map