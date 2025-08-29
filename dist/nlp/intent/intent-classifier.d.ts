/**
 * Intent Classification System for NL2SQL
 * Determines the type and structure of SQL query from natural language
 */
import { Token } from '../tokenizer/advanced-tokenizer.js';
import { Entity } from '../entity/entity-recognizer.js';
export interface ClassifiedIntent {
    primary: IntentType;
    secondary: IntentType[];
    confidence: number;
    queryType: SQLQueryType;
    components: QueryComponents;
    complexity: ComplexityLevel;
    metadata?: Record<string, unknown>;
}
export declare enum IntentType {
    RETRIEVE = "RETRIEVE",
    FILTER = "FILTER",
    SORT = "SORT",
    LIMIT = "LIMIT",
    COUNT = "COUNT",
    SUM = "SUM",
    AVERAGE = "AVERAGE",
    MIN_MAX = "MIN_MAX",
    GROUP = "GROUP",
    JOIN = "JOIN",
    UNION = "UNION",
    INTERSECT = "INTERSECT",
    EXCEPT = "EXCEPT",
    SUBQUERY = "SUBQUERY",
    CTE = "CTE",
    WINDOW = "WINDOW",
    PIVOT = "PIVOT",
    INSERT = "INSERT",
    UPDATE = "UPDATE",
    DELETE = "DELETE",
    CREATE = "CREATE",
    ALTER = "ALTER",
    DROP = "DROP",
    EXPLAIN = "EXPLAIN",
    ANALYZE = "ANALYZE",
    UNKNOWN = "UNKNOWN"
}
export declare enum SQLQueryType {
    SELECT = "SELECT",
    INSERT = "INSERT",
    UPDATE = "UPDATE",
    DELETE = "DELETE",
    CREATE = "CREATE",
    ALTER = "ALTER",
    DROP = "DROP",
    EXPLAIN = "EXPLAIN",
    UNKNOWN = "UNKNOWN"
}
export declare enum ComplexityLevel {
    SIMPLE = "SIMPLE",// Single table, basic filters
    MODERATE = "MODERATE",// Joins or aggregations
    COMPLEX = "COMPLEX",// Multiple joins, subqueries, CTEs
    ADVANCED = "ADVANCED"
}
export interface QueryComponents {
    tables: string[];
    columns: string[];
    conditions: ConditionInfo[];
    aggregations: AggregationInfo[];
    groupBy: string[];
    orderBy: OrderInfo[];
    joins: JoinInfo[];
    limit?: number;
    offset?: number;
    having?: ConditionInfo[];
    distinct?: boolean;
    subqueries?: SubqueryInfo[];
    ctes?: CTEInfo[];
    windowFunctions?: WindowInfo[];
}
export interface ConditionInfo {
    column: string;
    operator: string;
    value: unknown;
    logical?: 'AND' | 'OR';
    negated?: boolean;
}
export interface AggregationInfo {
    function: string;
    column: string;
    alias?: string;
    distinct?: boolean;
}
export interface OrderInfo {
    column: string;
    direction: 'ASC' | 'DESC';
    nulls?: 'FIRST' | 'LAST';
}
export interface JoinInfo {
    type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'CROSS';
    leftTable: string;
    rightTable: string;
    condition: string;
}
export interface SubqueryInfo {
    type: 'scalar' | 'exists' | 'in' | 'from';
    alias?: string;
    query: QueryComponents;
}
export interface CTEInfo {
    name: string;
    recursive?: boolean;
    query: QueryComponents;
}
export interface WindowInfo {
    function: string;
    partitionBy?: string[];
    orderBy?: OrderInfo[];
    frame?: string;
}
export declare class IntentClassifier {
    private patterns;
    private queryTypeClassifier;
    private complexityAnalyzer;
    constructor();
    classify(tokens: Token[], entities: Entity[]): ClassifiedIntent;
    private initializePatterns;
    private detectIntents;
    private matchPattern;
    private hasMultipleClauses;
    private selectPrimaryIntent;
    private extractComponents;
    private extractConditions;
    private extractAggregations;
    private extractGroupBy;
    private extractOrderBy;
    private extractJoins;
    private extractLimit;
    private findPreviousEntity;
    private findNextEntity;
    private calculateConfidence;
}
