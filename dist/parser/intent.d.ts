import { SchemaInfo } from '../schema/introspect.js';
import { SelectQueryIR } from '../ir/types.js';
export interface ParseOptions {
    defaultTable?: string;
}
/**
 * Heuristic NL → IR parser for common analytics intents.
 * Supports: count/sum/avg/min/max, simple filters, time windows (last N days),
 * group by entity (e.g., customer), and joining orders/order_items/customers.
 */
export declare function parseIntentToIR(prompt: string, schema: SchemaInfo, opts?: ParseOptions): SelectQueryIR;
