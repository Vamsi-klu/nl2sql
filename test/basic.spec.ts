import { describe, it, expect } from 'vitest';
import { NL2SQL } from '../src/NL2SQL.js';

const schema = `
CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  name TEXT
);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER,
  order_date TEXT
);
CREATE TABLE order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER,
  product TEXT,
  quantity INTEGER,
  unit_price REAL
);
`;

const data = {
  customers: [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ],
  orders: [
    { id: 10, customer_id: 1, order_date: '2025-01-10' },
    { id: 11, customer_id: 1, order_date: '2025-01-18' },
    { id: 12, customer_id: 2, order_date: '2025-01-20' },
  ],
  order_items: [
    { id: 100, order_id: 10, product: 'A', quantity: 2, unit_price: 5.0 },
    { id: 101, order_id: 10, product: 'B', quantity: 1, unit_price: 12.0 },
    { id: 102, order_id: 11, product: 'A', quantity: 3, unit_price: 5.0 },
    { id: 103, order_id: 12, product: 'C', quantity: 4, unit_price: 7.5 }
  ],
};

describe('NL2SQL end-to-end', () => {
  it('computes total revenue per customer (last 30 days)', async () => {
    const nl2sql = new NL2SQL();
    const prompt = 'Show total revenue per customer';

    const res = await nl2sql.run({ prompt, schemaSql: schema, datasets: data, execute: true });
    // Debug output to assist diagnosis if assertion fails
    // eslint-disable-next-line no-console
    console.log('\nSQL Generated:\n', res.sql, '\nRows:\n', JSON.stringify(res.rows, null, 2));

    // SQL contains expected structures
    expect(res.sql.toLowerCase()).toContain('sum(');
    expect(res.sql.toLowerCase()).toContain('group by');
    expect(res.sql.toLowerCase()).toContain('join');

    // Compute expected rows
    // Alice: order 10 -> 2*5 + 1*12 = 22; order 11 -> 3*5 = 15; total 37
    // Bob: order 12 -> 4*7.5 = 30
    const rows = res.rows || [];
    // rows may be in any order; create map by name or id
    const byKey: Record<string, number> = {};
    for (const r of rows as any[]) {
      const key = (r['customers.name'] ?? r['customers.id'] ?? r['name'] ?? r['id']) as string | number;
      const val = (r['total_revenue'] ?? r['SUM'] ?? r['sum']) as number;
      byKey[String(key)] = Number(val);
    }
    expect(byKey['Alice']).toBeCloseTo(37);
    expect(byKey['Bob']).toBeCloseTo(30);
  });
});
