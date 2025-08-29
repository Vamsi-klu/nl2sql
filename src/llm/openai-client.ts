/**
 * OpenAI API Client for NL2SQL
 * Handles communication with OpenAI's GPT models for SQL generation
 */

export interface OpenAIConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
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
  from: { table: string; column: string };
  to: { table: string; column: string };
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

export enum SQLDialect {
  POSTGRESQL = 'postgresql',
  MYSQL = 'mysql',
  SQLITE = 'sqlite',
  SQLSERVER = 'sqlserver',
  ORACLE = 'oracle'
}

export interface QueryGenerationResponse {
  sql: string;
  explanation: string;
  confidence: number;
  alternativeQueries?: string[];
  warnings?: string[];
  optimizationSuggestions?: string[];
}

export class OpenAIClient {
  private config: OpenAIConfig;
  private apiUrl = 'https://api.openai.com/v1/chat/completions';
  
  constructor(config: OpenAIConfig) {
    this.config = {
      model: config.model || 'gpt-4-turbo-preview',
      temperature: config.temperature ?? 0.2,
      maxTokens: config.maxTokens || 2048,
      topP: config.topP ?? 0.8,
      ...config
    };
  }
  
  /**
   * Validate API key by making a test request
   */
  async validateApiKey(): Promise<{ valid: boolean; error?: string }> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: 'You are a SQL expert. Reply with just "OK" to confirm the connection.'
            },
            {
              role: 'user',
              content: 'Test connection'
            }
          ],
          max_tokens: 10,
          temperature: 0
        })
      });
      
      if (response.status === 401) {
        return { valid: false, error: 'Invalid API key' };
      }
      
      if (response.status === 429) {
        return { valid: false, error: 'Rate limit exceeded or quota reached' };
      }
      
      if (!response.ok) {
        const errorData = await response.json() as any;
        return { valid: false, error: errorData.error?.message || 'API request failed' };
      }
      
      await response.json();
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Connection failed' 
      };
    }
  }
  
  async generateSQL(request: QueryGenerationRequest): Promise<QueryGenerationResponse> {
    try {
      const prompt = this.buildPrompt(request);
      
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: `You are an expert SQL query generator. Generate SQL queries based on natural language requests.
You must always respond in valid JSON format. Be precise and optimize for performance.`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
          top_p: this.config.topP,
          response_format: { type: "json_object" }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json() as any;
        throw new Error(errorData.error?.message || 'Failed to generate SQL');
      }
      
      const responseData = await response.json() as any;
      const content = responseData.choices[0]?.message?.content || '{}';
      
      return this.parseResponse(content);
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error(`Failed to generate SQL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private buildPrompt(request: QueryGenerationRequest): string {
    const { naturalLanguageQuery, schema, dialect, context } = request;
    
    let prompt = `Generate a SQL query based on the following request.

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
  
  private formatSchema(schema: SchemaDefinition): string {
    let schemaStr = '';
    
    for (const table of schema.tables) {
      schemaStr += `\nTable: ${table.name}`;
      if (table.description) {
        schemaStr += ` (${table.description})`;
      }
      schemaStr += '\nColumns:\n';
      
      for (const column of table.columns) {
        schemaStr += `  - ${column.name} (${column.type}`;
        if (!column.nullable) schemaStr += ', NOT NULL';
        if (column.description) schemaStr += `, ${column.description}`;
        schemaStr += ')\n';
      }
      
      if (table.primaryKey && table.primaryKey.length > 0) {
        schemaStr += `Primary Key: ${table.primaryKey.join(', ')}\n`;
      }
      
      if (table.indexes && table.indexes.length > 0) {
        schemaStr += 'Indexes:\n';
        for (const index of table.indexes) {
          schemaStr += `  - ${index.name} on (${index.columns.join(', ')})`;
          if (index.unique) schemaStr += ' UNIQUE';
          schemaStr += '\n';
        }
      }
    }
    
    return schemaStr;
  }
  
  private formatRelationships(relationships?: RelationshipDefinition[]): string {
    if (!relationships || relationships.length === 0) {
      return '';
    }
    
    let relStr = '\nRELATIONSHIPS:\n';
    for (const rel of relationships) {
      relStr += `- ${rel.from.table}.${rel.from.column} -> ${rel.to.table}.${rel.to.column} (${rel.type})\n`;
    }
    
    return relStr;
  }
  
  private formatContext(context: QueryContext): string {
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
  
  private parseResponse(text: string): QueryGenerationResponse {
    try {
      const parsed = JSON.parse(text);
      return {
        sql: parsed.sql || '',
        explanation: parsed.explanation || '',
        confidence: parsed.confidence || 0.8,
        alternativeQueries: parsed.alternativeQueries || [],
        warnings: parsed.warnings || [],
        optimizationSuggestions: parsed.optimizationSuggestions || []
      };
    } catch (error) {
      console.error('Error parsing OpenAI response:', error);
      
      // Try to extract SQL from plain text
      const sqlMatch = text.match(/```sql\n([\s\S]*?)\n```/);
      const sql = sqlMatch ? sqlMatch[1] : text.trim();
      
      return {
        sql,
        explanation: 'Query generated from natural language',
        confidence: 0.7,
        warnings: ['Response format was not as expected']
      };
    }
  }
  
  async validateSQL(sql: string, dialect: SQLDialect = SQLDialect.POSTGRESQL): Promise<boolean> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: 'You are a SQL validation expert.'
            },
            {
              role: 'user',
              content: `Validate if this is correct ${dialect} SQL syntax. Reply with only "VALID" or "INVALID" followed by a brief reason.\n\nSQL: ${sql}`
            }
          ],
          max_tokens: 100,
          temperature: 0
        })
      });
      
      if (!response.ok) return false;
      
      const responseData = await response.json() as any;
      const content = responseData.choices[0]?.message?.content || '';
      
      return content.toUpperCase().includes('VALID') && !content.toUpperCase().includes('INVALID');
    } catch (error) {
      console.error('SQL validation error:', error);
      return false;
    }
  }
  
  async explainSQL(sql: string): Promise<string> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: 'You are a SQL expert who explains queries in simple terms.'
            },
            {
              role: 'user',
              content: `Explain this SQL query in simple terms for a non-technical user:\n\nSQL: ${sql}\n\nProvide a clear, concise explanation.`
            }
          ],
          max_tokens: 500,
          temperature: 0.3
        })
      });
      
      if (!response.ok) {
        return 'Unable to generate explanation';
      }
      
      const responseData = await response.json() as any;
      return responseData.choices[0]?.message?.content || 'Unable to generate explanation';
    } catch (error) {
      console.error('SQL explanation error:', error);
      return 'Unable to generate explanation';
    }
  }
  
  async optimizeSQL(sql: string, schema: SchemaDefinition): Promise<string> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: 'You are a SQL optimization expert.'
            },
            {
              role: 'user',
              content: `Optimize this SQL query for better performance:
              
SQL: ${sql}

Schema:
${this.formatSchema(schema)}

Provide an optimized version with improvements like better index usage, reduced subqueries, efficient JOIN order, and appropriate filtering.
Return only the optimized SQL query.`
            }
          ],
          temperature: 0.2,
          max_tokens: this.config.maxTokens
        })
      });
      
      if (!response.ok) return sql;
      
      const responseData = await response.json() as any;
      const content = responseData.choices[0]?.message?.content || '';
      
      // Extract SQL from response
      const sqlMatch = content.match(/```sql\n([\s\S]*?)\n```/);
      return sqlMatch ? sqlMatch[1] : content.trim();
    } catch (error) {
      console.error('SQL optimization error:', error);
      return sql;
    }
  }
  
  async detectSchema(sampleData: Record<string, unknown>[]): Promise<SchemaDefinition> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: 'You are a database schema expert. Analyze data and infer schemas.'
            },
            {
              role: 'user',
              content: `Analyze this sample data and infer the database schema:
              
Sample Data (JSON):
${JSON.stringify(sampleData.slice(0, 5), null, 2)}

Generate a schema definition with table name, column names and types, nullable fields, and potential primary keys.

Return in this JSON format:
{
  "tables": [{
    "name": "table_name",
    "columns": [
      {"name": "col1", "type": "VARCHAR(255)", "nullable": false},
      {"name": "col2", "type": "INTEGER", "nullable": true}
    ],
    "primaryKey": ["col1"]
  }]
}`
            }
          ],
          temperature: 0.2,
          max_tokens: 1000,
          response_format: { type: "json_object" }
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to detect schema');
      }
      
      const responseData = await response.json() as any;
      const content = responseData.choices[0]?.message?.content || '{}';
      return JSON.parse(content);
    } catch (error) {
      console.error('Schema detection error:', error);
      throw new Error(`Failed to detect schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  async suggestQueries(schema: SchemaDefinition): Promise<string[]> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: 'You are a data analyst who suggests useful queries.'
            },
            {
              role: 'user',
              content: `Based on this database schema, suggest 5 useful analytical queries:
              
${this.formatSchema(schema)}

Return a JSON array of natural language query descriptions (not SQL):
["Query description 1", "Query description 2", ...]`
            }
          ],
          temperature: 0.5,
          max_tokens: 500
        })
      });
      
      if (!response.ok) return [];
      
      const responseData = await response.json() as any;
      const content = responseData.choices[0]?.message?.content || '[]';
      
      try {
        return JSON.parse(content);
      } catch {
        return [];
      }
    } catch (error) {
      console.error('Query suggestion error:', error);
      return [];
    }
  }
  
  /**
   * Get available models for the API key
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });
      
      if (!response.ok) return ['gpt-3.5-turbo', 'gpt-4'];
      
      const responseData = await response.json() as any;
      const models = responseData.data
        .filter((m: any) => m.id.includes('gpt'))
        .map((m: any) => m.id)
        .sort();
      
      return models;
    } catch (error) {
      return ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo-preview'];
    }
  }
}

// Singleton instance management
let openAIClientInstance: OpenAIClient | null = null;

export function initializeOpenAIClient(config: OpenAIConfig): OpenAIClient {
  openAIClientInstance = new OpenAIClient(config);
  return openAIClientInstance;
}

export function getOpenAIClient(): OpenAIClient {
  if (!openAIClientInstance) {
    throw new Error('OpenAI client not initialized. Call initializeOpenAIClient first.');
  }
  return openAIClientInstance;
}