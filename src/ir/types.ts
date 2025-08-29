export type AggregateFunc = 'count' | 'sum' | 'avg' | 'min' | 'max';

export interface ColumnRef {
  table: string;
  column: string;
  alias?: string;
}

export interface Condition {
  lhs: ColumnRef | { value: unknown };
  op: '=' | '!=' | '<' | '<=' | '>' | '>=' | 'like' | 'ilike' | 'in' | 'between' | 'is' | 'is not';
  rhs: ColumnRef | { value: unknown } | { values: unknown[] } | { range: [unknown, unknown] } | { null: true } | { expr?: string; intervalDays?: number };
}

export interface JoinSpec {
  type: 'inner' | 'left';
  left: ColumnRef;
  right: ColumnRef;
}

export interface OrderBySpec {
  expr: ColumnRef;
  direction?: 'asc' | 'desc';
}

export interface AggregateSpec {
  func: AggregateFunc;
  expr: ColumnRef | { expr: string }; // allow expressions like quantity*unit_price
  alias?: string;
}

export interface SelectQueryIR {
  from: string; // base table
  columns: (ColumnRef | AggregateSpec)[];
  joins?: JoinSpec[];
  where?: Condition[];
  groupBy?: ColumnRef[];
  having?: Condition[];
  orderBy?: OrderBySpec[];
  limit?: number;
}

export interface NL2SQLResult {
  sql: string;
  explanation: string;
}

export type SqlDialect = 'sqlite' | 'postgres' | 'mysql';

// Alias for compatibility with optimizer
export type IntermediateRepresentation = SelectQueryIR;

