/**
 * Base Database Adapter Interface
 * Provides abstraction layer for multiple database systems
 */

import { AdvancedSchema } from '../schema/advanced-introspector.js';

export interface QueryResult {
  rows: Record<string, unknown>[];
  fields: FieldInfo[];
  rowCount: number;
  executionTime: number;
  queryPlan?: QueryPlanNode[];
}

export interface FieldInfo {
  name: string;
  type: string;
  nullable: boolean;
  length?: number;
  precision?: number;
  scale?: number;
}

export interface QueryPlanNode {
  operation: string;
  cost: number;
  rows: number;
  width: number;
  details?: Record<string, unknown>;
  children?: QueryPlanNode[];
}

export interface ConnectionConfig {
  host?: string;
  port?: number;
  database: string;
  user?: string;
  password?: string;
  ssl?: boolean | SSLConfig;
  poolSize?: number;
  connectionTimeout?: number;
  queryTimeout?: number;
  schema?: string;
  options?: Record<string, unknown>;
}

export interface SSLConfig {
  rejectUnauthorized?: boolean;
  ca?: string;
  cert?: string;
  key?: string;
}

export interface TransactionHandle {
  id: string;
  isolationLevel: IsolationLevel;
  readonly: boolean;
  active: boolean;
}

export enum IsolationLevel {
  READ_UNCOMMITTED = 'READ UNCOMMITTED',
  READ_COMMITTED = 'READ COMMITTED',
  REPEATABLE_READ = 'REPEATABLE READ',
  SERIALIZABLE = 'SERIALIZABLE'
}

export interface PreparedStatement {
  id: string;
  sql: string;
  parameters: ParameterInfo[];
}

export interface ParameterInfo {
  position: number;
  name?: string;
  type: string;
  optional?: boolean;
}

export interface BatchResult {
  results: QueryResult[];
  totalRows: number;
  totalTime: number;
  errors?: Error[];
}

export interface StreamOptions {
  batchSize?: number;
  highWaterMark?: number;
  objectMode?: boolean;
}

export interface DatabaseCapabilities {
  transactions: boolean;
  savepoints: boolean;
  preparedStatements: boolean;
  storedProcedures: boolean;
  triggers: boolean;
  views: boolean;
  materializedViews: boolean;
  CTEs: boolean;
  windowFunctions: boolean;
  recursiveCTEs: boolean;
  arrays: boolean;
  json: boolean;
  fullTextSearch: boolean;
  geospatial: boolean;
  partitioning: boolean;
  replication: boolean;
}

export abstract class BaseDatabaseAdapter {
  protected config: ConnectionConfig;
  protected capabilities: DatabaseCapabilities;
  protected pool: any;
  protected activeTransactions: Map<string, TransactionHandle>;
  protected preparedStatements: Map<string, PreparedStatement>;
  
  constructor(config: ConnectionConfig) {
    this.config = config;
    this.capabilities = this.getCapabilities();
    this.activeTransactions = new Map();
    this.preparedStatements = new Map();
  }
  
  // Abstract methods that must be implemented by each adapter
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract execute(sql: string, params?: unknown[]): Promise<QueryResult>;
  abstract executeMany(sql: string, paramSets: unknown[][]): Promise<BatchResult>;
  abstract getSchema(): Promise<AdvancedSchema>;
  abstract getCapabilities(): DatabaseCapabilities;
  abstract escapeIdentifier(identifier: string): string;
  abstract escapeLiteral(value: unknown): string;
  abstract formatDate(date: Date): string;
  abstract getDialect(): SqlDialect;
  
