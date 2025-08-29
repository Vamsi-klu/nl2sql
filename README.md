# @vybestack/nl2sql - AI-Powered Natural Language to SQL

Transform natural language questions into optimized SQL queries using Google's Gemini AI. This system understands your intent and generates accurate, efficient SQL for any database schema.

## 🚀 Features

- **Universal Schema Support**: Accepts SQL DDL, JSON, CSV headers, or natural language descriptions
- **Multi-Database Compatibility**: PostgreSQL, MySQL, SQLite, SQL Server, Oracle
- **AI-Powered Generation**: Uses Google Gemini for intelligent query understanding
- **Real-time Processing**: Instant SQL generation with explanations
- **Query Optimization**: Automatic performance optimization suggestions
- **Interactive Web UI**: Beautiful, responsive interface
- **REST API**: Full-featured API for integration
- **Query History**: Track and reuse previous queries
- **Export Results**: CSV, JSON, Excel formats
- **Rule-based Fallback**: Works even without API key using built-in parser

## Quickstart

```bash
# build
npm run -w packages/nl2sql build

# test (integration test executes generated SQL)
npm run -w packages/nl2sql test

# run the demo (from monorepo root)
npm run nl2sql:demo
```

## CLI

```bash
node packages/nl2sql/dist/cli.js \
  --prompt "Show total revenue per customer" \
  --schema examples/nl2sql/schema.sql \
  --json customers=examples/nl2sql/customers.json \
  --json orders=examples/nl2sql/orders.json \
  --json order_items=examples/nl2sql/order_items.json \
  --execute
```

## Programmatic API

```ts
import { NL2SQL } from '@vybestack/nl2sql';

const nl2sql = new NL2SQL();
const { sql, explanation, rows } = await nl2sql.run({
  prompt: 'Show total revenue per customer',
  schemaSql: await fs.readFile('examples/nl2sql/schema.sql', 'utf8'),
  datasets: {
    customers: JSON.parse(await fs.readFile('examples/nl2sql/customers.json', 'utf8')),
    orders: JSON.parse(await fs.readFile('examples/nl2sql/orders.json', 'utf8')),
    order_items: JSON.parse(await fs.readFile('examples/nl2sql/order_items.json', 'utf8')),
  },
  execute: true,
});
```

