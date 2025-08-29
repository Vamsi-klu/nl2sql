import { SelectQueryIR } from '../ir/types.js';

export function explain(ir: SelectQueryIR): string {
  const lines: string[] = [];
  lines.push('Reasoning & Explanation:');
  lines.push('- Base table: ' + ir.from);
  if (ir.joins?.length) {
    for (const j of ir.joins) {
      lines.push(`- ${j.type} join: ${j.left.table}.${j.left.column} = ${j.right.table}.${j.right.column}`);
    }
  }
  const aggs = ir.columns.filter((c: any) => 'func' in c);
  if (aggs.length) {
    for (const a of aggs as any[]) {
      lines.push(`- Aggregate: ${a.func.toUpperCase()}(${a.expr.expr ?? `${a.expr.table}.${a.expr.column}`}) AS ${a.alias || '(no alias)'} (chosen based on intent keywords like total/sum/avg)`);
    }
  }
  if (ir.groupBy?.length) {
    lines.push('- Group by: ' + ir.groupBy.map((g) => `${g.table}.${g.column}`).join(', '));
  }
  if (ir.where?.length) {
    lines.push(
      '- Filters: ' +
        ir.where
          .map((w: any) => `${w.lhs.table}.${w.lhs.column} ${w.op} ${w.rhs?.expr ?? w.rhs?.value ?? (w.rhs?.null ? 'NULL' : '')}`)
          .join(' AND '),
    );
  }
  lines.push('- Projection minimized to only necessary columns to improve performance.');
  lines.push('- SQL is generated for SQLite; adapts to other dialects by swapping date/time functions and quoting rules.');
  return lines.join('\n');
}

