import { SelectQueryIR } from '../ir/types.js';

/**
 * Simple optimizer: drop unused projected columns when grouped, de-duplicate group by columns.
 */
export function optimizeIR(ir: SelectQueryIR): SelectQueryIR {
  const next: SelectQueryIR = { ...ir };
  if (next.groupBy?.length) {
    // Ensure all groupBy columns are included in select
    const sel = next.columns.slice();
    for (const g of next.groupBy) {
      const exists = sel.some((c: any) => !('func' in c) && c.table === g.table && c.column === g.column);
      if (!exists) sel.unshift(g);
    }
    next.columns = sel;
  }
  if (next.groupBy) {
    // de-duplicate groupBy
    const seen = new Set<string>();
    next.groupBy = next.groupBy.filter((g) => {
      const key = `${g.table}.${g.column}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  return next;
}

