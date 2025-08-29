/**
 * Advanced Entity Recognition System for NL2SQL
 * Identifies and classifies database entities in natural language queries
 */
import { Token } from '../tokenizer/advanced-tokenizer.js';
export interface Entity {
    text: string;
    type: EntityType;
    subtype?: string;
    confidence: number;
    position: number;
    length: number;
    resolvedName?: string;
    metadata?: Record<string, unknown>;
}
export declare enum EntityType {
    TABLE = "TABLE",
    COLUMN = "COLUMN",
    VALUE = "VALUE",
    FUNCTION = "FUNCTION",
    OPERATOR = "OPERATOR",
    CONDITION = "CONDITION",
    AGGREGATION = "AGGREGATION",
    TEMPORAL = "TEMPORAL",
    NUMERIC = "NUMERIC",
    TEXT = "TEXT",
    BOOLEAN = "BOOLEAN",
    NULL = "NULL",
    UNKNOWN = "UNKNOWN"
}
export interface SchemaContext {
    tables: TableInfo[];
    relationships: RelationshipInfo[];
    functions: FunctionInfo[];
}
export interface TableInfo {
    name: string;
    alias?: string[];
    columns: ColumnInfo[];
    primaryKey?: string[];
    indexes?: IndexInfo[];
}
export interface ColumnInfo {
    name: string;
    type: string;
    nullable: boolean;
    defaultValue?: unknown;
    foreignKey?: ForeignKeyInfo;
    unique?: boolean;
    description?: string;
}
export interface RelationshipInfo {
    from: {
        table: string;
        column: string;
    };
    to: {
        table: string;
        column: string;
    };
    type: 'one-to-one' | 'one-to-many' | 'many-to-many';
    name?: string;
}
export interface ForeignKeyInfo {
    table: string;
    column: string;
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
    onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
}
export interface IndexInfo {
    name: string;
    columns: string[];
    unique: boolean;
    type?: 'btree' | 'hash' | 'gin' | 'gist';
}
export interface FunctionInfo {
    name: string;
    type: 'scalar' | 'aggregate' | 'window' | 'table';
    parameters: ParameterInfo[];
    returnType: string;
    description?: string;
}
export interface ParameterInfo {
    name: string;
    type: string;
    optional?: boolean;
    defaultValue?: unknown;
}
export declare class EntityRecognizer {
    private schema;
    private synonymMap;
    private fuzzyMatcher;
    private contextualResolver;
    constructor(schema: SchemaContext);
    recognize(tokens: Token[]): Entity[];
    private recognizeEntity;
    private directMatch;
    private matches;
    private recognizeByType;
    private buildSynonymMap;
    private buildContext;
    private resolveAmbiguities;
    private findTablesWithColumn;
    private createEntity;
    private normalizeAggregation;
    private normalizeOperator;
    private parseTemporal;
}
