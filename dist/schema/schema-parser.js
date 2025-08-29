/**
 * Universal Schema Parser
 * Parses schemas from multiple formats: SQL DDL, JSON, CSV headers, natural language
 */
import { getGeminiClient } from '../llm/gemini-client.js';
export var SchemaFormat;
(function (SchemaFormat) {
    SchemaFormat["SQL_DDL"] = "sql_ddl";
    SchemaFormat["JSON"] = "json";
    SchemaFormat["CSV"] = "csv";
    SchemaFormat["NATURAL_LANGUAGE"] = "natural_language";
    SchemaFormat["AUTO_DETECT"] = "auto_detect";
})(SchemaFormat || (SchemaFormat = {}));
export class SchemaParser {
    async parse(input, options = {}) {
        const format = options.format || SchemaFormat.AUTO_DETECT;
        if (format === SchemaFormat.AUTO_DETECT) {
            const detectedFormat = this.detectFormat(input);
            return this.parseWithFormat(input, detectedFormat, options);
        }
        return this.parseWithFormat(input, format, options);
    }
    detectFormat(input) {
        const trimmed = input.trim();
        // Check for SQL DDL
        if (/CREATE\s+TABLE/i.test(trimmed)) {
            return SchemaFormat.SQL_DDL;
        }
        // Check for JSON
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                JSON.parse(trimmed);
                return SchemaFormat.JSON;
            }
            catch {
                // Not valid JSON
            }
        }
        // Check for CSV-like format
        if (trimmed.includes(',') && trimmed.split('\n').length > 1) {
            return SchemaFormat.CSV;
        }
        // Default to natural language
        return SchemaFormat.NATURAL_LANGUAGE;
    }
    async parseWithFormat(input, format, options) {
        let schema;
        switch (format) {
            case SchemaFormat.SQL_DDL:
                schema = this.parseSQLDDL(input);
                break;
            case SchemaFormat.JSON:
                schema = this.parseJSON(input);
                break;
            case SchemaFormat.CSV:
                schema = this.parseCSV(input);
                break;
            case SchemaFormat.NATURAL_LANGUAGE:
                schema = await this.parseNaturalLanguage(input);
                break;
            default:
                throw new Error(`Unsupported schema format: ${format}`);
        }
        // Enrich schema with additional information
        if (options.inferRelationships) {
            schema.relationships = this.inferRelationships(schema);
        }
        if (options.detectIndexes) {
            this.detectOptimalIndexes(schema);
        }
        if (options.sampleData) {
            this.enrichWithSampleData(schema, options.sampleData);
        }
        return schema;
    }
    parseSQLDDL(ddl) {
        const tables = [];
        const relationships = [];
        // Regular expressions for parsing SQL DDL
        const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)[`"]?\s*\(([\s\S]*?)\);/gi;
        const columnRegex = /[`"]?(\w+)[`"]?\s+(\w+(?:\([^)]+\))?)\s*(.*?)(?:,|$)/gi;
        const primaryKeyRegex = /PRIMARY\s+KEY\s*\(([^)]+)\)/i;
        const foreignKeyRegex = /FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+[`"]?(\w+)[`"]?\s*\(([^)]+)\)/gi;
        let match;
        while ((match = tableRegex.exec(ddl)) !== null) {
            const tableName = match[1];
            const tableBody = match[2];
            const columns = [];
            const primaryKey = [];
            // Parse columns
            let colMatch;
            const lines = tableBody.split(',').map(line => line.trim());
            for (const line of lines) {
                // Skip constraint lines
                if (/^\s*(PRIMARY|FOREIGN|UNIQUE|CHECK|INDEX)/i.test(line)) {
                    continue;
                }
                const colParts = line.match(/[`"]?(\w+)[`"]?\s+(\w+(?:\([^)]+\))?)\s*(.*)/);
                if (colParts) {
                    const columnName = colParts[1];
                    const columnType = colParts[2];
                    const constraints = colParts[3] || '';
                    columns.push({
                        name: columnName,
                        type: this.normalizeDataType(columnType),
                        nullable: !/NOT\s+NULL/i.test(constraints),
                        defaultValue: this.extractDefault(constraints),
                        constraints: this.extractConstraints(constraints)
                    });
                }
            }
            // Parse primary key
            const pkMatch = tableBody.match(primaryKeyRegex);
            if (pkMatch) {
                primaryKey.push(...pkMatch[1].split(',').map(col => col.trim().replace(/[`"]/g, '')));
            }
            // Parse foreign keys
            let fkMatch;
            const fkRegexCopy = new RegExp(foreignKeyRegex.source, foreignKeyRegex.flags);
            while ((fkMatch = fkRegexCopy.exec(tableBody)) !== null) {
                const fromColumn = fkMatch[1].trim().replace(/[`"]/g, '');
                const toTable = fkMatch[2];
                const toColumn = fkMatch[3].trim().replace(/[`"]/g, '');
                relationships.push({
                    from: { table: tableName, column: fromColumn },
                    to: { table: toTable, column: toColumn },
                    type: 'one-to-many'
                });
            }
            tables.push({
                name: tableName,
                columns,
                primaryKey: primaryKey.length > 0 ? primaryKey : undefined
            });
        }
        return { tables, relationships };
    }
    parseJSON(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            // If it's already in our schema format
            if (data.tables && Array.isArray(data.tables)) {
                return data;
            }
            // If it's sample data, infer schema
            if (Array.isArray(data)) {
                return this.inferSchemaFromData(data);
            }
            // If it's a single object describing tables
            if (typeof data === 'object') {
                const tables = [];
                for (const [tableName, tableInfo] of Object.entries(data)) {
                    if (typeof tableInfo === 'object' && tableInfo !== null) {
                        const columns = this.parseJSONTableInfo(tableInfo);
                        tables.push({
                            name: tableName,
                            columns
                        });
                    }
                }
                return { tables };
            }
            throw new Error('Unrecognized JSON schema format');
        }
        catch (error) {
            throw new Error(`Failed to parse JSON schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    parseJSONTableInfo(tableInfo) {
        const columns = [];
        // Handle array of columns
        if (Array.isArray(tableInfo)) {
            for (const col of tableInfo) {
                if (typeof col === 'string') {
                    columns.push({
                        name: col,
                        type: 'VARCHAR(255)',
                        nullable: true
                    });
                }
                else if (typeof col === 'object') {
                    columns.push({
                        name: col.name || col.column || 'unknown',
                        type: col.type || 'VARCHAR(255)',
                        nullable: col.nullable !== false,
                        defaultValue: col.default || col.defaultValue,
                        description: col.description || col.comment
                    });
                }
            }
        }
        // Handle object with column definitions
        else if (typeof tableInfo === 'object') {
            for (const [colName, colInfo] of Object.entries(tableInfo)) {
                if (typeof colInfo === 'string') {
                    columns.push({
                        name: colName,
                        type: colInfo,
                        nullable: true
                    });
                }
                else if (typeof colInfo === 'object' && colInfo !== null) {
                    columns.push({
                        name: colName,
                        type: colInfo.type || 'VARCHAR(255)',
                        nullable: colInfo.nullable !== false,
                        defaultValue: colInfo.default,
                        description: colInfo.description
                    });
                }
            }
        }
        return columns;
    }
    parseCSV(csvStr) {
        const lines = csvStr.trim().split('\n');
        if (lines.length === 0) {
            throw new Error('Empty CSV input');
        }
        // First line is headers
        const headers = lines[0].split(',').map(h => h.trim().replace(/['"]/g, ''));
        // Infer types from sample data if available
        const columns = headers.map(header => {
            const type = this.inferTypeFromSamples(lines.slice(1), headers.indexOf(header));
            return {
                name: header,
                type,
                nullable: true
            };
        });
        return {
            tables: [{
                    name: 'data',
                    columns
                }]
        };
    }
    async parseNaturalLanguage(description) {
        try {
            const geminiClient = getGeminiClient();
            const prompt = `Parse this natural language database schema description into a structured format:

"${description}"

Return a JSON object with this structure:
{
  "tables": [
    {
      "name": "table_name",
      "columns": [
        {"name": "column_name", "type": "data_type", "nullable": true/false}
      ],
      "primaryKey": ["column_name"],
      "description": "table description"
    }
  ],
  "relationships": [
    {
      "from": {"table": "table1", "column": "col1"},
      "to": {"table": "table2", "column": "col2"},
      "type": "one-to-many"
    }
  ]
}`;
            const result = await geminiClient.model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: geminiClient.generationConfig
            });
            const response = await result.response;
            const text = response.text();
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            throw new Error('Could not parse natural language schema');
        }
        catch (error) {
            // Fallback to basic parsing
            return this.basicNaturalLanguageParse(description);
        }
    }
    basicNaturalLanguageParse(description) {
        const tables = [];
        const lines = description.split('\n');
        let currentTable = null;
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed)
                continue;
            // Check for table definition
            const tableMatch = trimmed.match(/(?:table|entity):\s*(\w+)/i);
            if (tableMatch) {
                if (currentTable) {
                    tables.push(currentTable);
                }
                currentTable = {
                    name: tableMatch[1],
                    columns: []
                };
                continue;
            }
            // Check for column definition
            if (currentTable) {
                const colMatch = trimmed.match(/[-*]?\s*(\w+)\s*(?:\(([^)]+)\))?/);
                if (colMatch) {
                    currentTable.columns.push({
                        name: colMatch[1],
                        type: colMatch[2] || 'VARCHAR(255)',
                        nullable: true
                    });
                }
            }
        }
        if (currentTable) {
            tables.push(currentTable);
        }
        return { tables };
    }
    inferSchemaFromData(data) {
        if (data.length === 0) {
            return { tables: [] };
        }
        const columns = [];
        const sample = data[0];
        for (const [key, value] of Object.entries(sample)) {
            const type = this.inferTypeFromValue(value, data.map(row => row[key]));
            columns.push({
                name: key,
                type,
                nullable: data.some(row => row[key] == null)
            });
        }
        return {
            tables: [{
                    name: 'data',
                    columns
                }]
        };
    }
    inferTypeFromValue(value, allValues) {
        // Check if all values are null
        if (allValues.every(v => v == null)) {
            return 'VARCHAR(255)';
        }
        // Get non-null values
        const nonNullValues = allValues.filter(v => v != null);
        // Check for boolean
        if (nonNullValues.every(v => typeof v === 'boolean')) {
            return 'BOOLEAN';
        }
        // Check for integer
        if (nonNullValues.every(v => typeof v === 'number' && Number.isInteger(v))) {
            const max = Math.max(...nonNullValues);
            const min = Math.min(...nonNullValues);
            if (min >= -2147483648 && max <= 2147483647) {
                return 'INTEGER';
            }
            return 'BIGINT';
        }
        // Check for decimal
        if (nonNullValues.every(v => typeof v === 'number')) {
            return 'DECIMAL(10,2)';
        }
        // Check for date/datetime
        if (nonNullValues.every(v => {
            if (typeof v !== 'string')
                return false;
            const date = new Date(v);
            return !isNaN(date.getTime());
        })) {
            const sample = nonNullValues[0];
            if (sample.includes('T') || sample.includes(' ')) {
                return 'TIMESTAMP';
            }
            return 'DATE';
        }
        // Default to VARCHAR with appropriate length
        const maxLength = Math.max(...nonNullValues.map(v => String(v).length));
        if (maxLength <= 255) {
            return 'VARCHAR(255)';
        }
        else if (maxLength <= 65535) {
            return 'TEXT';
        }
        return 'LONGTEXT';
    }
    inferTypeFromSamples(lines, columnIndex) {
        const values = lines
            .map(line => line.split(',')[columnIndex]?.trim())
            .filter(v => v && v !== '');
        if (values.length === 0) {
            return 'VARCHAR(255)';
        }
        return this.inferTypeFromValue(values[0], values);
    }
    inferRelationships(schema) {
        const relationships = [];
        for (const table of schema.tables) {
            for (const column of table.columns) {
                // Check for foreign key patterns
                const fkMatch = column.name.match(/^(.+)_id$/i);
                if (fkMatch) {
                    const referencedTable = fkMatch[1];
                    const targetTable = schema.tables.find(t => t.name.toLowerCase() === referencedTable.toLowerCase() ||
                        t.name.toLowerCase() === referencedTable.toLowerCase() + 's');
                    if (targetTable) {
                        relationships.push({
                            from: { table: table.name, column: column.name },
                            to: { table: targetTable.name, column: 'id' },
                            type: 'one-to-many'
                        });
                    }
                }
            }
        }
        return relationships;
    }
    detectOptimalIndexes(schema) {
        for (const table of schema.tables) {
            const indexes = [];
            // Add index for primary key (if not already indexed)
            if (table.primaryKey) {
                indexes.push({
                    name: `idx_${table.name}_pk`,
                    columns: table.primaryKey,
                    unique: true
                });
            }
            // Add indexes for foreign keys
            for (const column of table.columns) {
                if (column.name.endsWith('_id')) {
                    indexes.push({
                        name: `idx_${table.name}_${column.name}`,
                        columns: [column.name],
                        unique: false
                    });
                }
            }
            // Add indexes for date columns (commonly used in WHERE clauses)
            for (const column of table.columns) {
                if (column.type.toUpperCase().includes('DATE') ||
                    column.type.toUpperCase().includes('TIMESTAMP')) {
                    indexes.push({
                        name: `idx_${table.name}_${column.name}`,
                        columns: [column.name],
                        unique: false
                    });
                }
            }
            table.indexes = indexes;
        }
    }
    enrichWithSampleData(schema, sampleData) {
        // Add statistics and examples to schema
        for (const table of schema.tables) {
            for (const column of table.columns) {
                const values = sampleData.map(row => row[column.name]).filter(v => v != null);
                if (values.length > 0) {
                    column.examples = values.slice(0, 3);
                    column.distinctCount = new Set(values).size;
                    if (typeof values[0] === 'number') {
                        column.min = Math.min(...values);
                        column.max = Math.max(...values);
                    }
                }
            }
        }
    }
    normalizeDataType(type) {
        const upper = type.toUpperCase();
        // Map common variations to standard types
        const typeMap = {
            'INT': 'INTEGER',
            'BOOL': 'BOOLEAN',
            'DATETIME': 'TIMESTAMP',
            'STRING': 'VARCHAR(255)',
            'NUMBER': 'DECIMAL',
            'FLOAT': 'REAL',
            'DOUBLE': 'DOUBLE PRECISION'
        };
        for (const [key, value] of Object.entries(typeMap)) {
            if (upper.startsWith(key)) {
                return value + upper.slice(key.length);
            }
        }
        return type;
    }
    extractDefault(constraints) {
        const defaultMatch = constraints.match(/DEFAULT\s+([^,\s]+)/i);
        if (defaultMatch) {
            const value = defaultMatch[1].replace(/['"]/g, '');
            // Try to parse as number
            const num = Number(value);
            if (!isNaN(num)) {
                return num;
            }
            // Check for boolean
            if (value.toUpperCase() === 'TRUE')
                return true;
            if (value.toUpperCase() === 'FALSE')
                return false;
            // Check for NULL
            if (value.toUpperCase() === 'NULL')
                return null;
            return value;
        }
        return undefined;
    }
    extractConstraints(constraintStr) {
        const constraints = [];
        if (/NOT\s+NULL/i.test(constraintStr)) {
            constraints.push('NOT NULL');
        }
        if (/UNIQUE/i.test(constraintStr)) {
            constraints.push('UNIQUE');
        }
        if (/PRIMARY\s+KEY/i.test(constraintStr)) {
            constraints.push('PRIMARY KEY');
        }
        if (/AUTO_INCREMENT|IDENTITY|SERIAL/i.test(constraintStr)) {
            constraints.push('AUTO_INCREMENT');
        }
        const checkMatch = constraintStr.match(/CHECK\s*\(([^)]+)\)/i);
        if (checkMatch) {
            constraints.push(`CHECK(${checkMatch[1]})`);
        }
        return constraints;
    }
}
//# sourceMappingURL=schema-parser.js.map