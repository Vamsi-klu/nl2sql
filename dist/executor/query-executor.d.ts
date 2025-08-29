/**
 * Query Executor
 * Safely executes SQL queries with sandboxing and validation
 */
import { SQLDialect } from '../llm/gemini-client.js';
export interface ExecutionOptions {
    dialect?: SQLDialect;
    schema?: any;
    timeout?: number;
    maxRows?: number;
    readonly?: boolean;
}
export interface ExecutionResult {
    rows: any[];
    columns: ColumnInfo[];
    rowCount: number;
    executionTime: number;
    error?: string;
}
export interface ColumnInfo {
    name: string;
    type: string;
}
export declare class QueryExecutor {
    private databasePath;
    private db;
    constructor(databasePath?: string);
    execute(sql: string, options?: ExecutionOptions): Promise<ExecutionResult>;
    private validateSQL;
    private isSelectQuery;
    private createSchema;
    private generateCreateTableSQL;
    private mapDataType;
    private formatDefaultValue;
    private insertSampleData;
    close(): Promise<void>;
}
export declare class MockQueryExecutor extends QueryExecutor {
    execute(sql: string, options?: ExecutionOptions): Promise<ExecutionResult>;
}
