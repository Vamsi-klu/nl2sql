import { AggregateSpec, ColumnRef, SelectQueryIR, SqlDialect } from '../ir/types.js';
function q(ident: string, dialect: SqlDialect) {
  if (ident === '*') return '*';
  if (dialect === 'mysql') return `\`${ident.replace(/`/g, '``')}\``;
  return `"${ident.replace(/"/g, '""')}"`;
}

function emitColumn(c: ColumnRef | AggregateSpec, dialect: SqlDialect): string {
  if ('func' in c) {
    const a = c as AggregateSpec;
    const expr = 'expr' in a.expr ? (a.expr as any).expr : `${q((a.expr as any).table, dialect)}.${q((a.expr as any).column, dialect)}`;
    const sel = `${a.func.toUpperCase()}(${expr})`;
    return a.alias ? `${sel} AS ${q(a.alias, dialect)}` : sel;
  } else {
    const col = c as ColumnRef;
    const sel = `${q(col.table, dialect)}.${q(col.column, dialect)}`;
    if (col.alias) return `${sel} AS ${q(col.alias, dialect)}`;
    if (col.column !== '*') return `${sel} AS ${q(`${col.table}.${col.column}`, dialect)}`;
    return sel;
  }
}

function formatInterval(days: number, dialect: SqlDialect): string {
  if (dialect === 'postgres') return `CURRENT_DATE - INTERVAL '${days} days'`;
  if (dialect === 'mysql') return `DATE_SUB(CURDATE(), INTERVAL ${days} DAY)`;
  return `DATE('now', '-${days} days')`;
}

export function generateSQL(ir: SelectQueryIR, dialect: SqlDialect = 'sqlite'): string {
  const select = ir.columns.map((c) => emitColumn(c, dialect)).join(', ');
  const from = `FROM ${q(ir.from, dialect)}`;
  const joins = (ir.joins || [])
    .map((j) => {
      const joinTable = j.left.table === ir.from ? j.right.table : j.right.table === ir.from ? j.left.table : j.right.table;
      const onLeft = `${q(j.left.table, dialect)}.${q(j.left.column, dialect)}`;
      const onRight = `${q(j.right.table, dialect)}.${q(j.right.column, dialect)}`;
      return `${j.type.toUpperCase()} JOIN ${q(joinTable, dialect)} ON ${onLeft} = ${onRight}`;
    })
    .join(' ');

  const where = (ir.where || [])
    .map((w: any) => {
      const lhs = `${q(w.lhs.table, dialect)}.${q(w.lhs.column, dialect)}`;
      if (w.rhs && (w.rhs.intervalDays !== undefined)) return `${lhs} ${w.op} ${formatInterval(w.rhs.intervalDays, dialect)}`;
      if (w.rhs && w.rhs.expr) return `${lhs} ${w.op} ${w.rhs.expr}`;
      if (w.rhs && w.rhs.null) return `${lhs} ${w.op} NULL`;
      if (w.rhs && w.rhs.values) return `${lhs} ${w.op} (${(w.rhs.values as any[]).map((v) => JSON.stringify(v)).join(', ')})`;
      if (w.rhs && w.rhs.range) return `${lhs} BETWEEN ${JSON.stringify(w.rhs.range[0])} AND ${JSON.stringify(w.rhs.range[1])}`;
      const rhs = w.rhs && (w.rhs as any).value !== undefined ? JSON.stringify((w.rhs as any).value) : 'NULL';
      return `${lhs} ${w.op} ${rhs}`;
    })
    .join(' AND ');

  const groupBy = (ir.groupBy || [])
    .map((g) => `${q(g.table, dialect)}.${q(g.column, dialect)}`)
    .join(', ');

  const orderBy = (ir.orderBy || [])
    .map((o) => `${q(o.expr.table, dialect)}.${q(o.expr.column, dialect)} ${o.direction?.toUpperCase() || ''}`.trim())
    .join(', ');

  const parts = [
    `SELECT ${select}`,
    from,
    joins,
    where ? `WHERE ${where}` : '',
    groupBy ? `GROUP BY ${groupBy}` : '',
    orderBy ? `ORDER BY ${orderBy}` : '',
    ir.limit ? `LIMIT ${ir.limit}` : '',
  ].filter(Boolean);

  return parts.join('\n');
}