  // Transaction management
  async beginTransaction(
    isolationLevel: IsolationLevel = IsolationLevel.READ_COMMITTED,
    readonly: boolean = false
  ): Promise<TransactionHandle> {
    const handle: TransactionHandle = {
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
  
  async commit(transactionId: string): Promise<void> {
    const handle = this.activeTransactions.get(transactionId);
    if (!handle || !handle.active) {
      throw new Error(`Transaction ${transactionId} is not active`);
    }
    
    await this.execute('COMMIT');
    handle.active = false;
    this.activeTransactions.delete(transactionId);
  }
  
  async rollback(transactionId: string): Promise<void> {
    const handle = this.activeTransactions.get(transactionId);
    if (!handle || !handle.active) {
      throw new Error(`Transaction ${transactionId} is not active`);
    }
    
    await this.execute('ROLLBACK');
    handle.active = false;
    this.activeTransactions.delete(transactionId);
  }
  
  async savepoint(name: string): Promise<void> {
    if (!this.capabilities.savepoints) {
      throw new Error('Savepoints are not supported by this database');
    }
    
    await this.execute(`SAVEPOINT ${this.escapeIdentifier(name)}`);
  }
  
  async rollbackToSavepoint(name: string): Promise<void> {
    if (!this.capabilities.savepoints) {
      throw new Error('Savepoints are not supported by this database');
    }
    
    await this.execute(`ROLLBACK TO SAVEPOINT ${this.escapeIdentifier(name)}`);
  }
  
  // Prepared statements
  async prepare(sql: string, name?: string): Promise<PreparedStatement> {
    if (!this.capabilities.preparedStatements) {
      throw new Error('Prepared statements are not supported by this database');
    }
    
    const statement: PreparedStatement = {
      id: name || this.generateStatementId(),
      sql,
      parameters: this.parseParameters(sql)
    };
    
    // Database-specific preparation logic would go here
    this.preparedStatements.set(statement.id, statement);
    
    return statement;
  }
  
  async executePrepared(
    statementId: string,
    params?: unknown[]
  ): Promise<QueryResult> {
    const statement = this.preparedStatements.get(statementId);
    if (!statement) {
      throw new Error(`Prepared statement ${statementId} not found`);
    }
    
    return this.execute(statement.sql, params);
  }
  
  async unprepare(statementId: string): Promise<void> {
    this.preparedStatements.delete(statementId);
  }
  
  // Streaming support
  async *stream(
    sql: string,
    params?: unknown[],
    options: StreamOptions = {}
  ): AsyncGenerator<Record<string, unknown>, void, unknown> {
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
  buildSelect(options: SelectOptions): string {
    const parts: string[] = ['SELECT'];
    
    if (options.distinct) {
      parts.push('DISTINCT');
    }
    
    parts.push(options.columns.join(', '));
    parts.push('FROM', options.from);
    
    if (options.joins) {
      for (const join of options.joins) {
        parts.push(
          `${join.type} JOIN ${join.table} ON ${join.condition}`
        );
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
  
  buildInsert(table: string, data: Record<string, unknown>): string {
    const columns = Object.keys(data);
    const values = columns.map(col => this.escapeLiteral(data[col]));
    
    return `INSERT INTO ${this.escapeIdentifier(table)} (${columns.map(c => this.escapeIdentifier(c)).join(', ')}) VALUES (${values.join(', ')})`;
  }
  
  buildUpdate(
    table: string,
    data: Record<string, unknown>,
    where?: string
  ): string {
    const sets = Object.entries(data)
      .map(([col, val]) => `${this.escapeIdentifier(col)} = ${this.escapeLiteral(val)}`)
      .join(', ');
    
    let sql = `UPDATE ${this.escapeIdentifier(table)} SET ${sets}`;
    
    if (where) {
      sql += ` WHERE ${where}`;
    }
    
    return sql;
  }
  
  buildDelete(table: string, where?: string): string {
    let sql = `DELETE FROM ${this.escapeIdentifier(table)}`;
    
    if (where) {
      sql += ` WHERE ${where}`;
    }
    
    return sql;
  }
  
  // Utility methods
  async ping(): Promise<boolean> {
    try {
      await this.execute('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
  
  async getVersion(): Promise<string> {
    const result = await this.execute(this.getVersionQuery());
    return result.rows[0]?.version as string || 'unknown';
  }
  
  async analyze(table: string): Promise<void> {
    await this.execute(`ANALYZE ${this.escapeIdentifier(table)}`);
  }
  
  async vacuum(table?: string): Promise<void> {
    const sql = table
      ? `VACUUM ${this.escapeIdentifier(table)}`
      : 'VACUUM';
    
    await this.execute(sql);
  }
  
  async explain(sql: string, analyze: boolean = false): Promise<QueryPlanNode[]> {
    const explainSQL = analyze
      ? `EXPLAIN ANALYZE ${sql}`
      : `EXPLAIN ${sql}`;
    
    const result = await this.execute(explainSQL);
    return this.parseExplainOutput(result);
  }
  
  // Protected helper methods
  protected buildTransactionSQL(
    command: string,
    isolationLevel: IsolationLevel,
    readonly: boolean
  ): string {
    let sql = command;
    
    if (command === 'BEGIN') {
      if (readonly) {
        sql += ' READ ONLY';
      }
      
      sql += ` ISOLATION LEVEL ${isolationLevel}`;
    }
    
    return sql;
  }
  
  protected parseParameters(sql: string): ParameterInfo[] {
    const params: ParameterInfo[] = [];
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
      } else if (match[2]) {
        // Named parameter :name
        params.push({
          position,
          name: match[2],
          type: 'unknown'
        });
      } else {
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
  
  protected parseExplainOutput(result: QueryResult): QueryPlanNode[] {
    // This would be implemented differently for each database
    return result.rows.map(row => ({
      operation: row.operation as string || 'Unknown',
      cost: parseFloat(row.cost as string || '0'),
      rows: parseInt(row.rows as string || '0'),
      width: parseInt(row.width as string || '0'),
      details: row
    }));
  }
  
  protected generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  protected generateStatementId(): string {
    return `stmt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  protected abstract getVersionQuery(): string;
}

export interface SelectOptions {
  columns: string[];
  from: string;
  joins?: JoinOption[];
  where?: string;
  groupBy?: string[];
  having?: string;
  orderBy?: string[];
  limit?: number;
  offset?: number;
  distinct?: boolean;
}

export interface JoinOption {
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'CROSS';
  table: string;
  condition: string;
}

export enum SqlDialect {
  POSTGRESQL = 'postgresql',
  MYSQL = 'mysql',
  SQLITE = 'sqlite',
  SQLSERVER = 'sqlserver',
  ORACLE = 'oracle',
  MARIADB = 'mariadb',
  SNOWFLAKE = 'snowflake',
  BIGQUERY = 'bigquery',
  REDSHIFT = 'redshift',
  CLICKHOUSE = 'clickhouse'
}