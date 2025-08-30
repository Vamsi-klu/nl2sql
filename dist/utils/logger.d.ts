import winston from 'winston';
export declare const logger: winston.Logger;
export declare const fileProcessingLogger: winston.Logger;
export declare const queryLogger: winston.Logger;
export declare const apiLogger: winston.Logger;
export declare const databaseLogger: winston.Logger;
export interface QueryMetadata {
    sessionId: string;
    userId?: string;
    prompt: string;
    generatedSQL: string;
    executionTime: number;
    resultRowCount?: number;
    filesUsed: string[];
    success: boolean;
    error?: string;
    timestamp: Date;
}
export interface FileUploadMetadata {
    sessionId: string;
    userId?: string;
    fileId: string;
    originalName: string;
    size: number;
    type: string;
    processingTime: number;
    success: boolean;
    error?: string;
    extractedInfo: {
        tableCount?: number;
        rowCount?: number;
        columnCount?: number;
        detectedType: string;
    };
    timestamp: Date;
}
export interface SessionMetadata {
    sessionId: string;
    userId?: string;
    startTime: Date;
    endTime?: Date;
    totalQueries: number;
    totalFilesUploaded: number;
    totalProcessingTime: number;
}
export declare class MetadataLogger {
    private metadataDir;
    constructor(metadataDir?: string);
    logQuery(metadata: QueryMetadata): Promise<void>;
    logFileUpload(metadata: FileUploadMetadata): Promise<void>;
    logSession(metadata: SessionMetadata): Promise<void>;
    getQueryStats(dateFrom?: Date, dateTo?: Date): Promise<any>;
}
export declare const metadataLogger: MetadataLogger;
