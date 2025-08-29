/**
 * Intent Classification System for NL2SQL
 * Determines the type and structure of SQL query from natural language
 */
import { TokenType } from '../tokenizer/advanced-tokenizer.js';
import { EntityType } from '../entity/entity-recognizer.js';
export var IntentType;
(function (IntentType) {
    // Basic operations
    IntentType["RETRIEVE"] = "RETRIEVE";
    IntentType["FILTER"] = "FILTER";
    IntentType["SORT"] = "SORT";
    IntentType["LIMIT"] = "LIMIT";
    // Aggregations
    IntentType["COUNT"] = "COUNT";
    IntentType["SUM"] = "SUM";
    IntentType["AVERAGE"] = "AVERAGE";
    IntentType["MIN_MAX"] = "MIN_MAX";
    IntentType["GROUP"] = "GROUP";
    // Joins and relationships
    IntentType["JOIN"] = "JOIN";
    IntentType["UNION"] = "UNION";
    IntentType["INTERSECT"] = "INTERSECT";
    IntentType["EXCEPT"] = "EXCEPT";
    // Advanced
    IntentType["SUBQUERY"] = "SUBQUERY";
    IntentType["CTE"] = "CTE";
    IntentType["WINDOW"] = "WINDOW";
    IntentType["PIVOT"] = "PIVOT";
    // Modifications
    IntentType["INSERT"] = "INSERT";
    IntentType["UPDATE"] = "UPDATE";
    IntentType["DELETE"] = "DELETE";
    // Schema operations
    IntentType["CREATE"] = "CREATE";
    IntentType["ALTER"] = "ALTER";
    IntentType["DROP"] = "DROP";
    // Analysis
    IntentType["EXPLAIN"] = "EXPLAIN";
    IntentType["ANALYZE"] = "ANALYZE";
    IntentType["UNKNOWN"] = "UNKNOWN";
})(IntentType || (IntentType = {}));
export var SQLQueryType;
(function (SQLQueryType) {
    SQLQueryType["SELECT"] = "SELECT";
    SQLQueryType["INSERT"] = "INSERT";
    SQLQueryType["UPDATE"] = "UPDATE";
    SQLQueryType["DELETE"] = "DELETE";
    SQLQueryType["CREATE"] = "CREATE";
    SQLQueryType["ALTER"] = "ALTER";
    SQLQueryType["DROP"] = "DROP";
    SQLQueryType["EXPLAIN"] = "EXPLAIN";
    SQLQueryType["UNKNOWN"] = "UNKNOWN";
})(SQLQueryType || (SQLQueryType = {}));
export var ComplexityLevel;
(function (ComplexityLevel) {
    ComplexityLevel["SIMPLE"] = "SIMPLE";
    ComplexityLevel["MODERATE"] = "MODERATE";
    ComplexityLevel["COMPLEX"] = "COMPLEX";
    ComplexityLevel["ADVANCED"] = "ADVANCED"; // Window functions, recursive CTEs, complex analytics
})(ComplexityLevel || (ComplexityLevel = {}));
export class IntentClassifier {
    patterns;
    queryTypeClassifier;
    complexityAnalyzer;
    constructor() {
        this.patterns = this.initializePatterns();
        this.queryTypeClassifier = new QueryTypeClassifier();
        this.complexityAnalyzer = new ComplexityAnalyzer();
    }
    classify(tokens, entities) {
        // Determine primary intent
        const intents = this.detectIntents(tokens, entities);
        const primary = this.selectPrimaryIntent(intents);
        const secondary = intents.filter(i => i.type !== primary.type).map(i => i.type);
        // Determine query type
        const queryType = this.queryTypeClassifier.classify(tokens, primary.type);
        // Extract query components
        const components = this.extractComponents(tokens, entities, intents);
        // Analyze complexity
        const complexity = this.complexityAnalyzer.analyze(components, intents);
        // Calculate overall confidence
        const confidence = this.calculateConfidence(intents, entities);
        return {
            primary: primary.type,
            secondary,
            confidence,
            queryType,
            components,
            complexity,
            metadata: {
                intents,
                tokenCount: tokens.length,
                entityCount: entities.length
            }
        };
    }
    initializePatterns() {
        const patterns = new Map();
        // Retrieve patterns
        patterns.set(IntentType.RETRIEVE, [
            { tokens: [TokenType.SELECT_KEYWORD], weight: 1.0 },
            { tokens: [TokenType.QUESTION], keywords: ['what', 'which', 'show', 'display'], weight: 0.8 },
            { keywords: ['get', 'fetch', 'retrieve', 'find', 'list'], weight: 0.7 }
        ]);
        // Filter patterns
        patterns.set(IntentType.FILTER, [
            { tokens: [TokenType.WHERE_KEYWORD], weight: 1.0 },
            { tokens: [TokenType.COMPARISON_OP], weight: 0.8 },
            { keywords: ['where', 'filter', 'only', 'with', 'having'], weight: 0.7 }
        ]);
        // Count patterns
        patterns.set(IntentType.COUNT, [
            { tokens: [TokenType.AGGREGATION], keywords: ['count', 'number', 'how many'], weight: 1.0 },
            { keywords: ['total', 'quantity'], weight: 0.7 }
        ]);
        // Sum patterns
        patterns.set(IntentType.SUM, [
            { tokens: [TokenType.AGGREGATION], keywords: ['sum', 'total', 'add'], weight: 1.0 },
            { keywords: ['aggregate', 'accumulate'], weight: 0.6 }
        ]);
        // Average patterns
        patterns.set(IntentType.AVERAGE, [
            { tokens: [TokenType.AGGREGATION], keywords: ['average', 'avg', 'mean'], weight: 1.0 },
            { keywords: ['typical', 'median'], weight: 0.6 }
        ]);
        // Min/Max patterns
        patterns.set(IntentType.MIN_MAX, [
            { tokens: [TokenType.AGGREGATION], keywords: ['maximum', 'max', 'highest', 'greatest'], weight: 1.0 },
            { tokens: [TokenType.AGGREGATION], keywords: ['minimum', 'min', 'lowest', 'smallest'], weight: 1.0 },
            { keywords: ['peak', 'top', 'bottom'], weight: 0.6 }
        ]);
        // Group patterns
        patterns.set(IntentType.GROUP, [
            { tokens: [TokenType.GROUP_KEYWORD], weight: 1.0 },
            { keywords: ['group', 'grouped', 'by', 'per', 'each'], weight: 0.8 },
            { keywords: ['breakdown', 'categorize', 'segment'], weight: 0.6 }
        ]);
        // Join patterns
        patterns.set(IntentType.JOIN, [
            { tokens: [TokenType.JOIN_KEYWORD], weight: 1.0 },
            { keywords: ['join', 'combine', 'merge', 'link', 'connect'], weight: 0.8 },
            { keywords: ['with', 'and', 'together', 'relationship'], weight: 0.5 }
        ]);
        // Sort patterns
        patterns.set(IntentType.SORT, [
            { tokens: [TokenType.ORDER_KEYWORD], weight: 1.0 },
            { keywords: ['order', 'sort', 'arrange', 'rank'], weight: 0.8 },
            { keywords: ['ascending', 'descending', 'alphabetical', 'chronological'], weight: 0.7 }
        ]);
        // Limit patterns
        patterns.set(IntentType.LIMIT, [
            { tokens: [TokenType.QUANTIFIER], keywords: ['top', 'first', 'last'], weight: 0.9 },
            { keywords: ['limit', 'only', 'maximum', 'up to'], weight: 0.8 }
        ]);
        // Subquery patterns
        patterns.set(IntentType.SUBQUERY, [
            { keywords: ['where', 'exists', 'in', 'any', 'all'], multiClause: true, weight: 0.7 },
            { keywords: ['nested', 'subquery', 'inner query'], weight: 0.9 }
        ]);
        // CTE patterns
        patterns.set(IntentType.CTE, [
            { keywords: ['with', 'recursive', 'common table'], weight: 0.9 },
            { keywords: ['hierarchical', 'tree', 'recursive'], weight: 0.7 }
        ]);
        // Window function patterns
        patterns.set(IntentType.WINDOW, [
            { keywords: ['rank', 'row_number', 'dense_rank', 'lead', 'lag'], weight: 1.0 },
            { keywords: ['over', 'partition by', 'window'], weight: 0.9 },
            { keywords: ['running total', 'cumulative', 'moving average'], weight: 0.8 }
        ]);
        return patterns;
    }
    detectIntents(tokens, entities) {
        const intents = [];
        for (const [intentType, patterns] of this.patterns.entries()) {
            for (const pattern of patterns) {
                const score = this.matchPattern(pattern, tokens, entities);
                if (score > 0) {
                    intents.push({
                        type: intentType,
                        score: score * pattern.weight,
                        pattern
                    });
                }
            }
        }
        // Sort by score
        intents.sort((a, b) => b.score - a.score);
        return intents;
    }
    matchPattern(pattern, tokens, entities) {
        let score = 0;
        let matches = 0;
        let total = 0;
        // Check token types
        if (pattern.tokens) {
            total += pattern.tokens.length;
            for (const tokenType of pattern.tokens) {
                if (tokens.some(t => t.type === tokenType)) {
                    matches++;
                }
            }
        }
        // Check keywords
        if (pattern.keywords) {
            total += pattern.keywords.length;
            const tokenTexts = tokens.map(t => t.normalized);
            for (const keyword of pattern.keywords) {
                if (tokenTexts.some(text => text.includes(keyword.toLowerCase()))) {
                    matches++;
                }
            }
        }
        // Check for multi-clause queries (indicates complexity)
        if (pattern.multiClause) {
            const hasMultipleClauses = this.hasMultipleClauses(tokens);
            if (hasMultipleClauses) {
                matches++;
                total++;
            }
        }
        if (total > 0) {
            score = matches / total;
        }
        return score;
    }
    hasMultipleClauses(tokens) {
        const clauseKeywords = [
            TokenType.SELECT_KEYWORD,
            TokenType.FROM_KEYWORD,
            TokenType.WHERE_KEYWORD,
            TokenType.GROUP_KEYWORD,
            TokenType.HAVING_KEYWORD,
            TokenType.ORDER_KEYWORD
        ];
        const foundClauses = new Set();
        for (const token of tokens) {
            if (clauseKeywords.includes(token.type)) {
                foundClauses.add(token.type);
            }
        }
        return foundClauses.size >= 3;
    }
    selectPrimaryIntent(intents) {
        if (intents.length === 0) {
            return { type: IntentType.UNKNOWN, score: 0, pattern: {} };
        }
        // The highest scoring intent is usually the primary one
        // But we need to handle special cases
        const topIntent = intents[0];
        // If we have both COUNT and GROUP, GROUP is primary
        if (intents.some(i => i.type === IntentType.GROUP) &&
            intents.some(i => i.type === IntentType.COUNT)) {
            const groupIntent = intents.find(i => i.type === IntentType.GROUP);
            return groupIntent;
        }
        // If we have JOIN, it's often primary unless there's a strong aggregation
        if (intents.some(i => i.type === IntentType.JOIN)) {
            const joinIntent = intents.find(i => i.type === IntentType.JOIN);
            const hasStrongAggregation = intents.some(i => [IntentType.COUNT, IntentType.SUM, IntentType.AVERAGE].includes(i.type) && i.score > 0.8);
            if (!hasStrongAggregation) {
                return joinIntent;
            }
        }
        return topIntent;
    }
    extractComponents(tokens, entities, intents) {
        const components = {
            tables: [],
            columns: [],
            conditions: [],
            aggregations: [],
            groupBy: [],
            orderBy: [],
            joins: []
        };
        // Extract tables
        components.tables = entities
            .filter(e => e.type === EntityType.TABLE)
            .map(e => e.resolvedName || e.text);
        // Extract columns
        components.columns = entities
            .filter(e => e.type === EntityType.COLUMN)
            .map(e => e.resolvedName || e.text);
        // Extract conditions
        components.conditions = this.extractConditions(tokens, entities);
        // Extract aggregations
        components.aggregations = this.extractAggregations(tokens, entities);
        // Extract groupBy
        components.groupBy = this.extractGroupBy(tokens, entities);
        // Extract orderBy
        components.orderBy = this.extractOrderBy(tokens, entities);
        // Extract joins
        components.joins = this.extractJoins(tokens, entities);
        // Extract limit
        const limitInfo = this.extractLimit(tokens);
        if (limitInfo) {
            components.limit = limitInfo.limit;
            components.offset = limitInfo.offset;
        }
        // Check for DISTINCT
        components.distinct = tokens.some(t => t.normalized === 'distinct' || t.normalized === 'unique');
        return components;
    }
    extractConditions(tokens, entities) {
        const conditions = [];
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (token.type === TokenType.COMPARISON_OP || token.type === TokenType.LOGICAL_OP) {
                const prevEntity = this.findPreviousEntity(entities, token.position);
                const nextEntity = this.findNextEntity(entities, token.position);
                if (prevEntity && prevEntity.type === EntityType.COLUMN) {
                    const condition = {
                        column: prevEntity.resolvedName || prevEntity.text,
                        operator: token.normalized,
                        value: nextEntity ? (nextEntity.resolvedName || nextEntity.text) : null
                    };
                    // Check for logical operator
                    const prevToken = i > 0 ? tokens[i - 1] : null;
                    if (prevToken && prevToken.type === TokenType.LOGICAL_OP) {
                        condition.logical = prevToken.normalized.toUpperCase();
                    }
                    // Check for negation
                    if (prevToken && prevToken.type === TokenType.NEGATION) {
                        condition.negated = true;
                    }
                    conditions.push(condition);
                }
            }
        }
        return conditions;
    }
    extractAggregations(tokens, entities) {
        const aggregations = [];
        for (const entity of entities) {
            if (entity.type === EntityType.AGGREGATION) {
                const nextColumn = this.findNextEntity(entities, entity.position + entity.length);
                aggregations.push({
                    function: entity.resolvedName || entity.text,
                    column: nextColumn && nextColumn.type === EntityType.COLUMN
                        ? (nextColumn.resolvedName || nextColumn.text)
                        : '*'
                });
            }
        }
        return aggregations;
    }
    extractGroupBy(tokens, entities) {
        const groupBy = [];
        let inGroupClause = false;
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (token.type === TokenType.GROUP_KEYWORD) {
                inGroupClause = true;
                continue;
            }
            if (inGroupClause) {
                const entity = entities.find(e => e.position === token.position && e.type === EntityType.COLUMN);
                if (entity) {
                    groupBy.push(entity.resolvedName || entity.text);
                }
                // Stop at next clause keyword
                if ([TokenType.ORDER_KEYWORD, TokenType.HAVING_KEYWORD, TokenType.WHERE_KEYWORD].includes(token.type)) {
                    inGroupClause = false;
                }
            }
        }
        return groupBy;
    }
    extractOrderBy(tokens, entities) {
        const orderBy = [];
        let inOrderClause = false;
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (token.type === TokenType.ORDER_KEYWORD) {
                inOrderClause = true;
                continue;
            }
            if (inOrderClause) {
                const entity = entities.find(e => e.position === token.position && e.type === EntityType.COLUMN);
                if (entity) {
                    const nextToken = i < tokens.length - 1 ? tokens[i + 1] : null;
                    let direction = 'ASC';
                    if (nextToken && ['asc', 'ascending'].includes(nextToken.normalized)) {
                        direction = 'ASC';
                    }
                    else if (nextToken && ['desc', 'descending'].includes(nextToken.normalized)) {
                        direction = 'DESC';
                    }
                    orderBy.push({
                        column: entity.resolvedName || entity.text,
                        direction
                    });
                }
                // Stop at next clause keyword
                if ([TokenType.GROUP_KEYWORD, TokenType.HAVING_KEYWORD, TokenType.WHERE_KEYWORD].includes(token.type)) {
                    inOrderClause = false;
                }
            }
        }
        return orderBy;
    }
    extractJoins(tokens, entities) {
        const joins = [];
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (token.type === TokenType.JOIN_KEYWORD) {
                // Look for join type (LEFT, RIGHT, INNER, etc.)
                const prevToken = i > 0 ? tokens[i - 1] : null;
                let joinType = 'INNER';
                if (prevToken) {
                    const typeMap = {
                        'left': 'LEFT',
                        'right': 'RIGHT',
                        'full': 'FULL',
                        'cross': 'CROSS',
                        'inner': 'INNER'
                    };
                    if (typeMap[prevToken.normalized]) {
                        joinType = typeMap[prevToken.normalized];
                    }
                }
                // Find tables involved
                const tables = entities.filter(e => e.type === EntityType.TABLE);
                if (tables.length >= 2) {
                    joins.push({
                        type: joinType,
                        leftTable: tables[0].resolvedName || tables[0].text,
                        rightTable: tables[1].resolvedName || tables[1].text,
                        condition: 'ON /* TODO: extract join condition */'
                    });
                }
            }
        }
        return joins;
    }
    extractLimit(tokens) {
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            // Look for "top N" or "first N" patterns
            if (['top', 'first', 'limit'].includes(token.normalized)) {
                const nextToken = i < tokens.length - 1 ? tokens[i + 1] : null;
                if (nextToken && nextToken.type === TokenType.NUMBER_LITERAL) {
                    return { limit: parseInt(nextToken.normalized) };
                }
            }
            // Look for "last N" pattern (needs special handling)
            if (token.normalized === 'last') {
                const nextToken = i < tokens.length - 1 ? tokens[i + 1] : null;
                if (nextToken && nextToken.type === TokenType.NUMBER_LITERAL) {
                    // This would need ORDER BY DESC and LIMIT
                    return { limit: parseInt(nextToken.normalized) };
                }
            }
        }
        return null;
    }
    findPreviousEntity(entities, position) {
        let closest = null;
        let closestDistance = Infinity;
        for (const entity of entities) {
            if (entity.position < position) {
                const distance = position - (entity.position + entity.length);
                if (distance < closestDistance) {
                    closest = entity;
                    closestDistance = distance;
                }
            }
        }
        return closest;
    }
    findNextEntity(entities, position) {
        let closest = null;
        let closestDistance = Infinity;
        for (const entity of entities) {
            if (entity.position > position) {
                const distance = entity.position - position;
                if (distance < closestDistance) {
                    closest = entity;
                    closestDistance = distance;
                }
            }
        }
        return closest;
    }
    calculateConfidence(intents, entities) {
        if (intents.length === 0)
            return 0;
        // Base confidence from intent scores
        const intentConfidence = intents[0].score;
        // Entity confidence
        const entityConfidence = entities.length > 0
            ? entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length
            : 0.5;
        // Weighted average
        return intentConfidence * 0.6 + entityConfidence * 0.4;
    }
}
class QueryTypeClassifier {
    classify(tokens, primaryIntent) {
        // Check for explicit query type keywords
        const hasInsert = tokens.some(t => ['insert', 'add', 'create'].includes(t.normalized));
        const hasUpdate = tokens.some(t => ['update', 'modify', 'change', 'set'].includes(t.normalized));
        const hasDelete = tokens.some(t => ['delete', 'remove', 'drop'].includes(t.normalized));
        const hasCreate = tokens.some(t => ['create', 'make', 'build'].includes(t.normalized) &&
            tokens.some(t2 => ['table', 'database', 'schema'].includes(t2.normalized)));
        if (hasInsert)
            return SQLQueryType.INSERT;
        if (hasUpdate)
            return SQLQueryType.UPDATE;
        if (hasDelete)
            return SQLQueryType.DELETE;
        if (hasCreate)
            return SQLQueryType.CREATE;
        // Default to SELECT for retrieval operations
        return SQLQueryType.SELECT;
    }
}
class ComplexityAnalyzer {
    analyze(components, intents) {
        let score = 0;
        // Table count
        if (components.tables.length === 1)
            score += 1;
        else if (components.tables.length === 2)
            score += 2;
        else if (components.tables.length > 2)
            score += 3;
        // Join complexity
        if (components.joins.length === 1)
            score += 2;
        else if (components.joins.length > 1)
            score += 4;
        // Aggregation complexity
        if (components.aggregations.length > 0)
            score += 2;
        if (components.groupBy.length > 0)
            score += 2;
        // Subquery complexity
        if (components.subqueries && components.subqueries.length > 0)
            score += 4;
        // CTE complexity
        if (components.ctes && components.ctes.length > 0)
            score += 5;
        // Window function complexity
        if (components.windowFunctions && components.windowFunctions.length > 0)
            score += 5;
        // Condition complexity
        if (components.conditions.length > 3)
            score += 2;
        if (components.having && components.having.length > 0)
            score += 2;
        // Determine complexity level
        if (score <= 3)
            return ComplexityLevel.SIMPLE;
        if (score <= 7)
            return ComplexityLevel.MODERATE;
        if (score <= 12)
            return ComplexityLevel.COMPLEX;
        return ComplexityLevel.ADVANCED;
    }
}
//# sourceMappingURL=intent-classifier.js.map