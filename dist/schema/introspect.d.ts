import { Database } from '../sqlite/db.js';
export interface TableInfo {
    name: string;
    columns: {
        name: string;
        type?: string;
        pk?: boolean;
    }[];
}
export interface SchemaInfo {
    tables: TableInfo[];
}
export declare class SchemaIntrospector {
    private db;
    constructor(db: Database);
    getSchema(): SchemaInfo;
}
