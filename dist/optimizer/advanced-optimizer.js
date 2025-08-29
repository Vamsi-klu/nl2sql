/**
 * Advanced Query Optimization Engine for NL2SQL
 * Implements cost-based optimization, query rewriting, and performance analysis
 */
export var PlanNodeType;
(function (PlanNodeType) {
    PlanNodeType["SCAN"] = "SCAN";
    PlanNodeType["INDEX_SCAN"] = "INDEX_SCAN";
    PlanNodeType["BITMAP_SCAN"] = "BITMAP_SCAN";
    PlanNodeType["JOIN"] = "JOIN";
    PlanNodeType["SORT"] = "SORT";
    PlanNodeType["AGGREGATE"] = "AGGREGATE";
    PlanNodeType["FILTER"] = "FILTER";
    PlanNodeType["LIMIT"] = "LIMIT";
    PlanNodeType["MATERIALIZE"] = "MATERIALIZE";
    PlanNodeType["SUBQUERY"] = "SUBQUERY";
    PlanNodeType["CTE"] = "CTE";
})(PlanNodeType || (PlanNodeType = {}));
export var OptimizationType;
(function (OptimizationType) {
    OptimizationType["PREDICATE_PUSHDOWN"] = "PREDICATE_PUSHDOWN";
    OptimizationType["JOIN_REORDERING"] = "JOIN_REORDERING";
    OptimizationType["INDEX_SELECTION"] = "INDEX_SELECTION";
    OptimizationType["SUBQUERY_UNNESTING"] = "SUBQUERY_UNNESTING";
    OptimizationType["COMMON_SUBEXPRESSION"] = "COMMON_SUBEXPRESSION";
    OptimizationType["PARTITION_PRUNING"] = "PARTITION_PRUNING";
    OptimizationType["MATERIALIZED_VIEW"] = "MATERIALIZED_VIEW";
    OptimizationType["QUERY_REWRITE"] = "QUERY_REWRITE";
    OptimizationType["COLUMN_PRUNING"] = "COLUMN_PRUNING";
    OptimizationType["CONSTANT_FOLDING"] = "CONSTANT_FOLDING";
})(OptimizationType || (OptimizationType = {}));
export var RecommendationType;
(function (RecommendationType) {
    RecommendationType["CREATE_INDEX"] = "CREATE_INDEX";
    RecommendationType["UPDATE_STATISTICS"] = "UPDATE_STATISTICS";
    RecommendationType["PARTITION_TABLE"] = "PARTITION_TABLE";
    RecommendationType["DENORMALIZE"] = "DENORMALIZE";
    RecommendationType["MATERIALIZED_VIEW"] = "MATERIALIZED_VIEW";
    RecommendationType["QUERY_REWRITE"] = "QUERY_REWRITE";
})(RecommendationType || (RecommendationType = {}));
export class AdvancedQueryOptimizer {
    schema;
    costModel;
    rewriter;
    joinOptimizer;
    indexSelector;
    statisticsManager;
    cache;
    constructor(schema) {
        this.schema = schema;
        this.costModel = new CostModel(schema);
        this.rewriter = new QueryRewriter();
        this.joinOptimizer = new JoinOptimizer(this.costModel);
        this.indexSelector = new IndexSelector(schema);
        this.statisticsManager = new StatisticsManager(schema);
        this.cache = new QueryCache();
    }
    optimize(ir) {
        const startTime = Date.now();
        const optimizations = [];
        // Check cache first
        const cached = this.cache.get(ir);
        if (cached) {
            return cached;
        }
        // Clone IR for optimization
        let optimized = this.cloneIR(ir);
        const originalCost = this.costModel.estimate(optimized);
        // 1. Constant folding and simplification
        const simplified = this.rewriter.simplify(optimized);
        if (simplified !== optimized) {
            optimizations.push({
                type: OptimizationType.CONSTANT_FOLDING,
                description: 'Simplified constant expressions and predicates',
                impact: 'LOW',
                costReduction: originalCost - this.costModel.estimate(simplified)
            });
            optimized = simplified;
        }
        // 2. Predicate pushdown
        const pushedDown = this.pushPredicates(optimized);
        if (pushedDown !== optimized) {
            optimizations.push({
                type: OptimizationType.PREDICATE_PUSHDOWN,
                description: 'Pushed predicates closer to data source',
                impact: 'HIGH',
                costReduction: this.costModel.estimate(optimized) - this.costModel.estimate(pushedDown)
            });
            optimized = pushedDown;
        }
        // 3. Column pruning
        const pruned = this.pruneColumns(optimized);
        if (pruned !== optimized) {
            optimizations.push({
                type: OptimizationType.COLUMN_PRUNING,
                description: 'Removed unnecessary columns from scan',
                impact: 'MEDIUM',
                costReduction: this.costModel.estimate(optimized) - this.costModel.estimate(pruned)
            });
            optimized = pruned;
        }
        // 4. Join order optimization
        if (optimized.joins && optimized.joins.length > 1) {
            const reordered = this.joinOptimizer.optimize(optimized);
            if (reordered !== optimized) {
                optimizations.push({
                    type: OptimizationType.JOIN_REORDERING,
                    description: 'Optimized join order based on selectivity and cost',
                    impact: 'HIGH',
                    costReduction: this.costModel.estimate(optimized) - this.costModel.estimate(reordered)
                });
                optimized = reordered;
            }
        }
        // 5. Index selection
        const withIndexes = this.selectIndexes(optimized);
        if (withIndexes !== optimized) {
            optimizations.push({
                type: OptimizationType.INDEX_SELECTION,
                description: 'Selected optimal indexes for query execution',
                impact: 'HIGH',
                costReduction: this.costModel.estimate(optimized) - this.costModel.estimate(withIndexes)
            });
            optimized = withIndexes;
        }
        // 6. Subquery optimization
        if (this.hasSubqueries(optimized)) {
            const unnested = this.rewriter.unnestSubqueries(optimized);
            if (unnested !== optimized) {
                optimizations.push({
                    type: OptimizationType.SUBQUERY_UNNESTING,
                    description: 'Converted subqueries to joins where possible',
                    impact: 'MEDIUM',
                    costReduction: this.costModel.estimate(optimized) - this.costModel.estimate(unnested)
                });
                optimized = unnested;
            }
        }
        // Generate query plan
        const plan = this.generatePlan(optimized);
        const estimatedCost = this.costModel.estimate(optimized);
        // Generate alternatives
        const alternatives = this.generateAlternatives(optimized);
        // Generate recommendations
        const recommendations = this.generateRecommendations(optimized, plan);
        // Update statistics
        this.statisticsManager.updateQueryStats(optimized, Date.now() - startTime);
        const result = {
            optimizedIR: optimized,
            plan,
            estimatedCost,
            optimizations,
            alternatives,
            recommendations
        };
        // Cache the result
        this.cache.set(ir, result);
        return result;
    }
    pushPredicates(ir) {
        if (!ir.where || ir.where.length === 0)
            return ir;
        const optimized = this.cloneIR(ir);
        const pushed = [];
        const remaining = [];
        // Analyze each condition
        for (const condition of ir.where) {
            if (this.canPushDown(condition, ir)) {
                pushed.push(condition);
            }
            else {
                remaining.push(condition);
            }
        }
        // Apply pushed predicates
        if (pushed.length > 0) {
            // If we have joins, try to push predicates to join conditions
            if (optimized.joins) {
                for (const join of optimized.joins) {
                    const relevantConditions = pushed.filter(c => this.isRelevantToJoin(c, join));
                    if (relevantConditions.length > 0) {
                        // Add to join condition
                        join.conditions = [
                            ...join.conditions || [],
                            ...relevantConditions
                        ];
                    }
                }
            }
            optimized.where = remaining;
        }
        return optimized;
    }
    pruneColumns(ir) {
        // Determine which columns are actually needed
        const neededColumns = new Set();
        // Add selected columns
        if (ir.columns) {
            for (const col of ir.columns) {
                neededColumns.add(`${col.table}.${col.column}`);
            }
        }
        // Add columns used in conditions
        if (ir.where) {
            for (const condition of ir.where) {
                if ('table' in condition.lhs) {
                    neededColumns.add(`${condition.lhs.table}.${condition.lhs.column}`);
                }
                if ('table' in condition.rhs) {
                    neededColumns.add(`${condition.rhs.table}.${condition.rhs.column}`);
                }
            }
        }
        // Add columns used in joins
        if (ir.joins) {
            for (const join of ir.joins) {
                neededColumns.add(`${join.left.table}.${join.left.column}`);
                neededColumns.add(`${join.right.table}.${join.right.column}`);
            }
        }
        // Add columns used in group by
        if (ir.groupBy) {
            for (const col of ir.groupBy) {
                neededColumns.add(`${col.table}.${col.column}`);
            }
        }
        // Add columns used in order by
        if (ir.orderBy) {
            for (const order of ir.orderBy) {
                neededColumns.add(`${order.column.table}.${order.column.column}`);
            }
        }
        // Create optimized IR with pruned columns
        const optimized = this.cloneIR(ir);
        optimized.prunedColumns = Array.from(neededColumns);
        return optimized;
    }
    selectIndexes(ir) {
        const optimized = this.cloneIR(ir);
        const selectedIndexes = new Map();
        // Analyze conditions for index usage
        if (ir.where) {
            for (const condition of ir.where) {
                if ('table' in condition.lhs) {
                    const indexes = this.indexSelector.selectForCondition(condition.lhs.table, condition.lhs.column, condition.op);
                    if (indexes.length > 0) {
                        const existing = selectedIndexes.get(condition.lhs.table) || [];
                        selectedIndexes.set(condition.lhs.table, [...existing, ...indexes]);
                    }
                }
            }
        }
        // Analyze joins for index usage
        if (ir.joins) {
            for (const join of ir.joins) {
                const leftIndexes = this.indexSelector.selectForJoin(join.left.table, join.left.column);
                const rightIndexes = this.indexSelector.selectForJoin(join.right.table, join.right.column);
                if (leftIndexes.length > 0) {
                    const existing = selectedIndexes.get(join.left.table) || [];
                    selectedIndexes.set(join.left.table, [...existing, ...leftIndexes]);
                }
                if (rightIndexes.length > 0) {
                    const existing = selectedIndexes.get(join.right.table) || [];
                    selectedIndexes.set(join.right.table, [...existing, ...rightIndexes]);
                }
            }
        }
        // Analyze order by for index usage
        if (ir.orderBy && ir.orderBy.length > 0) {
            const firstOrder = ir.orderBy[0];
            const indexes = this.indexSelector.selectForSort(firstOrder.column.table, firstOrder.column.column, firstOrder.direction);
            if (indexes.length > 0) {
                const existing = selectedIndexes.get(firstOrder.column.table) || [];
                selectedIndexes.set(firstOrder.column.table, [...existing, ...indexes]);
            }
        }
        // Store selected indexes in IR
        optimized.selectedIndexes = selectedIndexes;
        return optimized;
    }
    generatePlan(ir) {
        const root = {
            type: PlanNodeType.SCAN,
            operation: 'Result',
            cost: 0,
            rows: 1,
            width: 0,
            children: []
        };
        let current = root;
        // Add base table scan
        const scanNode = {
            type: this.hasSelectedIndex(ir, ir.from) ? PlanNodeType.INDEX_SCAN : PlanNodeType.SCAN,
            operation: `Scan ${ir.from}`,
            cost: this.costModel.scanCost(ir.from),
            rows: this.statisticsManager.getTableRows(ir.from),
            width: this.statisticsManager.getRowWidth(ir.from)
        };
        current.children.push(scanNode);
        current = scanNode;
        // Add filter node if where conditions exist
        if (ir.where && ir.where.length > 0) {
            const filterNode = {
                type: PlanNodeType.FILTER,
                operation: 'Filter',
                cost: this.costModel.filterCost(ir.where),
                rows: Math.floor(current.rows * this.estimateSelectivity(ir.where)),
                width: current.width,
                children: [current]
            };
            current = filterNode;
        }
        // Add join nodes
        if (ir.joins) {
            for (const join of ir.joins) {
                const joinNode = {
                    type: PlanNodeType.JOIN,
                    operation: `${join.type.toUpperCase()} Join`,
                    cost: this.costModel.joinCost(join, current.rows),
                    rows: this.estimateJoinRows(join, current.rows),
                    width: current.width * 2, // Approximate
                    children: [current],
                    details: {
                        condition: `${join.left.table}.${join.left.column} = ${join.right.table}.${join.right.column}`
                    }
                };
                // Add right side scan
                const rightScan = {
                    type: this.hasSelectedIndex(ir, join.right.table) ? PlanNodeType.INDEX_SCAN : PlanNodeType.SCAN,
                    operation: `Scan ${join.right.table}`,
                    cost: this.costModel.scanCost(join.right.table),
                    rows: this.statisticsManager.getTableRows(join.right.table),
                    width: this.statisticsManager.getRowWidth(join.right.table)
                };
                joinNode.children.push(rightScan);
                current = joinNode;
            }
        }
        // Add aggregation node if group by exists
        if (ir.groupBy && ir.groupBy.length > 0) {
            const aggregateNode = {
                type: PlanNodeType.AGGREGATE,
                operation: 'GroupAggregate',
                cost: this.costModel.aggregateCost(ir.groupBy, current.rows),
                rows: this.estimateGroupRows(ir.groupBy, current.rows),
                width: current.width,
                children: [current]
            };
            current = aggregateNode;
        }
        // Add sort node if order by exists
        if (ir.orderBy && ir.orderBy.length > 0) {
            const sortNode = {
                type: PlanNodeType.SORT,
                operation: 'Sort',
                cost: this.costModel.sortCost(current.rows),
                rows: current.rows,
                width: current.width,
                children: [current],
                details: {
                    keys: ir.orderBy.map(o => `${o.column.table}.${o.column.column} ${o.direction}`)
                }
            };
            current = sortNode;
        }
        // Add limit node if limit exists
        if (ir.limit) {
            const limitNode = {
                type: PlanNodeType.LIMIT,
                operation: `Limit ${ir.limit}`,
                cost: 0.01, // Minimal cost
                rows: Math.min(ir.limit, current.rows),
                width: current.width,
                children: [current]
            };
            current = limitNode;
        }
        // Update root with final stats
        root.cost = this.calculateTotalCost(root);
        root.rows = current.rows;
        root.width = current.width;
        return root;
    }
    generateAlternatives(ir) {
        const alternatives = [];
        // Alternative 1: Different join order
        if (ir.joins && ir.joins.length > 1) {
            const alternativeJoinOrders = this.joinOptimizer.generateAlternativeOrders(ir);
            for (const altOrder of alternativeJoinOrders) {
                const altPlan = this.generatePlan(altOrder);
                alternatives.push({
                    description: 'Alternative join order',
                    plan: altPlan,
                    cost: this.calculateTotalCost(altPlan),
                    tradeoffs: ['May use more memory', 'Better for different data distributions']
                });
            }
        }
        // Alternative 2: Hash join vs nested loop
        if (ir.joins && ir.joins.length > 0) {
            const hashJoinIR = this.cloneIR(ir);
            hashJoinIR.joinMethod = 'hash';
            const hashPlan = this.generatePlan(hashJoinIR);
            alternatives.push({
                description: 'Use hash join instead of nested loop',
                plan: hashPlan,
                cost: this.calculateTotalCost(hashPlan),
                tradeoffs: ['Higher memory usage', 'Better for large datasets']
            });
        }
        // Alternative 3: Materialized CTE
        if (this.hasComplexSubqueries(ir)) {
            const cteIR = this.rewriter.convertToCTE(ir);
            const ctePlan = this.generatePlan(cteIR);
            alternatives.push({
                description: 'Use Common Table Expressions (CTEs)',
                plan: ctePlan,
                cost: this.calculateTotalCost(ctePlan),
                tradeoffs: ['More readable', 'May materialize intermediate results']
            });
        }
        return alternatives;
    }
    generateRecommendations(ir, plan) {
        const recommendations = [];
        // Check for missing indexes
        const missingIndexes = this.indexSelector.findMissingIndexes(ir);
        for (const index of missingIndexes) {
            recommendations.push({
                type: RecommendationType.CREATE_INDEX,
                description: `Create index on ${index.table}(${index.columns.join(', ')})`,
                impact: 'Could improve query performance by 50-80%',
                implementation: `CREATE INDEX idx_${index.table}_${index.columns.join('_')} ON ${index.table}(${index.columns.join(', ')})`
            });
        }
        // Check for stale statistics
        if (this.statisticsManager.hasStaleStatistics(ir.from)) {
            recommendations.push({
                type: RecommendationType.UPDATE_STATISTICS,
                description: `Update statistics for table ${ir.from}`,
                impact: 'Better query plan selection',
                implementation: `ANALYZE ${ir.from}`
            });
        }
        // Check for potential partitioning
        const tableRows = this.statisticsManager.getTableRows(ir.from);
        if (tableRows > 1000000 && this.hasTimeBasedFilter(ir)) {
            recommendations.push({
                type: RecommendationType.PARTITION_TABLE,
                description: `Consider partitioning ${ir.from} by date`,
                impact: 'Faster queries on date ranges, easier maintenance',
                implementation: 'Partition by range on date column'
            });
        }
        // Check for materialized view opportunity
        if (this.isComplexAggregation(ir) && this.isFrequentQuery(ir)) {
            recommendations.push({
                type: RecommendationType.MATERIALIZED_VIEW,
                description: 'Create materialized view for this aggregation',
                impact: 'Instant query results for pre-computed aggregations',
                implementation: 'CREATE MATERIALIZED VIEW ... AS [query]'
            });
        }
        return recommendations;
    }
    // Helper methods
    cloneIR(ir) {
        return JSON.parse(JSON.stringify(ir));
    }
    canPushDown(condition, ir) {
        // Check if condition can be pushed down closer to data source
        if (!('table' in condition.lhs))
            return false;
        // Don't push down conditions involving aggregates
        if (this.involvesAggregate(condition))
            return false;
        // Don't push down conditions that depend on join results
        if (this.dependsOnJoin(condition, ir))
            return false;
        return true;
    }
    isRelevantToJoin(condition, join) {
        if (!('table' in condition.lhs))
            return false;
        const tables = [join.left.table, join.right.table];
        return tables.includes(condition.lhs.table);
    }
    hasSubqueries(ir) {
        // Check if IR contains subqueries
        return ir.subqueries && ir.subqueries.length > 0;
    }
    hasComplexSubqueries(ir) {
        // Check for complex subqueries that could benefit from CTE
        return this.hasSubqueries(ir) && ir.subqueries?.some((sq) => sq.type === 'correlated' || sq.depth > 1);
    }
    hasSelectedIndex(ir, table) {
        return ir.selectedIndexes?.has(table);
    }
    estimateSelectivity(conditions) {
        // Estimate what fraction of rows will pass the filter
        let selectivity = 1.0;
        for (const condition of conditions) {
            switch (condition.op) {
                case '=':
                    selectivity *= 0.1; // Equality is selective
                    break;
                case 'like':
                case 'ilike':
                    selectivity *= 0.25; // Pattern matching is less selective
                    break;
                case 'between':
                    selectivity *= 0.2; // Range is moderately selective
                    break;
                case 'in':
                    selectivity *= 0.15; // IN is fairly selective
                    break;
                case '>':
                case '<':
                case '>=':
                case '<=':
                    selectivity *= 0.33; // Inequality is less selective
                    break;
                default:
                    selectivity *= 0.5;
            }
        }
        return Math.max(0.001, selectivity); // Never return 0
    }
    estimateJoinRows(join, leftRows) {
        // Estimate result size after join
        const rightRows = this.statisticsManager.getTableRows(join.right.table);
        switch (join.type) {
            case 'inner':
                // Assume moderate selectivity for inner join
                return Math.floor(leftRows * rightRows * 0.001);
            case 'left':
                // Left join preserves all left rows
                return leftRows;
            default:
                return leftRows * 2; // Conservative estimate
        }
    }
    estimateGroupRows(groupBy, inputRows) {
        // Estimate number of groups
        const distinctValues = groupBy.reduce((product, col) => {
            const cardinality = this.statisticsManager.getColumnCardinality(col.table, col.column);
            return product * Math.min(cardinality, inputRows);
        }, 1);
        return Math.min(distinctValues, inputRows);
    }
    calculateTotalCost(plan) {
        let totalCost = plan.cost;
        if (plan.children) {
            for (const child of plan.children) {
                totalCost += this.calculateTotalCost(child);
            }
        }
        return totalCost;
    }
    involvesAggregate(condition) {
        // Check if condition involves aggregate functions
        return false; // Simplified - would need to check expression tree
    }
    dependsOnJoin(condition, ir) {
        if (!ir.joins || !('table' in condition.lhs))
            return false;
        // Check if condition involves columns from different tables
        if ('table' in condition.rhs) {
            return condition.lhs.table !== condition.rhs.table;
        }
        return false;
    }
    hasTimeBasedFilter(ir) {
        if (!ir.where)
            return false;
        return ir.where.some(condition => {
            if ('table' in condition.lhs) {
                const columnType = this.statisticsManager.getColumnType(condition.lhs.table, condition.lhs.column);
                return columnType === 'date' || columnType === 'timestamp';
            }
            return false;
        });
    }
    isComplexAggregation(ir) {
        return !!(ir.groupBy && ir.groupBy.length > 0);
    }
    isFrequentQuery(ir) {
        // Check query cache or history for frequency
        return this.cache.getFrequency(ir) > 10;
    }
}
class CostModel {
    schema;
    constructor(schema) {
        this.schema = schema;
    }
    estimate(ir) {
        let cost = 0;
        // Base table scan cost
        cost += this.scanCost(ir.from);
        // Filter cost
        if (ir.where) {
            cost += this.filterCost(ir.where);
        }
        // Join costs
        if (ir.joins) {
            for (const join of ir.joins) {
                cost += this.joinCost(join, 1000); // Estimate
            }
        }
        // Aggregation cost
        if (ir.groupBy) {
            cost += this.aggregateCost(ir.groupBy, 1000); // Estimate
        }
        // Sort cost
        if (ir.orderBy) {
            cost += this.sortCost(1000); // Estimate
        }
        return cost;
    }
    scanCost(table) {
        // Cost based on table size
        const rows = 10000; // Would get from statistics
        const pageSize = 8192;
        const rowSize = 100; // Average row size
        const pages = Math.ceil((rows * rowSize) / pageSize);
        return pages * 1.0; // 1.0 cost unit per page
    }
    filterCost(conditions) {
        // CPU cost for evaluating conditions
        return conditions.length * 0.01;
    }
    joinCost(join, leftRows) {
        const rightRows = 10000; // Would get from statistics
        // Nested loop join cost (simplified)
        return leftRows * rightRows * 0.0001;
    }
    aggregateCost(groupBy, rows) {
        // Cost of grouping and aggregation
        return rows * 0.001 * groupBy.length;
    }
    sortCost(rows) {
        // Cost of sorting (n log n)
        return rows * Math.log2(rows) * 0.0001;
    }
}
class QueryRewriter {
    simplify(ir) {
        // Simplify constant expressions and redundant conditions
        const simplified = this.cloneIR(ir);
        if (simplified.where) {
            simplified.where = this.simplifyConditions(simplified.where);
        }
        return simplified;
    }
    unnestSubqueries(ir) {
        // Convert subqueries to joins where possible
        return ir; // Simplified implementation
    }
    convertToCTE(ir) {
        // Convert complex subqueries to CTEs
        return ir; // Simplified implementation
    }
    simplifyConditions(conditions) {
        // Remove redundant conditions, simplify expressions
        const simplified = [];
        const seen = new Set();
        for (const condition of conditions) {
            const key = JSON.stringify(condition);
            if (!seen.has(key)) {
                seen.add(key);
                simplified.push(condition);
            }
        }
        return simplified;
    }
    cloneIR(ir) {
        return JSON.parse(JSON.stringify(ir));
    }
}
class JoinOptimizer {
    costModel;
    constructor(costModel) {
        this.costModel = costModel;
    }
    optimize(ir) {
        if (!ir.joins || ir.joins.length <= 1)
            return ir;
        // Generate all possible join orders
        const orders = this.generateJoinOrders(ir.joins);
        // Find the order with lowest cost
        let bestOrder = ir.joins;
        let bestCost = Infinity;
        for (const order of orders) {
            const testIR = this.cloneIR(ir);
            testIR.joins = order;
            const cost = this.costModel.estimate(testIR);
            if (cost < bestCost) {
                bestCost = cost;
                bestOrder = order;
            }
        }
        const optimized = this.cloneIR(ir);
        optimized.joins = bestOrder;
        return optimized;
    }
    generateAlternativeOrders(ir) {
        if (!ir.joins || ir.joins.length <= 1)
            return [ir];
        const alternatives = [];
        const orders = this.generateJoinOrders(ir.joins).slice(0, 3); // Top 3 alternatives
        for (const order of orders) {
            const alt = this.cloneIR(ir);
            alt.joins = order;
            alternatives.push(alt);
        }
        return alternatives;
    }
    generateJoinOrders(joins) {
        // Generate permutations of join order
        if (joins.length <= 1)
            return [joins];
        const result = [];
        for (let i = 0; i < joins.length; i++) {
            const current = joins[i];
            const remaining = [...joins.slice(0, i), ...joins.slice(i + 1)];
            const subPermutations = this.generateJoinOrders(remaining);
            for (const subPerm of subPermutations) {
                result.push([current, ...subPerm]);
            }
        }
        return result;
    }
    cloneIR(ir) {
        return JSON.parse(JSON.stringify(ir));
    }
}
class IndexSelector {
    schema;
    constructor(schema) {
        this.schema = schema;
    }
    selectForCondition(table, column, operator) {
        // Select best indexes for a condition
        return []; // Simplified - would look up actual indexes
    }
    selectForJoin(table, column) {
        // Select best indexes for join
        return []; // Simplified
    }
    selectForSort(table, column, direction) {
        // Select best indexes for sorting
        return []; // Simplified
    }
    findMissingIndexes(ir) {
        const missing = [];
        // Check for missing indexes on filter conditions
        if (ir.where) {
            for (const condition of ir.where) {
                if ('table' in condition.lhs) {
                    // Check if index exists
                    const hasIndex = false; // Would check actual schema
                    if (!hasIndex) {
                        missing.push({
                            table: condition.lhs.table,
                            columns: [condition.lhs.column]
                        });
                    }
                }
            }
        }
        return missing;
    }
}
class StatisticsManager {
    schema;
    constructor(schema) {
        this.schema = schema;
    }
    getTableRows(table) {
        // Return estimated row count
        return 10000; // Simplified - would use actual statistics
    }
    getRowWidth(table) {
        // Return average row width in bytes
        return 100; // Simplified
    }
    getColumnCardinality(table, column) {
        // Return number of distinct values
        return 100; // Simplified
    }
    getColumnType(table, column) {
        // Return column data type
        return 'varchar'; // Simplified
    }
    hasStaleStatistics(table) {
        // Check if statistics are outdated
        return false; // Simplified
    }
    updateQueryStats(ir, executionTime) {
        // Update query execution statistics
    }
}
class QueryCache {
    cache = new Map();
    frequency = new Map();
    get(ir) {
        const key = this.getKey(ir);
        this.frequency.set(key, (this.frequency.get(key) || 0) + 1);
        return this.cache.get(key) || null;
    }
    set(ir, result) {
        const key = this.getKey(ir);
        this.cache.set(key, result);
        // Limit cache size
        if (this.cache.size > 1000) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
    }
    getFrequency(ir) {
        const key = this.getKey(ir);
        return this.frequency.get(key) || 0;
    }
    getKey(ir) {
        // Generate cache key from IR
        return JSON.stringify({
            from: ir.from,
            columns: ir.columns,
            where: ir.where,
            joins: ir.joins,
            groupBy: ir.groupBy,
            orderBy: ir.orderBy,
            limit: ir.limit
        });
    }
}
//# sourceMappingURL=advanced-optimizer.js.map