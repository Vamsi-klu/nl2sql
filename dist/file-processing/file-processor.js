import * as fs from 'fs-extra';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as xlsx from 'xlsx';
import csv from 'csv-parser';
import * as pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import { logger } from '../utils/logger.js';
export class FileProcessor {
    uploadDir;
    maxFileSize;
    constructor(uploadDir = './uploads', maxFileSize = 30 * 1024 * 1024) {
        this.uploadDir = uploadDir;
        this.maxFileSize = maxFileSize;
        this.ensureUploadDir();
    }
    async ensureUploadDir() {
        await fs.ensureDir(this.uploadDir);
    }
    async processFile(filePath, originalName, mimeType) {
        const startTime = Date.now();
        const fileStats = await fs.stat(filePath);
        if (fileStats.size > this.maxFileSize) {
            throw new Error(`File size ${fileStats.size} exceeds maximum allowed size of ${this.maxFileSize} bytes`);
        }
        const fileId = uuidv4();
        const processedFile = {
            id: fileId,
            originalName,
            mimeType,
            size: fileStats.size,
            uploadedAt: new Date(),
            processedAt: new Date(),
            type: 'unknown',
            content: {},
            metadata: {
                fileType: path.extname(originalName).toLowerCase(),
                processingTime: 0
            }
        };
        try {
            logger.info(`Processing file: ${originalName} (${mimeType})`);
            switch (mimeType) {
                case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
                case 'application/vnd.ms-excel':
                    await this.processExcelFile(filePath, processedFile);
                    break;
                case 'text/csv':
                case 'application/csv':
                    await this.processCsvFile(filePath, processedFile);
                    break;
                case 'application/pdf':
                    await this.processPdfFile(filePath, processedFile);
                    break;
                case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                case 'application/msword':
                    await this.processWordFile(filePath, processedFile);
                    break;
                case 'text/plain':
                case 'application/sql':
                    await this.processTextFile(filePath, processedFile);
                    break;
                case 'application/json':
                    await this.processJsonFile(filePath, processedFile);
                    break;
                default:
                    // Try to process as text file
                    await this.processTextFile(filePath, processedFile);
            }
            processedFile.metadata.processingTime = Date.now() - startTime;
            // Save processed file metadata
            await this.saveProcessedFile(processedFile);
            logger.info(`File processed successfully: ${originalName} in ${processedFile.metadata.processingTime}ms`);
            return processedFile;
        }
        catch (error) {
            logger.error(`Error processing file ${originalName}:`, error);
            processedFile.metadata.processingTime = Date.now() - startTime;
            throw error;
        }
    }
    async processExcelFile(filePath, processedFile) {
        const workbook = xlsx.readFile(filePath);
        const tables = {};
        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(sheet);
            if (data.length > 0) {
                tables[sheetName] = data;
            }
        }
        processedFile.content.tables = tables;
        processedFile.content.data = Object.values(tables).flat();
        processedFile.type = 'data';
        processedFile.metadata.rowCount = processedFile.content.data.length;
        processedFile.metadata.columns = this.extractColumnsFromData(processedFile.content.data);
        // Try to infer schema
        if (processedFile.content.data.length > 0) {
            processedFile.content.schema = this.inferSchemaFromData(tables);
        }
    }
    async processCsvFile(filePath, processedFile) {
        const data = [];
        const stream = fs.createReadStream(filePath);
        return new Promise((resolve, reject) => {
            stream
                .pipe(csv())
                .on('data', (row) => data.push(row))
                .on('end', () => {
                processedFile.content.data = data;
                processedFile.type = 'data';
                processedFile.metadata.rowCount = data.length;
                processedFile.metadata.columns = this.extractColumnsFromData(data);
                // Try to infer schema
                if (data.length > 0) {
                    const tableName = path.basename(processedFile.originalName, path.extname(processedFile.originalName));
                    processedFile.content.schema = this.inferSchemaFromData({ [tableName]: data });
                }
                resolve();
            })
                .on('error', reject);
        });
    }
    async processPdfFile(filePath, processedFile) {
        const buffer = await fs.readFile(filePath);
        const pdfData = await pdfParse(buffer);
        processedFile.content.raw = pdfData.text;
        processedFile.type = this.analyzeTextContent(pdfData.text);
    }
    async processWordFile(filePath, processedFile) {
        const buffer = await fs.readFile(filePath);
        const result = await mammoth.extractRawText({ buffer });
        processedFile.content.raw = result.value;
        processedFile.type = this.analyzeTextContent(result.value);
    }
    async processTextFile(filePath, processedFile) {
        const content = await fs.readFile(filePath, 'utf-8');
        processedFile.content.raw = content;
        processedFile.type = this.analyzeTextContent(content);
        // Try to parse as SQL schema
        if (this.looksLikeSqlSchema(content)) {
            processedFile.content.schema = await this.parseSqlSchema(content);
            processedFile.type = 'schema';
        }
    }
    async processJsonFile(filePath, processedFile) {
        const content = await fs.readFile(filePath, 'utf-8');
        const jsonData = JSON.parse(content);
        if (Array.isArray(jsonData)) {
            processedFile.content.data = jsonData;
            processedFile.type = 'data';
            processedFile.metadata.rowCount = jsonData.length;
            processedFile.metadata.columns = this.extractColumnsFromData(jsonData);
            if (jsonData.length > 0) {
                const tableName = path.basename(processedFile.originalName, path.extname(processedFile.originalName));
                processedFile.content.schema = this.inferSchemaFromData({ [tableName]: jsonData });
            }
        }
        else if (this.looksLikeSchema(jsonData)) {
            processedFile.content.schema = jsonData;
            processedFile.type = 'schema';
        }
        else {
            processedFile.content.raw = JSON.stringify(jsonData, null, 2);
            processedFile.type = 'mixed';
        }
    }
    extractColumnsFromData(data) {
        if (!data || data.length === 0)
            return [];
        const columns = new Set();
        for (const row of data.slice(0, 10)) { // Sample first 10 rows
            if (typeof row === 'object' && row !== null) {
                Object.keys(row).forEach(key => columns.add(key));
            }
        }
        return Array.from(columns);
    }
    inferSchemaFromData(tables) {
        const tableSchemas = [];
        for (const [tableName, data] of Object.entries(tables)) {
            if (!data || data.length === 0)
                continue;
            const columns = [];
            const sampleData = data.slice(0, 100); // Sample for type inference
            // Get all possible column names
            const columnNames = new Set();
            sampleData.forEach(row => {
                if (typeof row === 'object' && row !== null) {
                    Object.keys(row).forEach(key => columnNames.add(key));
                }
            });
            // Infer column types
            for (const columnName of columnNames) {
                const column = this.inferColumnSchema(columnName, sampleData);
                columns.push(column);
            }
            tableSchemas.push({
                name: tableName,
                columns
            });
        }
        return { tables: tableSchemas };
    }
    inferColumnSchema(columnName, data) {
        const values = data.map(row => row[columnName]).filter(val => val !== null && val !== undefined);
        const nonNullCount = values.length;
        const totalCount = data.length;
        let type = 'TEXT';
        let isPrimaryKey = false;
        // Check if all values are unique (potential primary key)
        const uniqueValues = new Set(values);
        isPrimaryKey = uniqueValues.size === nonNullCount && nonNullCount === totalCount;
        // Infer type based on values
        if (values.length > 0) {
            const firstValue = values[0];
            if (typeof firstValue === 'number') {
                type = Number.isInteger(firstValue) ? 'INTEGER' : 'REAL';
            }
            else if (typeof firstValue === 'boolean') {
                type = 'BOOLEAN';
            }
            else if (typeof firstValue === 'string') {
                // Check if it looks like a date
                if (this.looksLikeDate(firstValue)) {
                    type = 'DATE';
                }
                else if (this.looksLikeDateTime(firstValue)) {
                    type = 'DATETIME';
                }
                else {
                    type = 'TEXT';
                }
            }
            // Check if all values have consistent type
            const allSameType = values.every(val => {
                if (type === 'INTEGER')
                    return Number.isInteger(val);
                if (type === 'REAL')
                    return typeof val === 'number';
                if (type === 'BOOLEAN')
                    return typeof val === 'boolean';
                return true;
            });
            if (!allSameType) {
                type = 'TEXT'; // Fallback to text if mixed types
            }
        }
        return {
            name: columnName,
            type,
            nullable: nonNullCount < totalCount,
            isPrimaryKey
        };
    }
    looksLikeDate(value) {
        return /^\d{4}-\d{2}-\d{2}$/.test(value) || /^\d{2}\/\d{2}\/\d{4}$/.test(value);
    }
    looksLikeDateTime(value) {
        return /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/.test(value);
    }
    analyzeTextContent(content) {
        const lowercaseContent = content.toLowerCase();
        if (this.looksLikeSqlSchema(content)) {
            return 'schema';
        }
        if (lowercaseContent.includes('create table') ||
            lowercaseContent.includes('alter table') ||
            lowercaseContent.includes('primary key') ||
            lowercaseContent.includes('foreign key')) {
            return 'schema';
        }
        if (lowercaseContent.includes('insert into') ||
            lowercaseContent.includes('update') ||
            lowercaseContent.includes('select')) {
            return 'data';
        }
        return 'mixed';
    }
    looksLikeSqlSchema(content) {
        const sqlKeywords = ['create table', 'alter table', 'drop table', 'primary key', 'foreign key'];
        const lowercaseContent = content.toLowerCase();
        return sqlKeywords.some(keyword => lowercaseContent.includes(keyword));
    }
    looksLikeSchema(obj) {
        return obj &&
            (obj.tables || obj.schemas) &&
            (Array.isArray(obj.tables) || Array.isArray(obj.schemas));
    }
    async parseSqlSchema(sqlContent) {
        // Simple SQL schema parser - can be enhanced
        const tables = [];
        const createTableRegex = /CREATE\s+TABLE\s+(\w+)\s*\(\s*([^)]+)\s*\)/gi;
        let match;
        while ((match = createTableRegex.exec(sqlContent)) !== null) {
            const tableName = match[1];
            const columnsText = match[2];
            const columns = this.parseColumnDefinitions(columnsText);
            tables.push({ name: tableName, columns });
        }
        return { tables };
    }
    parseColumnDefinitions(columnsText) {
        const columns = [];
        const columnLines = columnsText.split(',').map(line => line.trim());
        for (const line of columnLines) {
            const words = line.split(/\s+/);
            if (words.length >= 2) {
                const columnName = words[0];
                const columnType = words[1].toUpperCase();
                const nullable = !line.toUpperCase().includes('NOT NULL');
                const isPrimaryKey = line.toUpperCase().includes('PRIMARY KEY');
                columns.push({
                    name: columnName,
                    type: columnType,
                    nullable,
                    isPrimaryKey
                });
            }
        }
        return columns;
    }
    async saveProcessedFile(processedFile) {
        const metadataPath = path.join(this.uploadDir, `${processedFile.id}.metadata.json`);
        await fs.writeJson(metadataPath, processedFile, { spaces: 2 });
    }
    async getProcessedFile(fileId) {
        try {
            const metadataPath = path.join(this.uploadDir, `${fileId}.metadata.json`);
            return await fs.readJson(metadataPath);
        }
        catch (error) {
            return null;
        }
    }
    async listProcessedFiles() {
        try {
            const files = await fs.readdir(this.uploadDir);
            const metadataFiles = files.filter(file => file.endsWith('.metadata.json'));
            const processedFiles = [];
            for (const metadataFile of metadataFiles) {
                try {
                    const filePath = path.join(this.uploadDir, metadataFile);
                    const processedFile = await fs.readJson(filePath);
                    processedFiles.push(processedFile);
                }
                catch (error) {
                    logger.error(`Error reading metadata file ${metadataFile}:`, error);
                }
            }
            return processedFiles.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
        }
        catch (error) {
            logger.error('Error listing processed files:', error);
            return [];
        }
    }
    async deleteProcessedFile(fileId) {
        try {
            const metadataPath = path.join(this.uploadDir, `${fileId}.metadata.json`);
            await fs.remove(metadataPath);
            return true;
        }
        catch (error) {
            logger.error(`Error deleting processed file ${fileId}:`, error);
            return false;
        }
    }
}
export const fileProcessor = new FileProcessor();
//# sourceMappingURL=file-processor.js.map