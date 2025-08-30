import winston from 'winston';
import * as path from 'path';
import * as fs from 'fs-extra';

// Ensure logs directory exists
const logsDir = './logs';
fs.ensureDirSync(logsDir);

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta
    });
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'nl2sql' },
  transports: [
    // Write all logs with importance level of `error` or less to `error.log`
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    }),
    
    // Write all logs with importance level of `info` or less to `combined.log`
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    }),
    
    // Write file processing logs separately
    new winston.transports.File({ 
      filename: path.join(logsDir, 'file-processing.log'),
      level: 'info',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 3
    }),
    
    // Write query logs separately
    new winston.transports.File({ 
      filename: path.join(logsDir, 'queries.log'),
      level: 'info',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 3
    })
  ],
});

// Add console logging for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} ${level}: ${message} ${metaString}`;
      })
    )
  }));
}

// Specific loggers for different components
export const fileProcessingLogger = logger.child({ component: 'file-processing' });
export const queryLogger = logger.child({ component: 'query-processing' });
export const apiLogger = logger.child({ component: 'api' });
export const databaseLogger = logger.child({ component: 'database' });

// Metadata logging functions
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

export class MetadataLogger {
  private metadataDir: string;

  constructor(metadataDir: string = './metadata') {
    this.metadataDir = metadataDir;
    fs.ensureDirSync(metadataDir);
  }

  async logQuery(metadata: QueryMetadata): Promise<void> {
    try {
      const logEntry = {
        ...metadata,
        logType: 'query',
        timestamp: new Date()
      };
      
      queryLogger.info('Query executed', logEntry);
      
      // Save to daily metadata file
      const dateStr = new Date().toISOString().split('T')[0];
      const filePath = path.join(this.metadataDir, `queries-${dateStr}.jsonl`);
      
      await fs.appendFile(filePath, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      logger.error('Failed to log query metadata:', error);
    }
  }

  async logFileUpload(metadata: FileUploadMetadata): Promise<void> {
    try {
      const logEntry = {
        ...metadata,
        logType: 'file_upload',
        timestamp: new Date()
      };
      
      fileProcessingLogger.info('File uploaded', logEntry);
      
      // Save to daily metadata file
      const dateStr = new Date().toISOString().split('T')[0];
      const filePath = path.join(this.metadataDir, `uploads-${dateStr}.jsonl`);
      
      await fs.appendFile(filePath, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      logger.error('Failed to log file upload metadata:', error);
    }
  }

  async logSession(metadata: SessionMetadata): Promise<void> {
    try {
      const logEntry = {
        ...metadata,
        logType: 'session',
        timestamp: new Date()
      };
      
      logger.info('Session logged', logEntry);
      
      // Save to daily metadata file
      const dateStr = new Date().toISOString().split('T')[0];
      const filePath = path.join(this.metadataDir, `sessions-${dateStr}.jsonl`);
      
      await fs.appendFile(filePath, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      logger.error('Failed to log session metadata:', error);
    }
  }

  async getQueryStats(dateFrom?: Date, dateTo?: Date): Promise<any> {
    try {
      const stats = {
        totalQueries: 0,
        successfulQueries: 0,
        failedQueries: 0,
        averageExecutionTime: 0,
        totalExecutionTime: 0,
        popularPrompts: {} as { [key: string]: number },
        filesUsage: {} as { [key: string]: number }
      };

      // Read metadata files for the date range
      const files = await fs.readdir(this.metadataDir);
      const queryFiles = files.filter(f => f.startsWith('queries-') && f.endsWith('.jsonl'));

      for (const file of queryFiles) {
        const filePath = path.join(this.metadataDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line.length > 0);

        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            
            // Apply date filter if specified
            if (dateFrom || dateTo) {
              const entryDate = new Date(entry.timestamp);
              if (dateFrom && entryDate < dateFrom) continue;
              if (dateTo && entryDate > dateTo) continue;
            }

            stats.totalQueries++;
            stats.totalExecutionTime += entry.executionTime || 0;
            
            if (entry.success) {
              stats.successfulQueries++;
            } else {
              stats.failedQueries++;
            }

            // Track popular prompts
            const promptKey = entry.prompt?.substring(0, 100) || 'unknown';
            stats.popularPrompts[promptKey] = (stats.popularPrompts[promptKey] || 0) + 1;

            // Track file usage
            if (entry.filesUsed) {
              for (const fileId of entry.filesUsed) {
                stats.filesUsage[fileId] = (stats.filesUsage[fileId] || 0) + 1;
              }
            }
          } catch (parseError) {
            logger.warn(`Failed to parse metadata line: ${line}`);
          }
        }
      }

      stats.averageExecutionTime = stats.totalQueries > 0 
        ? stats.totalExecutionTime / stats.totalQueries 
        : 0;

      return stats;
    } catch (error) {
      logger.error('Failed to get query stats:', error);
      return null;
    }
  }
}

export const metadataLogger = new MetadataLogger();