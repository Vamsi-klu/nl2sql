import express from 'express';
import cors from 'cors';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import * as fsExtra from 'fs-extra';
import { NL2SQL } from './NL2SQL.js';
import { simpleFileProcessor, SimpleFileProcessor } from './file-processing/simple-processor.js';
import { logger } from './utils/logger.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// File upload setup
const uploadDir = './uploads';
fsExtra.ensureDirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 30 * 1024 * 1024, // 30MB limit
    files: 4
  }
});

// Session store (simple in-memory for demo)
const sessions = new Map<string, {
  id: string;
  files: string[];
  queries: number;
}>();

// Initialize file processor
const fileProcessor = new SimpleFileProcessor(uploadDir);

// API Routes
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/session', (req, res) => {
  const sessionId = req.headers['x-session-id'] as string || generateSessionId();
  
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      id: sessionId,
      files: [],
      queries: 0
    });
  }
  
  const session = sessions.get(sessionId)!;
  res.json({
    sessionId: session.id,
    filesUploaded: session.files.length,
    queriesExecuted: session.queries
  });
});

app.post('/api/upload', upload.array('files', 4), async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'] as string || generateSessionId();
    
    if (!req.files || !Array.isArray(req.files)) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const session = sessions.get(sessionId) || { id: sessionId, files: [], queries: 0 };
    const results = { success: [], errors: [] } as any;

    for (const file of req.files) {
      try {
        const processedFile = await fileProcessor.processFile(
          file.path,
          file.originalname,
          file.mimetype
        );
        
        results.success.push(processedFile);
        session.files.push(processedFile.id);
        
        // Clean up temp file
        await fs.promises.unlink(file.path);
      } catch (error) {
        results.errors.push({
          filename: file.originalname,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    sessions.set(sessionId, session);

    res.json({
      success: true,
      results,
      message: `Processed ${results.success.length} files successfully`
    });

  } catch (error) {
    logger.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.get('/api/files', async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'] as string;
    const session = sessions.get(sessionId);
    
    if (!session) {
      return res.json({ files: [] });
    }

    const files = [];
    for (const fileId of session.files) {
      const file = await fileProcessor.getProcessedFile(fileId);
      if (file) {
        files.push(file);
      }
    }

    res.json({ files });
  } catch (error) {
    logger.error('Error getting files:', error);
    res.status(500).json({ error: 'Failed to get files' });
  }
});

app.post('/api/query', async (req, res) => {
  try {
    const { query, fileIds = [], dialect = 'sqlite', execute = true } = req.body;
    const sessionId = req.headers['x-session-id'] as string;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Get processed files
    const datasets: Record<string, any[]> = {};
    let schemaSql = '';
    
    for (const fileId of fileIds) {
      const processedFile = await fileProcessor.getProcessedFile(fileId);
      if (processedFile) {
        if (processedFile.content.data) {
          const tableName = processedFile.originalName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
          datasets[tableName] = processedFile.content.data;
        }
        
        if (processedFile.content.raw && processedFile.type === 'schema') {
          schemaSql += processedFile.content.raw + '\n';
        }
      }
    }

    // Use existing NL2SQL
    const nl2sql = new NL2SQL();
    const result = await nl2sql.run({
      prompt: query,
      schemaSql: schemaSql || undefined,
      datasets: Object.keys(datasets).length > 0 ? datasets : undefined,
      execute,
      dialect
    });

    // Update session
    const session = sessions.get(sessionId);
    if (session) {
      session.queries++;
      sessions.set(sessionId, session);
    }

    res.json({
      ...result,
      filesUsed: fileIds,
      processingTime: Date.now() // Simple timestamp
    });

  } catch (error) {
    logger.error('Query error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Query failed' 
    });
  }
});

app.delete('/api/files/:id', async (req, res) => {
  try {
    const success = await fileProcessor.deleteProcessedFile(req.params.id);
    
    if (success) {
      // Remove from all sessions
      for (const session of sessions.values()) {
        const index = session.files.indexOf(req.params.id);
        if (index > -1) {
          session.files.splice(index, 1);
        }
      }
    }
    
    res.json({ success, message: success ? 'File deleted' : 'File not found' });
  } catch (error) {
    logger.error('Delete error:', error);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// Helper function
function generateSessionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Create demo data
async function createDemoData() {
  try {
    const demoDataDir = './demo-data';
    await fsExtra.ensureDir(demoDataDir);

    // Create sample customers data
    const customers = [
      { id: 1, name: 'John Doe', email: 'john@example.com', city: 'New York', state: 'NY' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com', city: 'Los Angeles', state: 'CA' },
      { id: 3, name: 'Bob Johnson', email: 'bob@example.com', city: 'Chicago', state: 'IL' },
      { id: 4, name: 'Alice Brown', email: 'alice@example.com', city: 'Houston', state: 'TX' },
      { id: 5, name: 'Charlie Wilson', email: 'charlie@example.com', city: 'Phoenix', state: 'AZ' }
    ];

    await fs.promises.writeFile(path.join(demoDataDir, 'customers.json'), JSON.stringify(customers, null, 2));

    // Create sample products data
    const products = [
      { id: 1, name: 'Laptop', category: 'Electronics', price: 1200, stock: 50 },
      { id: 2, name: 'Mouse', category: 'Electronics', price: 25, stock: 200 },
      { id: 3, name: 'Chair', category: 'Furniture', price: 150, stock: 30 },
      { id: 4, name: 'Desk', category: 'Furniture', price: 300, stock: 20 },
      { id: 5, name: 'Monitor', category: 'Electronics', price: 400, stock: 75 }
    ];

    await fs.promises.writeFile(path.join(demoDataDir, 'products.json'), JSON.stringify(products, null, 2));

    // Create sample orders data
    const orders = [
      { id: 1, customer_id: 1, product_id: 1, quantity: 1, total: 1200, order_date: '2024-01-15' },
      { id: 2, customer_id: 2, product_id: 2, quantity: 2, total: 50, order_date: '2024-01-16' },
      { id: 3, customer_id: 1, product_id: 3, quantity: 1, total: 150, order_date: '2024-01-17' },
      { id: 4, customer_id: 3, product_id: 1, quantity: 1, total: 1200, order_date: '2024-01-18' },
      { id: 5, customer_id: 4, product_id: 5, quantity: 1, total: 400, order_date: '2024-01-19' }
    ];

    await fs.promises.writeFile(path.join(demoDataDir, 'orders.json'), JSON.stringify(orders, null, 2));

    logger.info('Demo data created successfully');
  } catch (error) {
    logger.error('Failed to create demo data:', error);
  }
}

// Start server
async function startServer() {
  try {
    await fsExtra.ensureDir('./logs');
    await createDemoData();
    
    app.listen(PORT, () => {
      logger.info(`🚀 Advanced NL2SQL Demo Server running on http://localhost:${PORT}`);
      logger.info('📁 File uploads enabled with 30MB limit per file');
      logger.info('🎯 Try uploading the demo data files and asking questions like:');
      logger.info('   • "Show me all customers from California"');
      logger.info('   • "What are the top 3 most expensive products?"');
      logger.info('   • "Calculate total revenue by customer"');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down server...');
  process.exit(0);
});

startServer();