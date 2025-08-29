import { SelectQueryIR, SqlDialect } from '../ir/types.js';
export declare function generateSQL(ir: SelectQueryIR, dialect?: SqlDialect): string;
