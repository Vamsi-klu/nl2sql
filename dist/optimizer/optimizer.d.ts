import { SelectQueryIR } from '../ir/types.js';
/**
 * Simple optimizer: drop unused projected columns when grouped, de-duplicate group by columns.
 */
export declare function optimizeIR(ir: SelectQueryIR): SelectQueryIR;
