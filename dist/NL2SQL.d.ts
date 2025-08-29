import type { SqlDialect } from './ir/types.js';
export interface RunOptions {
    prompt: string;
    schemaSql?: string;
    datasets?: Record<string, Record<string, unknown>[]>;
    execute?: boolean;
    dialect?: SqlDialect;
}
export declare class NL2SQL {
    run(opts: RunOptions): Promise<{
        sql: string;
        explanation: string;
        rows?: any[];
        note?: string;
    }>;
}
