# Advanced NL2SQL System 🚀

A comprehensive, AI-powered Natural Language to SQL transformation system with beautiful web interface, multi-format file support, and advanced query generation capabilities.

## ✨ Features

### 🎯 Core Capabilities
- **Multi-Format File Processing**: Upload and process Excel, CSV, JSON, PDF, Word, and SQL files
- **Intelligent Schema Inference**: Automatically detects and creates database schemas from data
- **Natural Language Understanding**: Advanced intent parsing for complex queries
- **Real-time Query Generation**: Instant SQL generation with explanations
- **Multi-Database Support**: PostgreSQL, MySQL, SQLite, SQL Server, Oracle
- **Beautiful Web Interface**: Responsive UI with drag & drop file uploads
- **Session Management**: Track files and query history across sessions

### 📁 File Processing
- **Excel Files**: Multi-sheet support with automatic data extraction
- **CSV Files**: Smart column detection with type inference
- **JSON Files**: Array and object structure recognition
- **PDF Documents**: Text extraction with schema inference
- **SQL Files**: DDL parsing and schema extraction
- **File Size**: Up to 30MB per file, 4 files simultaneously

### 🧠 Advanced Query Engine
- **Restaurant/Food Delivery Analytics**: Specialized support for merchant, restaurant, and order data
- **Time-based Filtering**: Date ranges, months (e.g., "June"), relative dates
- **Status Filtering**: Order status, completion status, etc.
- **Aggregation Functions**: SUM, AVG, COUNT, MIN, MAX with intelligent column detection
- **JOIN Operations**: Automatic relationship detection and join optimization
- **GROUP BY Logic**: Smart grouping by customers, products, restaurants, merchants

## 🚀 Quick Start

### Demo Server
```bash
# Install dependencies
npm install

# Start the demo server
npm run demo

# Open http://localhost:3001 in your browser
```

### Command Line Usage
```bash
# Build the project
npm run build

# Run with files
node dist/simple-demo.js

# Or use the enhanced CLI
node dist/cli.js --prompt "Show top restaurants by revenue" --schema schema.sql
```

## 💻 Web Interface

### File Upload
1. **Drag & Drop**: Simply drag files into the upload area
2. **File Selection**: Click "Select Files" to browse files
3. **Format Support**: Excel (.xlsx), CSV (.csv), JSON (.json), PDF (.pdf), SQL (.sql)
4. **Progress Tracking**: Real-time upload and processing feedback

### Query Generation
1. **Natural Language Input**: Describe what you want to find
2. **File Selection**: Choose which uploaded files to include in your query
3. **Dialect Selection**: PostgreSQL, MySQL, SQLite, etc.
4. **Execution Options**: Choose to execute query immediately or just generate SQL

### Example Queries
```
"Show me all customers from California"
"What are the top 3 most expensive products?"
"Calculate total revenue by customer"
"Find top 5 restaurants by average order total in June"
"Show completed orders for each merchant"
```

## 🏗️ Architecture

### Core Components
- **File Processor** (`src/file-processing/`): Multi-format file parsing and schema inference
- **Intent Parser** (`src/parser/intent.ts`): Natural language understanding and query planning
- **SQL Generator** (`src/generator/`): SQL query construction with optimization
- **Web Server** (`src/simple-demo.ts`): Express.js server with REST API
- **Frontend** (`public/`): Alpine.js + Tailwind CSS responsive interface

### Key Features Implementation

#### Schema Inference
```typescript
// Automatic schema detection from uploaded data
const schema = this.inferSchemaFromData(tables);

// Restaurant/merchant schema generation for analytics
const restaurantSchema = this.createRestaurantSchema();
```

#### Query Intent Understanding
```typescript
// Natural language parsing with context awareness
const ir = parseIntentToIR(prompt, schema, { defaultTable: 'orders' });

// Support for complex restaurant queries
if (/(per\s+restaurant|each\s+restaurant)/.test(text)) {
  groupBy.push(ref(base, 'merchant_id'));
}
```

