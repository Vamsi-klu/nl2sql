/**
 * Universal Schema Parser
 * Parses schemas from multiple formats: SQL DDL, JSON, CSV headers, natural language
 */
import { SchemaDefinition } from '../llm/gemini-client.js';
export declare enum SchemaFormat {
    SQL_DDL = "sql_ddl",
    JSON = "json",
    CSV = "csv",
    NATURAL_LANGUAGE = "natural_language",
    AUTO_DETECT = "auto_detect"
}
export interface ParseOptions {
    format?: SchemaFormat;
    inferRelationships?: boolean;
    detectIndexes?: boolean;
    sampleData?: Record<string, unknown>[];
}
export declare class SchemaParser {
    parse(input: string, options?: ParseOptions): Promise<SchemaDefinition>;
    private detectFormat;
    private parseWithFormat;
    private parseSQLDDL;
    private parseJSON;
    private parseJSONTableInfo;
    private parseCSV;
    private parseNaturalLanguage;
    private basicNaturalLanguageParse;
    private inferSchemaFromData;
    private inferTypeFromValue;
    private inferTypeFromSamples;
    private inferRelationships;
    private detectOptimalIndexes;
    private enrichWithSampleData;
    private normalizeDataType;
    private extractDefault;
    private extractConstraints;
}
