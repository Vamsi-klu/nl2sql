function singularize(word) {
    if (word.endsWith('ies'))
        return word.slice(0, -3) + 'y';
    if (word.endsWith('s'))
        return word.slice(0, -1);
    return word;
}
function findTableByName(schema, name) {
    const lname = name.toLowerCase();
    const byExact = schema.tables.find((t) => t.name.toLowerCase() === lname);
    if (byExact)
        return byExact.name;
    // try plural/singular
    const alt = singularize(lname);
    const bySing = schema.tables.find((t) => t.name.toLowerCase() === alt || t.name.toLowerCase() === alt + 's');
    return bySing?.name;
}
function columnExists(schema, table, column) {
    const t = schema.tables.find((x) => x.name === table);
    if (!t)
        return false;
    return t.columns.some((c) => c.name.toLowerCase() === column.toLowerCase());
}
function likelyDateColumn(schema, table) {
    const candidates = ['created_at', 'order_date', 'date', 'timestamp', 'createdat'];
    const t = schema.tables.find((x) => x.name === table);
    if (!t)
        return undefined;
    for (const c of candidates) {
        const hit = t.columns.find((x) => x.name.toLowerCase() === c);
        if (hit)
            return hit.name;
    }
    return undefined;
}
function hasOrderItems(schema) {
    return !!schema.tables.find((t) => t.name.toLowerCase().includes('order_items'));
}
function ref(table, column) {
    return { table, column };
}
/**
 * Heuristic NL → IR parser for common analytics intents.
 * Supports: count/sum/avg/min/max, simple filters, time windows (last N days),
 * group by entity (e.g., customer), and joining orders/order_items/customers.
 */
export function parseIntentToIR(prompt, schema, opts = {}) {
    const text = prompt.toLowerCase();
    // Identify base entity/table
    let base;
    const entityHints = ['orders', 'order items', 'order_items', 'customers', 'users', 'products', 'invoices'];
    for (const hint of entityHints) {
        const name = hint.replace(' ', '_');
        if (text.includes(hint) || text.includes(name)) {
            base = findTableByName(schema, name) ?? base;
        }
    }
    if (!base) {
        base = opts.defaultTable || schema.tables[0]?.name;
    }
    if (!base)
        throw new Error('No tables available to infer from.');
    // Aggregation intent
    let agg;
    if (/(total|sum|revenue|sales)/.test(text)) {
        // Prefer revenue from order_items if present
        if (hasOrderItems(schema) && findTableByName(schema, 'order_items')) {
            const oi = findTableByName(schema, 'order_items');
            agg = { func: 'sum', expr: { expr: `${oi}.quantity * ${oi}.unit_price` }, alias: 'total_revenue' };
        }
        else if (columnExists(schema, base, 'amount')) {
            agg = { func: 'sum', expr: ref(base, 'amount'), alias: 'total_amount' };
        }
        else if (columnExists(schema, base, 'price')) {
            agg = { func: 'sum', expr: ref(base, 'price'), alias: 'total_price' };
        }
    }
    else if (/count/.test(text)) {
        agg = { func: 'count', expr: ref(base, '*'), alias: 'count' };
    }
    else if (/avg|average|mean/.test(text)) {
        if (columnExists(schema, base, 'amount'))
            agg = { func: 'avg', expr: ref(base, 'amount'), alias: 'avg_amount' };
    }
    // Grouping intent (by customer, product, date)
    const groupBy = [];
    if (/per\s+customer|by\s+customer/.test(text)) {
        const cust = findTableByName(schema, 'customers') || findTableByName(schema, 'users');
        if (cust) {
            // group by customer id/name
            if (columnExists(schema, cust, 'name'))
                groupBy.push(ref(cust, 'name'));
            else if (columnExists(schema, cust, 'id'))
                groupBy.push(ref(cust, 'id'));
        }
    }
    else if (/per\s+product|by\s+product/.test(text)) {
        const prod = findTableByName(schema, 'products');
        if (prod) {
            if (columnExists(schema, prod, 'name'))
                groupBy.push(ref(prod, 'name'));
            else if (columnExists(schema, prod, 'id'))
                groupBy.push(ref(prod, 'id'));
        }
    }
    else if (/per\s+day|by\s+day|per\s+date|by\s+date/.test(text)) {
        const dc = likelyDateColumn(schema, base);
        if (dc)
            groupBy.push(ref(base, dc));
    }
    // Joins: common patterns customers ← orders ← order_items
    const joins = [];
    const orders = findTableByName(schema, 'orders');
    const orderItems = findTableByName(schema, 'order_items');
    const customers = findTableByName(schema, 'customers') || findTableByName(schema, 'users');
    // If revenue with order_items, ensure joins orders↔order_items
    if (agg && 'expr' in agg && typeof agg.expr === 'object' && agg.expr.expr?.includes('order_items')) {
        if (orders && orderItems) {
            joins.push({ type: 'inner', left: ref(orders, 'id'), right: ref(orderItems, 'order_id') });
            base = orders;
        }
    }
    // If grouping by customer, join customers
    if (groupBy.some((g) => g.table === customers)) {
        if (customers && orders) {
            joins.push({ type: 'inner', left: ref(customers, 'id'), right: ref(orders, 'customer_id') });
            base = orders;
        }
    }
    const columns = [];
    if (groupBy.length)
        columns.push(...groupBy);
    if (agg)
        columns.push(agg);
    if (columns.length === 0) {
        // fallback to select all columns
        columns.push({ table: base, column: '*' });
    }
    // Time window: last N days (after base/joins finalized)
    const daysMatch = text.match(/last\s+(\d+)\s+days?/);
    const where = [];
    if (daysMatch) {
        const dc = likelyDateColumn(schema, base) || likelyDateColumn(schema, findTableByName(schema, 'orders') || base);
        if (dc) {
            where.push({ lhs: ref(base, dc), op: '>=', rhs: { expr: `DATE('now', '-${daysMatch[1]} days')`, intervalDays: Number(daysMatch[1]) } });
        }
    }
    return {
        from: base,
        columns,
        joins: joins.length ? joins : undefined,
        where: where.length ? where : undefined,
        groupBy: groupBy.length ? groupBy : undefined,
    };
}
//# sourceMappingURL=intent.js.map