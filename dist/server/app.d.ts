/**
 * Express API Server for NL2SQL
 * Provides REST API endpoints for SQL generation from natural language
 */
import { Express } from 'express';
declare const app: Express;
export declare function startServer(): Promise<void>;
export default app;
