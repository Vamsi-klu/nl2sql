export interface ProcessedFile {
    id: string;
    originalName: string;
    mimeType: string;
    size: number;
    uploadedAt: Date;
    processedAt: Date;
    type: 'schema' | 'data' | 'mixed' | 'unknown';
    content: {
        schema?: DatabaseSchema;
        data?: any[];
        raw?: string;
        tables?: {
            [tableName: string]: any[];
        };
    };
    metadata: {
        fileType: string;
        columns?: string[];
        rowCount?: number;
        estimatedType?: string;
        processingTime: number;
    };
}
export interface DatabaseSchema {
    tables: TableSchema[];
    relationships?: Relationship[];
}
export interface TableSchema {
    name: string;
    columns: ColumnSchema[];
    primaryKey?: string[];
    indexes?: string[];
}
export interface ColumnSchema {
    name: string;
    type: string;
    nullable: boolean;
    defaultValue?: any;
    isPrimaryKey?: boolean;
    isForeignKey?: boolean;
    references?: {
        table: string;
        column: string;
    };
}
export interface Relationship {
    type: 'one-to-one' | 'one-to-many' | 'many-to-many';
    fromTable: string;
    fromColumn: string;
    toTable: string;
    toColumn: string;
}
export declare class SimpleFileProcessor {
    private uploadDir;
    private maxFileSize;
    constructor(uploadDir?: string, maxFileSize?: number);
    private ensureUploadDir;
    processFile(filePath: string, originalName: string, mimeType: string): Promise<ProcessedFile>;
    private processExcelFile;
    private processCsvFile;
    private processTextFile;
    private processPdfFile;
    private createRestaurantSchema;
    private processJsonFile;
    private extractColumnsFromData;
    private inferSchemaFromData;
    private inferColumnSchema;
    private looksLikeDate;
    private looksLikeDateTime;
    private analyzeTextContent;
    private looksLikeSqlSchema;
    private looksLikeSchema;
    private parseSqlSchema;
    private parseColumnDefinitions;
    private saveProcessedFile;
    getProcessedFile(fileId: string): Promise<ProcessedFile | null>;
    listProcessedFiles(): Promise<ProcessedFile[]>;
    deleteProcessedFile(fileId: string): Promise<boolean>;
    private extractTablesFromText;
    private inferSchemaFromText;
}
export declare const simpleFileProcessor: SimpleFileProcessor;
