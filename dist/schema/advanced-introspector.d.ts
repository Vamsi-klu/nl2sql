/**
 * Advanced Schema Introspector
 * Provides detailed schema analysis and statistics
 */
export interface Table {
    name: string;
    columns: Column[];
    primaryKey?: string[];
    indexes?: Index[];
    constraints?: Constraint[];
}
export interface Column {
    name: string;
    type: string;
    nullable: boolean;
    defaultValue?: string;
    isPrimary?: boolean;
    isUnique?: boolean;
    references?: ForeignKeyReference;
}
export interface Index {
    name: string;
    columns: string[];
    unique: boolean;
    type?: string;
}
export interface Constraint {
    name: string;
    type: 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE' | 'CHECK';
    columns: string[];
    references?: ForeignKeyReference;
    checkExpression?: string;
}
export interface ForeignKeyReference {
    table: string;
    column: string;
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
    onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}
export interface TableStatistics {
    rowCount: number;
    avgRowSize: number;
    totalSize: number;
    indexStats: Map<string, IndexStatistics>;
}
export interface IndexStatistics {
    name: string;
    cardinality: number;
    selectivity: number;
    size: number;
}
export interface AdvancedSchema {
    tables: Table[];
    relationships?: Array<{
        from: string;
        to: string;
        column: string;
    }>;
    metadata?: Record<string, any>;
}
export declare class AdvancedIntrospector {
    private tables;
    private statistics;
    constructor();
    introspectSchema(connectionString: string): Promise<Map<string, Table>>;
    gatherStatistics(tableName: string): Promise<TableStatistics | undefined>;
    getTable(tableName: string): Table | undefined;
    getTables(): Table[];
    addTable(table: Table): void;
    getRelationships(): Array<{
        from: string;
        to: string;
        column: string;
    }>;
}
