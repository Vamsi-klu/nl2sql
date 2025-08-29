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
export declare enum IsolationLevel {
    READ_UNCOMMITTED = "READ UNCOMMITTED",
    READ_COMMITTED = "READ COMMITTED",
    REPEATABLE_READ = "REPEATABLE READ",
    SERIALIZABLE = "SERIALIZABLE"
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
export declare abstract class BaseDatabaseAdapter {
    protected config: ConnectionConfig;
    protected capabilities: DatabaseCapabilities;
    protected pool: any;
    protected activeTransactions: Map<string, TransactionHandle>;
    protected preparedStatements: Map<string, PreparedStatement>;
    constructor(config: ConnectionConfig);
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
    beginTransaction(isolationLevel?: IsolationLevel, readonly?: boolean): Promise<TransactionHandle>;
    commit(transactionId: string): Promise<void>;
    rollback(transactionId: string): Promise<void>;
    savepoint(name: string): Promise<void>;
    rollbackToSavepoint(name: string): Promise<void>;
    prepare(sql: string, name?: string): Promise<PreparedStatement>;
    executePrepared(statementId: string, params?: unknown[]): Promise<QueryResult>;
    unprepare(statementId: string): Promise<void>;
    stream(sql: string, params?: unknown[], options?: StreamOptions): AsyncGenerator<Record<string, unknown>, void, unknown>;
    buildSelect(options: SelectOptions): string;
    buildInsert(table: string, data: Record<string, unknown>): string;
    buildUpdate(table: string, data: Record<string, unknown>, where?: string): string;
    buildDelete(table: string, where?: string): string;
    ping(): Promise<boolean>;
    getVersion(): Promise<string>;
    analyze(table: string): Promise<void>;
    vacuum(table?: string): Promise<void>;
    explain(sql: string, analyze?: boolean): Promise<QueryPlanNode[]>;
    protected buildTransactionSQL(command: string, isolationLevel: IsolationLevel, readonly: boolean): string;
    protected parseParameters(sql: string): ParameterInfo[];
    protected parseExplainOutput(result: QueryResult): QueryPlanNode[];
    protected generateTransactionId(): string;
    protected generateStatementId(): string;
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
export declare enum SqlDialect {
    POSTGRESQL = "postgresql",
    MYSQL = "mysql",
    SQLITE = "sqlite",
    SQLSERVER = "sqlserver",
    ORACLE = "oracle",
    MARIADB = "mariadb",
    SNOWFLAKE = "snowflake",
    BIGQUERY = "bigquery",
    REDSHIFT = "redshift",
    CLICKHOUSE = "clickhouse"
}
