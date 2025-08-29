/**
 * Advanced Query Optimization Engine for NL2SQL
 * Implements cost-based optimization, query rewriting, and performance analysis
 */
import { IntermediateRepresentation } from '../ir/types.js';
export interface OptimizationResult {
    optimizedIR: IntermediateRepresentation;
    plan: QueryPlan;
    estimatedCost: number;
    optimizations: AppliedOptimization[];
    alternatives: AlternativePlan[];
    recommendations: Recommendation[];
}
export interface QueryPlan {
    type: PlanNodeType;
    operation: string;
    cost: number;
    rows: number;
    width: number;
    children?: QueryPlan[];
    details?: Record<string, unknown>;
}
export declare enum PlanNodeType {
    SCAN = "SCAN",
    INDEX_SCAN = "INDEX_SCAN",
    BITMAP_SCAN = "BITMAP_SCAN",
    JOIN = "JOIN",
    SORT = "SORT",
    AGGREGATE = "AGGREGATE",
    FILTER = "FILTER",
    LIMIT = "LIMIT",
    MATERIALIZE = "MATERIALIZE",
    SUBQUERY = "SUBQUERY",
    CTE = "CTE"
}
export interface AppliedOptimization {
    type: OptimizationType;
    description: string;
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
    costReduction: number;
}
export declare enum OptimizationType {
    PREDICATE_PUSHDOWN = "PREDICATE_PUSHDOWN",
    JOIN_REORDERING = "JOIN_REORDERING",
    INDEX_SELECTION = "INDEX_SELECTION",
    SUBQUERY_UNNESTING = "SUBQUERY_UNNESTING",
    COMMON_SUBEXPRESSION = "COMMON_SUBEXPRESSION",
    PARTITION_PRUNING = "PARTITION_PRUNING",
    MATERIALIZED_VIEW = "MATERIALIZED_VIEW",
    QUERY_REWRITE = "QUERY_REWRITE",
    COLUMN_PRUNING = "COLUMN_PRUNING",
    CONSTANT_FOLDING = "CONSTANT_FOLDING"
}
export interface AlternativePlan {
    description: string;
    plan: QueryPlan;
    cost: number;
    tradeoffs: string[];
}
export interface Recommendation {
    type: RecommendationType;
    description: string;
    impact: string;
    implementation?: string;
}
export declare enum RecommendationType {
    CREATE_INDEX = "CREATE_INDEX",
    UPDATE_STATISTICS = "UPDATE_STATISTICS",
    PARTITION_TABLE = "PARTITION_TABLE",
    DENORMALIZE = "DENORMALIZE",
    MATERIALIZED_VIEW = "MATERIALIZED_VIEW",
    QUERY_REWRITE = "QUERY_REWRITE"
}
export declare class AdvancedQueryOptimizer {
    private schema;
    private costModel;
    private rewriter;
    private joinOptimizer;
    private indexSelector;
    private statisticsManager;
    private cache;
    constructor(schema: any);
    optimize(ir: IntermediateRepresentation): OptimizationResult;
    private pushPredicates;
    private pruneColumns;
    private selectIndexes;
    private generatePlan;
    private generateAlternatives;
    private generateRecommendations;
    private cloneIR;
    private canPushDown;
    private isRelevantToJoin;
    private hasSubqueries;
    private hasComplexSubqueries;
    private hasSelectedIndex;
    private estimateSelectivity;
    private estimateJoinRows;
    private estimateGroupRows;
    private calculateTotalCost;
    private involvesAggregate;
    private dependsOnJoin;
    private hasTimeBasedFilter;
    private isComplexAggregation;
    private isFrequentQuery;
}
