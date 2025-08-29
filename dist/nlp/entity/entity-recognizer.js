/**
 * Advanced Entity Recognition System for NL2SQL
 * Identifies and classifies database entities in natural language queries
 */
import { TokenType } from '../tokenizer/advanced-tokenizer.js';
export var EntityType;
(function (EntityType) {
    EntityType["TABLE"] = "TABLE";
    EntityType["COLUMN"] = "COLUMN";
    EntityType["VALUE"] = "VALUE";
    EntityType["FUNCTION"] = "FUNCTION";
    EntityType["OPERATOR"] = "OPERATOR";
    EntityType["CONDITION"] = "CONDITION";
    EntityType["AGGREGATION"] = "AGGREGATION";
    EntityType["TEMPORAL"] = "TEMPORAL";
    EntityType["NUMERIC"] = "NUMERIC";
    EntityType["TEXT"] = "TEXT";
    EntityType["BOOLEAN"] = "BOOLEAN";
    EntityType["NULL"] = "NULL";
    EntityType["UNKNOWN"] = "UNKNOWN";
})(EntityType || (EntityType = {}));
export class EntityRecognizer {
    schema;
    synonymMap;
    fuzzyMatcher;
    contextualResolver;
    constructor(schema) {
        this.schema = schema;
        this.synonymMap = this.buildSynonymMap();
        this.fuzzyMatcher = new FuzzyMatcher(schema);
        this.contextualResolver = new ContextualResolver(schema);
    }
    recognize(tokens) {
        const entities = [];
        const context = this.buildContext(tokens);
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const entity = this.recognizeEntity(token, tokens, i, context);
            if (entity && entity.confidence > 0.3) {
                entities.push(entity);
            }
        }
        // Post-process to resolve ambiguities
        return this.resolveAmbiguities(entities, context);
    }
    recognizeEntity(token, allTokens, index, context) {
        // Direct match for known entities
        const directMatch = this.directMatch(token);
        if (directMatch)
            return directMatch;
        // Fuzzy match for close matches
        const fuzzyMatch = this.fuzzyMatcher.match(token.normalized);
        if (fuzzyMatch && fuzzyMatch.score > 0.7) {
            return this.createEntity(token, fuzzyMatch);
        }
        // Contextual resolution
        const contextualMatch = this.contextualResolver.resolve(token, allTokens, index, context);
        if (contextualMatch)
            return contextualMatch;
        // Type-based recognition
        return this.recognizeByType(token);
    }
    directMatch(token) {
        // Check tables
        for (const table of this.schema.tables) {
            if (this.matches(token.normalized, table.name)) {
                return {
                    text: token.text,
                    type: EntityType.TABLE,
                    confidence: 1.0,
                    position: token.position,
                    length: token.length,
                    resolvedName: table.name,
                    metadata: { table }
                };
            }
            // Check columns
            for (const column of table.columns) {
                if (this.matches(token.normalized, column.name)) {
                    return {
                        text: token.text,
                        type: EntityType.COLUMN,
                        subtype: column.type,
                        confidence: 0.9,
                        position: token.position,
                        length: token.length,
                        resolvedName: column.name,
                        metadata: { table: table.name, column }
                    };
                }
            }
        }
        // Check functions
        for (const func of this.schema.functions) {
            if (this.matches(token.normalized, func.name)) {
                return {
                    text: token.text,
                    type: EntityType.FUNCTION,
                    subtype: func.type,
                    confidence: 1.0,
                    position: token.position,
                    length: token.length,
                    resolvedName: func.name,
                    metadata: { function: func }
                };
            }
        }
        return null;
    }
    matches(normalized, target) {
        const targetNorm = target.toLowerCase();
        // Direct match
        if (normalized === targetNorm)
            return true;
        // Check synonyms
        const synonym = this.synonymMap.get(normalized);
        if (synonym === targetNorm)
            return true;
        // Check snake_case to space conversion
        const spaced = targetNorm.replace(/_/g, ' ');
        if (normalized === spaced)
            return true;
        // Check camelCase to space conversion
        const camelSpaced = targetNorm.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
        if (normalized === camelSpaced)
            return true;
        return false;
    }
    recognizeByType(token) {
        switch (token.type) {
            case TokenType.STRING_LITERAL:
                return {
                    text: token.text,
                    type: EntityType.TEXT,
                    confidence: 0.9,
                    position: token.position,
                    length: token.length,
                    resolvedName: token.normalized
                };
            case TokenType.NUMBER_LITERAL:
                return {
                    text: token.text,
                    type: EntityType.NUMERIC,
                    confidence: 0.9,
                    position: token.position,
                    length: token.length,
                    resolvedName: token.normalized
                };
            case TokenType.DATE_LITERAL:
            case TokenType.TEMPORAL:
                return {
                    text: token.text,
                    type: EntityType.TEMPORAL,
                    confidence: 0.9,
                    position: token.position,
                    length: token.length,
                    resolvedName: token.normalized,
                    metadata: { parsed: this.parseTemporal(token.normalized) }
                };
            case TokenType.BOOLEAN_LITERAL:
                return {
                    text: token.text,
                    type: EntityType.BOOLEAN,
                    confidence: 1.0,
                    position: token.position,
                    length: token.length,
                    resolvedName: token.normalized === 'true' || token.normalized === 'yes' ? 'true' : 'false'
                };
            case TokenType.NULL_LITERAL:
                return {
                    text: token.text,
                    type: EntityType.NULL,
                    confidence: 1.0,
                    position: token.position,
                    length: token.length,
                    resolvedName: 'NULL'
                };
            case TokenType.AGGREGATION:
                return {
                    text: token.text,
                    type: EntityType.AGGREGATION,
                    confidence: 0.9,
                    position: token.position,
                    length: token.length,
                    resolvedName: this.normalizeAggregation(token.normalized)
                };
            case TokenType.COMPARISON_OP:
            case TokenType.LOGICAL_OP:
                return {
                    text: token.text,
                    type: EntityType.OPERATOR,
                    confidence: 0.9,
                    position: token.position,
                    length: token.length,
                    resolvedName: this.normalizeOperator(token.normalized)
                };
            default:
                return null;
        }
    }
    buildSynonymMap() {
        const map = new Map();
        // Common synonyms
        map.set('customer', 'customer');
        map.set('client', 'customer');
        map.set('buyer', 'customer');
        map.set('purchaser', 'customer');
        map.set('product', 'product');
        map.set('item', 'product');
        map.set('good', 'product');
        map.set('merchandise', 'product');
        map.set('order', 'order');
        map.set('purchase', 'order');
        map.set('transaction', 'order');
        map.set('employee', 'employee');
        map.set('staff', 'employee');
        map.set('worker', 'employee');
        map.set('personnel', 'employee');
        map.set('department', 'department');
        map.set('dept', 'department');
        map.set('division', 'department');
        map.set('unit', 'department');
        // Add schema-specific synonyms
        for (const table of this.schema.tables) {
            if (table.alias) {
                for (const alias of table.alias) {
                    map.set(alias.toLowerCase(), table.name.toLowerCase());
                }
            }
        }
        return map;
    }
    buildContext(tokens) {
        const tables = new Set();
        const columns = new Set();
        const functions = new Set();
        for (const token of tokens) {
            if (token.type === TokenType.TABLE_NAME) {
                tables.add(token.normalized);
            }
            else if (token.type === TokenType.COLUMN_NAME) {
                columns.add(token.normalized);
            }
            else if (token.type === TokenType.FUNCTION_NAME || token.type === TokenType.AGGREGATION) {
                functions.add(token.normalized);
            }
        }
        return {
            tables: Array.from(tables),
            columns: Array.from(columns),
            functions: Array.from(functions),
            hasAggregation: tokens.some(t => t.type === TokenType.AGGREGATION),
            hasGroupBy: tokens.some(t => t.type === TokenType.GROUP_KEYWORD),
            hasJoin: tokens.some(t => t.type === TokenType.JOIN_KEYWORD),
            hasWhere: tokens.some(t => t.type === TokenType.WHERE_KEYWORD)
        };
    }
    resolveAmbiguities(entities, context) {
        const resolved = [];
        for (const entity of entities) {
            if (entity.type === EntityType.COLUMN && !entity.metadata?.table) {
                // Try to resolve which table this column belongs to
                const possibleTables = this.findTablesWithColumn(entity.resolvedName || entity.text);
                if (possibleTables.length === 1) {
                    entity.metadata = { ...entity.metadata, table: possibleTables[0].name };
                    entity.confidence = Math.min(entity.confidence * 1.1, 1.0);
                }
                else if (possibleTables.length > 1) {
                    // Use context to disambiguate
                    const contextTable = context.tables.find(t => possibleTables.some(pt => pt.name.toLowerCase() === t.toLowerCase()));
                    if (contextTable) {
                        entity.metadata = { ...entity.metadata, table: contextTable };
                        entity.confidence = Math.min(entity.confidence * 1.05, 1.0);
                    }
                    else {
                        // Lower confidence for ambiguous columns
                        entity.confidence *= 0.7;
                        entity.metadata = {
                            ...entity.metadata,
                            ambiguous: true,
                            possibleTables: possibleTables.map(t => t.name)
                        };
                    }
                }
            }
            resolved.push(entity);
        }
        return resolved;
    }
    findTablesWithColumn(columnName) {
        const tables = [];
        const normalized = columnName.toLowerCase();
        for (const table of this.schema.tables) {
            for (const column of table.columns) {
                if (this.matches(normalized, column.name)) {
                    tables.push(table);
                    break;
                }
            }
        }
        return tables;
    }
    createEntity(token, match) {
        return {
            text: token.text,
            type: match.type,
            confidence: match.score,
            position: token.position,
            length: token.length,
            resolvedName: match.resolved,
            metadata: match.metadata
        };
    }
    normalizeAggregation(text) {
        const mapping = {
            'sum': 'SUM',
            'total': 'SUM',
            'add up': 'SUM',
            'count': 'COUNT',
            'number of': 'COUNT',
            'how many': 'COUNT',
            'average': 'AVG',
            'avg': 'AVG',
            'mean': 'AVG',
            'maximum': 'MAX',
            'max': 'MAX',
            'highest': 'MAX',
            'minimum': 'MIN',
            'min': 'MIN',
            'lowest': 'MIN'
        };
        return mapping[text.toLowerCase()] || text.toUpperCase();
    }
    normalizeOperator(text) {
        const mapping = {
            'equal to': '=',
            'equals': '=',
            'is': '=',
            'greater than': '>',
            'more than': '>',
            'above': '>',
            'less than': '<',
            'fewer than': '<',
            'below': '<',
            'not equal': '!=',
            'different from': '!=',
            'between': 'BETWEEN',
            'in range': 'BETWEEN',
            'like': 'LIKE',
            'contains': 'LIKE',
            'includes': 'LIKE',
            'and': 'AND',
            'or': 'OR',
            'not': 'NOT'
        };
        return mapping[text.toLowerCase()] || text.toUpperCase();
    }
    parseTemporal(text) {
        const now = new Date();
        const normalized = text.toLowerCase();
        // Handle relative dates
        if (normalized === 'today') {
            return new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }
        else if (normalized === 'yesterday') {
            const date = new Date(now);
            date.setDate(date.getDate() - 1);
            return date;
        }
        else if (normalized === 'tomorrow') {
            const date = new Date(now);
            date.setDate(date.getDate() + 1);
            return date;
        }
        // Try parsing as date string
        const parsed = new Date(text);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
}
class FuzzyMatcher {
    schema;
    constructor(schema) {
        this.schema = schema;
    }
    match(text) {
        let bestMatch = null;
        let bestScore = 0;
        // Match against tables
        for (const table of this.schema.tables) {
            const score = this.calculateSimilarity(text, table.name.toLowerCase());
            if (score > bestScore) {
                bestScore = score;
                bestMatch = {
                    type: 'TABLE',
                    resolved: table.name,
                    score,
                    metadata: { table }
                };
            }
        }
        // Match against columns
        for (const table of this.schema.tables) {
            for (const column of table.columns) {
                const score = this.calculateSimilarity(text, column.name.toLowerCase());
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = {
                        type: 'COLUMN',
                        resolved: column.name,
                        score,
                        metadata: { table: table.name, column }
                    };
                }
            }
        }
        // Match against functions
        for (const func of this.schema.functions) {
            const score = this.calculateSimilarity(text, func.name.toLowerCase());
            if (score > bestScore) {
                bestScore = score;
                bestMatch = {
                    type: 'FUNCTION',
                    resolved: func.name,
                    score,
                    metadata: { function: func }
                };
            }
        }
        return bestMatch;
    }
    calculateSimilarity(str1, str2) {
        // Levenshtein distance-based similarity
        const distance = this.levenshteinDistance(str1, str2);
        const maxLength = Math.max(str1.length, str2.length);
        if (maxLength === 0)
            return 1.0;
        const similarity = 1 - (distance / maxLength);
        // Boost score for prefix matches
        if (str2.startsWith(str1) || str1.startsWith(str2)) {
            return Math.min(similarity * 1.2, 1.0);
        }
        return similarity;
    }
    levenshteinDistance(str1, str2) {
        const m = str1.length;
        const n = str2.length;
        const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
        for (let i = 0; i <= m; i++)
            dp[i][0] = i;
        for (let j = 0; j <= n; j++)
            dp[0][j] = j;
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1];
                }
                else {
                    dp[i][j] = 1 + Math.min(dp[i - 1][j], // deletion
                    dp[i][j - 1], // insertion
                    dp[i - 1][j - 1] // substitution
                    );
                }
            }
        }
        return dp[m][n];
    }
}
class ContextualResolver {
    schema;
    constructor(schema) {
        this.schema = schema;
    }
    resolve(token, allTokens, index, context) {
        // Look for patterns in surrounding tokens
        const prev = index > 0 ? allTokens[index - 1] : null;
        const next = index < allTokens.length - 1 ? allTokens[index + 1] : null;
        // Pattern: "from <table>"
        if (prev && prev.type === TokenType.FROM_KEYWORD && token.type === TokenType.NOUN) {
            const table = this.findBestTableMatch(token.normalized, context);
            if (table) {
                return {
                    text: token.text,
                    type: EntityType.TABLE,
                    confidence: 0.8,
                    position: token.position,
                    length: token.length,
                    resolvedName: table.name,
                    metadata: { table, pattern: 'from_clause' }
                };
            }
        }
        // Pattern: "select <column>"
        if (prev && prev.type === TokenType.SELECT_KEYWORD && token.type === TokenType.NOUN) {
            const column = this.findBestColumnMatch(token.normalized, context);
            if (column) {
                return {
                    text: token.text,
                    type: EntityType.COLUMN,
                    confidence: 0.7,
                    position: token.position,
                    length: token.length,
                    resolvedName: column.name,
                    metadata: { column, pattern: 'select_clause' }
                };
            }
        }
        // Pattern: "<column> = <value>"
        if (next && next.type === TokenType.COMPARISON_OP) {
            const column = this.findBestColumnMatch(token.normalized, context);
            if (column) {
                return {
                    text: token.text,
                    type: EntityType.COLUMN,
                    confidence: 0.75,
                    position: token.position,
                    length: token.length,
                    resolvedName: column.name,
                    metadata: { column, pattern: 'comparison_left' }
                };
            }
        }
        return null;
    }
    findBestTableMatch(text, context) {
        // First check context tables
        for (const contextTable of context.tables) {
            const table = this.schema.tables.find(t => t.name.toLowerCase() === contextTable.toLowerCase());
            if (table)
                return table;
        }
        // Then check all tables
        for (const table of this.schema.tables) {
            if (table.name.toLowerCase().includes(text) ||
                text.includes(table.name.toLowerCase())) {
                return table;
            }
        }
        return null;
    }
    findBestColumnMatch(text, context) {
        // Look through all tables for matching columns
        for (const table of this.schema.tables) {
            for (const column of table.columns) {
                if (column.name.toLowerCase() === text ||
                    column.name.toLowerCase().includes(text) ||
                    text.includes(column.name.toLowerCase())) {
                    return column;
                }
            }
        }
        return null;
    }
}
//# sourceMappingURL=entity-recognizer.js.map