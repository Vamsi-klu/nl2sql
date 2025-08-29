/**
 * Express API Server for NL2SQL
 * Provides REST API endpoints for SQL generation from natural language
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import NodeCache from 'node-cache';
import { initializeOpenAIClient, OpenAIClient, QueryGenerationRequest, SQLDialect } from '../llm/openai-client.js';
import { SchemaParser, SchemaFormat } from '../schema/schema-parser.js';
import { QueryExecutor } from '../executor/query-executor.js';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Initialize Express app
const app: Express = express();
const PORT = process.env.PORT || 3000;

// Initialize cache (TTL in seconds)
const cache = new NodeCache({ stdTTL: parseInt(process.env.CACHE_TTL || '3600') });

// Initialize OpenAI client
let openAIClient: OpenAIClient;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// Request validation schemas
const QueryRequestSchema = z.object({
  query: z.string().min(1).max(1000),
  schema: z.union([
    z.string(),
    z.object({
      tables: z.array(z.any())
    })
  ]),
  schemaFormat: z.enum(['sql_ddl', 'json', 'csv', 'natural_language', 'auto_detect']).optional(),
  dialect: z.enum(['postgresql', 'mysql', 'sqlite', 'sqlserver', 'oracle']).optional(),
  execute: z.boolean().optional(),
  useCache: z.boolean().optional().default(true),
  context: z.object({
    previousQueries: z.array(z.string()).optional(),
    businessRules: z.array(z.string()).optional()
  }).optional()
});

const SchemaUploadSchema = z.object({
  schema: z.string(),
  format: z.enum(['sql_ddl', 'json', 'csv', 'natural_language', 'auto_detect']).optional(),
  name: z.string().optional()
});

// Store schemas in memory (in production, use a database)
const schemaStore = new Map<string, any>();

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    openai: openAIClient ? 'connected' : 'not initialized'
  });
});

// Validate API key endpoint
app.post('/api/validate-key', async (req: Request, res: Response) => {
  try {
    const { apiKey, model } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ 
        valid: false, 
        error: 'API key is required' 
      });
    }
    
    // Create a temporary client to test the key
    const testClient = initializeOpenAIClient({
      apiKey,
      model: model || 'gpt-3.5-turbo'
    });
    
    const validation = await testClient.validateApiKey();
    
    if (validation.valid) {
      // If valid, update the global client
      openAIClient = testClient;
      
      // Get available models
      const models = await testClient.getAvailableModels();
      
      res.json({ 
        valid: true, 
        message: 'API key is valid',
        models 
      });
    } else {
      res.status(401).json({ 
        valid: false, 
        error: validation.error || 'Invalid API key' 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      valid: false, 
      error: error instanceof Error ? error.message : 'Validation failed' 
    });
  }
});

// Main query endpoint
app.post('/api/query', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request
    const validatedData = QueryRequestSchema.parse(req.body);
    
    // Generate cache key
    const cacheKey = `query:${JSON.stringify({
      query: validatedData.query,
      schema: typeof validatedData.schema === 'string' 
        ? validatedData.schema.substring(0, 100) 
        : 'object',
      dialect: validatedData.dialect
    })}`;
    
    // Check cache
    if (validatedData.useCache) {
      const cached = cache.get(cacheKey);
      if (cached) {
        return res.json({
          ...cached,
          fromCache: true
        });
      }
    }
    
    // Parse schema if needed
    let parsedSchema;
    if (typeof validatedData.schema === 'string') {
      const parser = new SchemaParser();
      parsedSchema = await parser.parse(validatedData.schema, {
        format: validatedData.schemaFormat as SchemaFormat || SchemaFormat.AUTO_DETECT,
        inferRelationships: true
      });
    } else {
      parsedSchema = validatedData.schema;
    }
    
    // Generate SQL using Gemini
    const request: QueryGenerationRequest = {
      naturalLanguageQuery: validatedData.query,
      schema: parsedSchema,
      dialect: validatedData.dialect as SQLDialect || SQLDialect.POSTGRESQL,
      context: validatedData.context
    };
    
    // Check if OpenAI client is initialized
    if (!openAIClient) {
      return res.status(503).json({
        error: 'AI service not initialized. Please configure your OpenAI API key first.'
      });
    }
    
    const result = await openAIClient.generateSQL(request);
    
    // Execute query if requested
    let executionResult = null;
    if (validatedData.execute) {
      const executor = new QueryExecutor();
      try {
        executionResult = await executor.execute(result.sql, {
          dialect: validatedData.dialect as SQLDialect,
          schema: parsedSchema
        });
      } catch (execError) {
        console.error('Query execution error:', execError);
        executionResult = {
          error: execError instanceof Error ? execError.message : 'Execution failed',
          rows: []
        };
      }
    }
    
    const response = {
      sql: result.sql,
      explanation: result.explanation,
      confidence: result.confidence,
      alternativeQueries: result.alternativeQueries,
      warnings: result.warnings,
      optimizationSuggestions: result.optimizationSuggestions,
      execution: executionResult,
      timestamp: new Date().toISOString()
    };
    
    // Cache the result
    if (validatedData.useCache) {
      cache.set(cacheKey, response);
    }
    
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Schema upload endpoint
app.post('/api/schema', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = SchemaUploadSchema.parse(req.body);
    
    const parser = new SchemaParser();
    const parsedSchema = await parser.parse(validatedData.schema, {
      format: validatedData.format as SchemaFormat || SchemaFormat.AUTO_DETECT,
      inferRelationships: true,
      detectIndexes: true
    });
    
    // Store schema
    const schemaId = validatedData.name || `schema_${Date.now()}`;
    schemaStore.set(schemaId, parsedSchema);
    
    res.json({
      schemaId,
      schema: parsedSchema,
      message: 'Schema uploaded successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Get stored schema
app.get('/api/schema/:id', (req: Request, res: Response) => {
  const schema = schemaStore.get(req.params.id);
  
  if (!schema) {
    return res.status(404).json({
      error: 'Schema not found'
    });
  }
  
  res.json({
    schemaId: req.params.id,
    schema
  });
});

// List all schemas
app.get('/api/schemas', (req: Request, res: Response) => {
  const schemas = Array.from(schemaStore.entries()).map(([id, schema]) => ({
    id,
    tables: schema.tables?.length || 0,
    relationships: schema.relationships?.length || 0
  }));
  
  res.json({ schemas });
});

// Validate SQL endpoint
app.post('/api/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sql, dialect } = req.body;
    
    if (!sql) {
      return res.status(400).json({ error: 'SQL query is required' });
    }
    
    if (!openAIClient) {
      return res.status(503).json({ error: 'AI service not initialized' });
    }
    
    const isValid = await openAIClient.validateSQL(
      sql,
      dialect as SQLDialect || SQLDialect.POSTGRESQL
    );
    
    res.json({ valid: isValid });
  } catch (error) {
    next(error);
  }
});

// Explain SQL endpoint
app.post('/api/explain', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sql } = req.body;
    
    if (!sql) {
      return res.status(400).json({ error: 'SQL query is required' });
    }
    
    if (!openAIClient) {
      return res.status(503).json({ error: 'AI service not initialized' });
    }
    
    const explanation = await openAIClient.explainSQL(sql);
    
    res.json({ explanation });
  } catch (error) {
    next(error);
  }
});

// Optimize SQL endpoint
app.post('/api/optimize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sql, schema } = req.body;
    
    if (!sql || !schema) {
      return res.status(400).json({ 
        error: 'Both SQL query and schema are required' 
      });
    }
    
    let parsedSchema;
    if (typeof schema === 'string') {
      const parser = new SchemaParser();
      parsedSchema = await parser.parse(schema);
    } else {
      parsedSchema = schema;
    }
    
    if (!openAIClient) {
      return res.status(503).json({ error: 'AI service not initialized' });
    }
    
    const optimized = await openAIClient.optimizeSQL(sql, parsedSchema);
    
    res.json({ 
      original: sql,
      optimized 
    });
  } catch (error) {
    next(error);
  }
});

// Detect schema from sample data
app.post('/api/detect-schema', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data } = req.body;
    
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ 
        error: 'Sample data array is required' 
      });
    }
    
    if (!openAIClient) {
      return res.status(503).json({ error: 'AI service not initialized' });
    }
    
    const schema = await openAIClient.detectSchema(data);
    
    res.json({ schema });
  } catch (error) {
    next(error);
  }
});

// Suggest queries endpoint
app.post('/api/suggest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { schema } = req.body;
    
    if (!schema) {
      return res.status(400).json({ error: 'Schema is required' });
    }
    
    let parsedSchema;
    if (typeof schema === 'string') {
      const parser = new SchemaParser();
      parsedSchema = await parser.parse(schema);
    } else {
      parsedSchema = schema;
    }
    
    if (!openAIClient) {
      return res.status(503).json({ error: 'AI service not initialized' });
    }
    
    const suggestions = await openAIClient.suggestQueries(parsedSchema);
    
    res.json({ suggestions });
  } catch (error) {
    next(error);
  }
});

// Cache statistics endpoint
app.get('/api/cache/stats', (req: Request, res: Response) => {
  const keys = cache.keys();
  const stats = {
    size: keys.length,
    hits: cache.getStats().hits,
    misses: cache.getStats().misses,
    keys: keys.slice(0, 10) // Show first 10 keys
  };
  
  res.json(stats);
});

// Clear cache endpoint
app.post('/api/cache/clear', (req: Request, res: Response) => {
  cache.flushAll();
  res.json({ message: 'Cache cleared successfully' });
});

// Error handling middleware
app.use((error: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', error);
  
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      error: 'Validation error',
      details: error.errors
    });
  }
  
  if (error.message?.includes('OpenAI') || error.message?.includes('API')) {
    return res.status(503).json({
      error: 'AI service temporarily unavailable',
      message: error.message
    });
  }
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Serve static files (for the UI)
app.use(express.static('public'));

// Initialize server
export async function startServer() {
  try {
    // Initialize OpenAI client if API key is provided
    if (process.env.OPENAI_API_KEY) {
      openAIClient = initializeOpenAIClient({
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        temperature: 0.2,
        maxTokens: 2048
      });
      
      // Validate the API key
      const validation = await openAIClient.validateApiKey();
      if (validation.valid) {
        console.log('✅ OpenAI client initialized and validated');
      } else {
        console.warn('⚠️ OpenAI API key validation failed:', validation.error);
        openAIClient = null as any;
      }
    } else {
      console.warn('⚠️ OPENAI_API_KEY not set. Please configure via the web UI.');
    }
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 NL2SQL server running on http://localhost:${PORT}`);
      console.log(`📚 API documentation: http://localhost:${PORT}/api-docs`);
      console.log(`🎨 Web UI: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Export app for testing
export default app;

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}