export type Row = Record<string, unknown>;
export declare class Database {
    private SQL;
    private db;
    init(): Promise<void>;
    exec(sql: string, params?: unknown[]): Row[];
    run(sql: string): void;
    loadJsonTable(name: string, rows: Row[]): void;
}