#### Multi-Format Processing
```typescript
switch (processingMethod) {
  case 'application/pdf':
    await this.processPdfFile(filePath, processedFile);
    break;
  case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    await this.processExcelFile(filePath, processedFile);
    break;
  // ... more formats
}
```

## 🎯 Restaurant & Food Delivery Analytics

Special support for restaurant and food delivery platforms:

### Supported Entities
- **Merchants**: Restaurant/business information with parent-child relationships
- **Orders**: Transaction data with status, dates, and amounts
- **Restaurants**: Location and cuisine information
- **Customers**: User data and preferences

### Example Restaurant Queries
```
"Find top 5 restaurants with highest average total in June for completed orders"
"Show revenue per restaurateur this month" 
"Which merchants have the most orders?"
"Calculate average order value by cuisine type"
```

### Schema Recognition
The system automatically recognizes and creates appropriate schemas for:
- `merchants` table with `parent_merchant_id` for restaurateur relationships
- `orders` table with status tracking and date fields
- `restaurants` table with merchant relationships
- Proper foreign key relationships and joins

## 🔧 Configuration

### Environment Variables
```bash
PORT=3001                    # Server port
UPLOAD_LIMIT=30MB           # File upload limit
MAX_FILES=4                 # Maximum files per upload
```

### File Processing Settings
```typescript
const fileProcessor = new SimpleFileProcessor('./uploads', 30 * 1024 * 1024);
```

## 📊 API Endpoints

### File Management
- `POST /api/upload` - Upload and process files
- `GET /api/files` - List processed files
- `DELETE /api/files/:id` - Delete a file

### Query Processing
- `POST /api/query` - Generate SQL from natural language
- `GET /api/session` - Get session information

### Health Check
- `GET /health` - Server health status

## 🧪 Testing

### Demo Data
The system includes sample data for testing:
- `demo-data/customers.json` - Customer information
- `demo-data/products.json` - Product catalog
- `demo-data/orders.json` - Order transactions

### Test Queries
```bash
curl -X POST http://localhost:3001/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Show customers from California", "fileIds": ["file-id"]}'
```

## 🚀 Deployment

### Production Build
```bash
npm run build
npm run demo
```

### Docker Support
```dockerfile
FROM node:18
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "run", "demo"]
```

## 📈 Performance Features

- **Lazy Loading**: Files processed only when needed
- **Schema Caching**: Intelligent schema reuse
- **Query Optimization**: Automatic performance improvements
- **Session Management**: Efficient file and query tracking
- **Memory Management**: Automatic cleanup of temporary files

## 🔍 Troubleshooting

### Common Issues
1. **Upload Failures**: Check file size (30MB limit) and format support
2. **Schema Not Found**: Ensure files are selected before running queries
3. **Query Generation Errors**: Check that uploaded files contain recognizable data structures

### Debug Mode
```bash
DEBUG=nl2sql:* npm run demo
```

## 🤝 Contributing

### Development Setup
```bash
git clone <repository>
cd nl2sql
npm install
npm run build
```

### Project Structure
```
src/
├── simple-demo.ts              # Main server
├── file-processing/            # File upload and processing
│   └── simple-processor.ts
├── parser/                     # Natural language parsing
│   └── intent.ts
├── utils/                      # Utilities (logging, etc.)
└── ...

public/
├── index.html                  # Web interface
├── js/app.js                   # Frontend JavaScript
└── ...

demo-data/                      # Sample data files
```

## 📄 License

MIT License - see LICENSE file for details

## 🎉 Acknowledgments

Built with modern web technologies:
- **Backend**: Node.js, Express.js, TypeScript
- **Frontend**: Alpine.js, Tailwind CSS
- **File Processing**: XLSX, PDF-Parse, CSV-Parser
- **Database**: Better-SQLite3, SQL.js
- **UI/UX**: Responsive design with drag & drop

---

**Ready to transform natural language into SQL? Get started at http://localhost:3001** 🚀