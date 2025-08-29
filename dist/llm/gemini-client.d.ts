/**
 * Gemini API Client for NL2SQL
 * Handles communication with Google's Gemini API for SQL generation
 */
export interface GeminiConfig {
    apiKey: string;
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
}
export interface QueryGenerationRequest {
    naturalLanguageQuery: string;
    schema: SchemaDefinition;
    dialect?: SQLDialect;
    context?: QueryContext;
}
export interface SchemaDefinition {
    tables: TableDefinition[];
    relationships?: RelationshipDefinition[];
    metadata?: Record<string, unknown>;
}
export interface TableDefinition {
    name: string;
    columns: ColumnDefinition[];
    primaryKey?: string[];
    indexes?: IndexDefinition[];
    description?: string;
}
export interface ColumnDefinition {
    name: string;
    type: string;
    nullable?: boolean;
    defaultValue?: unknown;
    description?: string;
    constraints?: string[];
}
export interface RelationshipDefinition {
    from: {
        table: string;
        column: string;
    };
    to: {
        table: string;
        column: string;
    };
    type: 'one-to-one' | 'one-to-many' | 'many-to-many';
}
export interface IndexDefinition {
    name: string;
    columns: string[];
    unique?: boolean;
    type?: string;
}
export interface QueryContext {
    previousQueries?: string[];
    userPreferences?: Record<string, unknown>;
    businessRules?: string[];
}
export declare enum SQLDialect {
    POSTGRESQL = "postgresql",
    MYSQL = "mysql",
    SQLITE = "sqlite",
    SQLSERVER = "sqlserver",
    ORACLE = "oracle"
}
export interface QueryGenerationResponse {
    sql: string;
    explanation: string;
    confidence: number;
    alternativeQueries?: string[];
    warnings?: string[];
    optimizationSuggestions?: string[];
}
export declare class GeminiClient {
    private genAI;
    private model;
    private config;
    private generationConfig;
    constructor(config: GeminiConfig);
    generateSQL(request: QueryGenerationRequest): Promise<QueryGenerationResponse>;
    private buildPrompt;
    private formatSchema;
    private formatRelationships;
    private formatContext;
    private parseResponse;
    validateSQL(sql: string, dialect?: SQLDialect): Promise<boolean>;
    explainSQL(sql: string): Promise<string>;
    optimizeSQL(sql: string, schema: SchemaDefinition): Promise<string>;
    detectSchema(sampleData: Record<string, unknown>[]): Promise<SchemaDefinition>;
    suggestQueries(schema: SchemaDefinition): Promise<string[]>;
}
export declare function initializeGeminiClient(config: GeminiConfig): GeminiClient;
export declare function getGeminiClient(): GeminiClient;
