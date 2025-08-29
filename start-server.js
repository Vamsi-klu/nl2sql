#!/usr/bin/env node

/**
 * NL2SQL Server Startup Script
 * Starts the API server and opens the web UI
 */

import { startServer } from './dist/server/app.js';

console.log(`
╔══════════════════════════════════════════════════╗
║                                                  ║
║     NL2SQL - Natural Language to SQL Engine     ║
║                                                  ║
║     Powered by OpenAI GPT Models                ║
║                                                  ║
╚══════════════════════════════════════════════════╝
`);

// Start the server
startServer().then(() => {
    console.log('\n📌 Quick Start Guide:');
    console.log('1. Set your OpenAI API key in the web UI (click the settings icon)');
    console.log('2. Enter your database schema (SQL DDL, JSON, CSV, or natural language)');
    console.log('3. Type your question in plain English');
    console.log('4. Click "Generate SQL" to see the magic happen!\n');
    
    console.log('🌐 Open your browser and navigate to: http://localhost:3000\n');
}).catch(error => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
});