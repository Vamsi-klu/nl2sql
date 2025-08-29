/**
 * Gemini API Client for NL2SQL
 * Handles communication with Google's Gemini API for SQL generation
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
export var SQLDialect;
(function (SQLDialect) {
    SQLDialect["POSTGRESQL"] = "postgresql";
    SQLDialect["MYSQL"] = "mysql";
    SQLDialect["SQLITE"] = "sqlite";
    SQLDialect["SQLSERVER"] = "sqlserver";
    SQLDialect["ORACLE"] = "oracle";
})(SQLDialect || (SQLDialect = {}));
export class GeminiClient {
    genAI;
    model;
    config;
    generationConfig;
    constructor(config) {
        this.config = config;
        this.genAI = new GoogleGenerativeAI(config.apiKey);
        this.model = this.genAI.getGenerativeModel({
            model: config.model || 'gemini-pro'
        });
        this.generationConfig = {
            temperature: config.temperature || 0.2,
            topP: config.topP || 0.8,
            topK: config.topK || 40,
            maxOutputTokens: config.maxOutputTokens || 2048,
        };
    }
    async generateSQL(request) {
        try {
            const prompt = this.buildPrompt(request);
            const result = await this.model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: this.generationConfig,
            });
            const response = await result.response;
            const text = response.text();
            return this.parseResponse(text);
        }
        catch (error) {
            console.error('Gemini API error:', error);
            throw new Error(`Failed to generate SQL: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    buildPrompt(request) {
        const { naturalLanguageQuery, schema, dialect, context } = request;
        let prompt = `You are an expert SQL query generator. Generate a SQL query based on the following request.

IMPORTANT INSTRUCTIONS:
1. Generate ONLY valid SQL for ${dialect || 'PostgreSQL'}
2. Use ONLY tables and columns that exist in the provided schema
3. Include proper JOINs when querying across multiple tables
4. Add appropriate WHERE clauses for filtering
5. Use aggregation functions when needed (COUNT, SUM, AVG, etc.)
6. Include ORDER BY and LIMIT clauses when relevant
7. Optimize for performance
8. Return the response in the exact JSON format specified below

DATABASE SCHEMA:
${this.formatSchema(schema)}

${this.formatRelationships(schema.relationships)}

USER QUERY:
"${naturalLanguageQuery}"

${context ? this.formatContext(context) : ''}

RESPONSE FORMAT (JSON):
{
  "sql": "The generated SQL query",
  "explanation": "Brief explanation of what the query does",
  "confidence": 0.95,
  "alternativeQueries": ["Alternative SQL query if applicable"],
  "warnings": ["Any warnings about the query"],
  "optimizationSuggestions": ["Suggestions for optimization"]
}

Generate the SQL query now:`;
        return prompt;
    }
    formatSchema(schema) {
        let schemaStr = '';
        for (const table of schema.tables) {
            schemaStr += `\nTable: ${table.name}`;
            if (table.description) {
                schemaStr += ` (${table.description})`;
            }
            schemaStr += '\nColumns:\n';
            for (const column of table.columns) {
                schemaStr += `  - ${column.name} (${column.type}`;
                if (!column.nullable)
                    schemaStr += ', NOT NULL';
                if (column.description)
                    schemaStr += `, ${column.description}`;
                schemaStr += ')\n';
            }
            if (table.primaryKey && table.primaryKey.length > 0) {
                schemaStr += `Primary Key: ${table.primaryKey.join(', ')}\n`;
            }
            if (table.indexes && table.indexes.length > 0) {
                schemaStr += 'Indexes:\n';
                for (const index of table.indexes) {
                    schemaStr += `  - ${index.name} on (${index.columns.join(', ')})`;
                    if (index.unique)
                        schemaStr += ' UNIQUE';
                    schemaStr += '\n';
                }
            }
        }
        return schemaStr;
    }
    formatRelationships(relationships) {
        if (!relationships || relationships.length === 0) {
            return '';
        }
        let relStr = '\nRELATIONSHIPS:\n';
        for (const rel of relationships) {
            relStr += `- ${rel.from.table}.${rel.from.column} -> ${rel.to.table}.${rel.to.column} (${rel.type})\n`;
        }
        return relStr;
    }
    formatContext(context) {
        let contextStr = '\nADDITIONAL CONTEXT:\n';
        if (context.previousQueries && context.previousQueries.length > 0) {
            contextStr += 'Previous queries:\n';
            for (const query of context.previousQueries.slice(-3)) {
                contextStr += `- ${query}\n`;
            }
        }
        if (context.businessRules && context.businessRules.length > 0) {
            contextStr += 'Business rules to consider:\n';
            for (const rule of context.businessRules) {
                contextStr += `- ${rule}\n`;
            }
        }
        return contextStr;
    }
    parseResponse(text) {
        try {
            // Try to extract JSON from the response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    sql: parsed.sql || '',
                    explanation: parsed.explanation || '',
                    confidence: parsed.confidence || 0.8,
                    alternativeQueries: parsed.alternativeQueries || [],
                    warnings: parsed.warnings || [],
                    optimizationSuggestions: parsed.optimizationSuggestions || []
                };
            }
            // Fallback: Try to extract SQL from markdown code blocks
            const sqlMatch = text.match(/```sql\n([\s\S]*?)\n```/);
            const sql = sqlMatch ? sqlMatch[1] : text.trim();
            return {
                sql,
                explanation: 'Query generated from natural language',
                confidence: 0.7,
                warnings: ['Response format was not as expected, extracted SQL directly']
            };
        }
        catch (error) {
            console.error('Error parsing Gemini response:', error);
            // Last resort: return the raw text as SQL
            return {
                sql: text.trim(),
                explanation: 'Raw response from AI',
                confidence: 0.5,
                warnings: ['Could not parse structured response, returning raw output']
            };
        }
    }
    async validateSQL(sql, dialect = SQLDialect.POSTGRESQL) {
        try {
            const prompt = `Validate if this is correct ${dialect} SQL syntax. Reply with only "VALID" or "INVALID" followed by a brief reason.
      
SQL: ${sql}`;
            const result = await this.model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { ...this.generationConfig, maxOutputTokens: 100 }
            });
            const response = await result.response;
            const text = response.text();
            return text.toUpperCase().includes('VALID') && !text.toUpperCase().includes('INVALID');
        }
        catch (error) {
            console.error('SQL validation error:', error);
            return false;
        }
    }
    async explainSQL(sql) {
        try {
            const prompt = `Explain this SQL query in simple terms for a non-technical user:
      
SQL: ${sql}

Provide a clear, concise explanation of what this query does and what data it retrieves.`;
            const result = await this.model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { ...this.generationConfig, maxOutputTokens: 500 }
            });
            const response = await result.response;
            return response.text();
        }
        catch (error) {
            console.error('SQL explanation error:', error);
            return 'Unable to generate explanation';
        }
    }
    async optimizeSQL(sql, schema) {
        try {
            const prompt = `Optimize this SQL query for better performance:
      
SQL: ${sql}

Schema:
${this.formatSchema(schema)}

Provide an optimized version of the query with improvements like:
- Better index usage
- Reduced subqueries
- Efficient JOIN order
- Appropriate filtering

Return only the optimized SQL query.`;
            const result = await this.model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: this.generationConfig
            });
            const response = await result.response;
            const text = response.text();
            // Extract SQL from response
            const sqlMatch = text.match(/```sql\n([\s\S]*?)\n```/);
            return sqlMatch ? sqlMatch[1] : text.trim();
        }
        catch (error) {
            console.error('SQL optimization error:', error);
            return sql; // Return original if optimization fails
        }
    }
    async detectSchema(sampleData) {
        try {
            const prompt = `Analyze this sample data and infer the database schema:
      
Sample Data (JSON):
${JSON.stringify(sampleData.slice(0, 5), null, 2)}

Generate a schema definition with:
- Table name (inferred from data structure)
- Column names and types
- Nullable fields
- Potential primary keys
- Suggested indexes

Return the schema in this JSON format:
{
  "tables": [{
    "name": "table_name",
    "columns": [
      {"name": "col1", "type": "VARCHAR(255)", "nullable": false},
      {"name": "col2", "type": "INTEGER", "nullable": true}
    ],
    "primaryKey": ["col1"]
  }]
}`;
            const result = await this.model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: this.generationConfig
            });
            const response = await result.response;
            const text = response.text();
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            throw new Error('Could not parse schema from response');
        }
        catch (error) {
            console.error('Schema detection error:', error);
            throw new Error(`Failed to detect schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async suggestQueries(schema) {
        try {
            const prompt = `Based on this database schema, suggest 5 useful analytical queries that a user might want to run:
      
${this.formatSchema(schema)}

Return a JSON array of natural language query descriptions, not SQL:
["Query description 1", "Query description 2", ...]`;
            const result = await this.model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { ...this.generationConfig, maxOutputTokens: 500 }
            });
            const response = await result.response;
            const text = response.text();
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            return [];
        }
        catch (error) {
            console.error('Query suggestion error:', error);
            return [];
        }
    }
}
// Singleton instance management
let geminiClientInstance = null;
export function initializeGeminiClient(config) {
    geminiClientInstance = new GeminiClient(config);
    return geminiClientInstance;
}
export function getGeminiClient() {
    if (!geminiClientInstance) {
        throw new Error('Gemini client not initialized. Call initializeGeminiClient first.');
    }
    return geminiClientInstance;
}
//# sourceMappingURL=gemini-client.js.map