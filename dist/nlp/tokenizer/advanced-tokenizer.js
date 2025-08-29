/**
 * Advanced tokenizer with linguistic analysis for NL2SQL
 * Provides comprehensive tokenization with POS tagging, lemmatization, and entity recognition
 */
export var TokenType;
(function (TokenType) {
    // SQL Keywords
    TokenType["SELECT_KEYWORD"] = "SELECT_KEYWORD";
    TokenType["FROM_KEYWORD"] = "FROM_KEYWORD";
    TokenType["WHERE_KEYWORD"] = "WHERE_KEYWORD";
    TokenType["JOIN_KEYWORD"] = "JOIN_KEYWORD";
    TokenType["GROUP_KEYWORD"] = "GROUP_KEYWORD";
    TokenType["ORDER_KEYWORD"] = "ORDER_KEYWORD";
    TokenType["HAVING_KEYWORD"] = "HAVING_KEYWORD";
    // Operators
    TokenType["COMPARISON_OP"] = "COMPARISON_OP";
    TokenType["LOGICAL_OP"] = "LOGICAL_OP";
    TokenType["ARITHMETIC_OP"] = "ARITHMETIC_OP";
    // Entities
    TokenType["TABLE_NAME"] = "TABLE_NAME";
    TokenType["COLUMN_NAME"] = "COLUMN_NAME";
    TokenType["FUNCTION_NAME"] = "FUNCTION_NAME";
    TokenType["ALIAS"] = "ALIAS";
    // Values
    TokenType["STRING_LITERAL"] = "STRING_LITERAL";
    TokenType["NUMBER_LITERAL"] = "NUMBER_LITERAL";
    TokenType["DATE_LITERAL"] = "DATE_LITERAL";
    TokenType["BOOLEAN_LITERAL"] = "BOOLEAN_LITERAL";
    TokenType["NULL_LITERAL"] = "NULL_LITERAL";
    // Natural Language
    TokenType["NOUN"] = "NOUN";
    TokenType["VERB"] = "VERB";
    TokenType["ADJECTIVE"] = "ADJECTIVE";
    TokenType["ADVERB"] = "ADVERB";
    TokenType["PREPOSITION"] = "PREPOSITION";
    TokenType["DETERMINER"] = "DETERMINER";
    TokenType["PRONOUN"] = "PRONOUN";
    TokenType["CONJUNCTION"] = "CONJUNCTION";
    // Special
    TokenType["AGGREGATION"] = "AGGREGATION";
    TokenType["TEMPORAL"] = "TEMPORAL";
    TokenType["QUANTIFIER"] = "QUANTIFIER";
    TokenType["NEGATION"] = "NEGATION";
    TokenType["QUESTION"] = "QUESTION";
    TokenType["PUNCTUATION"] = "PUNCTUATION";
    TokenType["UNKNOWN"] = "UNKNOWN";
})(TokenType || (TokenType = {}));
export class AdvancedTokenizer {
    patterns = [
        // SQL Keywords (highest priority)
        { pattern: /\b(select|get|fetch|retrieve|show|display|find)\b/i, type: TokenType.SELECT_KEYWORD, priority: 100 },
        { pattern: /\b(from|in|within)\b/i, type: TokenType.FROM_KEYWORD, priority: 100 },
        { pattern: /\b(where|when|filter|having)\b/i, type: TokenType.WHERE_KEYWORD, priority: 100 },
        { pattern: /\b(join|combine|merge|connect)\b/i, type: TokenType.JOIN_KEYWORD, priority: 100 },
        { pattern: /\b(group by|grouped by|group)\b/i, type: TokenType.GROUP_KEYWORD, priority: 100 },
        { pattern: /\b(order by|sort by|sorted by|order|sort)\b/i, type: TokenType.ORDER_KEYWORD, priority: 100 },
        // Aggregations
        { pattern: /\b(sum|total|add up|summation)\b/i, type: TokenType.AGGREGATION, priority: 95 },
        { pattern: /\b(count|number of|how many|quantity)\b/i, type: TokenType.AGGREGATION, priority: 95 },
        { pattern: /\b(average|avg|mean)\b/i, type: TokenType.AGGREGATION, priority: 95 },
        { pattern: /\b(maximum|max|highest|greatest)\b/i, type: TokenType.AGGREGATION, priority: 95 },
        { pattern: /\b(minimum|min|lowest|smallest)\b/i, type: TokenType.AGGREGATION, priority: 95 },
        // Comparison Operators
        { pattern: /\b(equal to|equals|is|=)\b/i, type: TokenType.COMPARISON_OP, priority: 90 },
        { pattern: /\b(greater than|more than|>|above)\b/i, type: TokenType.COMPARISON_OP, priority: 90 },
        { pattern: /\b(less than|fewer than|<|below)\b/i, type: TokenType.COMPARISON_OP, priority: 90 },
        { pattern: /\b(between|in range|within range)\b/i, type: TokenType.COMPARISON_OP, priority: 90 },
        { pattern: /\b(like|contains|includes|matching)\b/i, type: TokenType.COMPARISON_OP, priority: 90 },
        { pattern: /\b(not equal|!=|<>|different from)\b/i, type: TokenType.COMPARISON_OP, priority: 90 },
        // Logical Operators
        { pattern: /\b(and|both|as well as|&&)\b/i, type: TokenType.LOGICAL_OP, priority: 85 },
        { pattern: /\b(or|either|any of|\|\|)\b/i, type: TokenType.LOGICAL_OP, priority: 85 },
        { pattern: /\b(not|no|none|!)\b/i, type: TokenType.NEGATION, priority: 85 },
        // Temporal
        { pattern: /\b(today|yesterday|tomorrow)\b/i, type: TokenType.TEMPORAL, priority: 80 },
        { pattern: /\b(this week|last week|next week)\b/i, type: TokenType.TEMPORAL, priority: 80 },
        { pattern: /\b(this month|last month|next month)\b/i, type: TokenType.TEMPORAL, priority: 80 },
        { pattern: /\b(this year|last year|next year)\b/i, type: TokenType.TEMPORAL, priority: 80 },
        { pattern: /\b\d{4}-\d{2}-\d{2}\b/, type: TokenType.DATE_LITERAL, priority: 80 },
        // Quantifiers
        { pattern: /\b(all|every|each)\b/i, type: TokenType.QUANTIFIER, priority: 75 },
        { pattern: /\b(some|any|few)\b/i, type: TokenType.QUANTIFIER, priority: 75 },
        { pattern: /\b(top|first|last)\s+\d+/i, type: TokenType.QUANTIFIER, priority: 75 },
        // Values
        { pattern: /'[^']*'|"[^"]*"/, type: TokenType.STRING_LITERAL, priority: 70 },
        { pattern: /\b\d+\.?\d*\b/, type: TokenType.NUMBER_LITERAL, priority: 70 },
        { pattern: /\b(true|false|yes|no)\b/i, type: TokenType.BOOLEAN_LITERAL, priority: 70 },
        { pattern: /\b(null|nil|none|empty)\b/i, type: TokenType.NULL_LITERAL, priority: 70 },
        // Question words
        { pattern: /\b(what|which|who|where|when|why|how)\b/i, type: TokenType.QUESTION, priority: 65 },
    ];
    entityDictionary = new Map();
    abbreviations = new Map([
        ['avg', 'average'],
        ['max', 'maximum'],
        ['min', 'minimum'],
        ['qty', 'quantity'],
        ['amt', 'amount'],
        ['dept', 'department'],
        ['emp', 'employee'],
        ['cust', 'customer'],
        ['prod', 'product'],
        ['trans', 'transaction'],
    ]);
    constructor(schema) {
        if (schema) {
            this.initializeEntityDictionary(schema);
        }
    }
    initializeEntityDictionary(schema) {
        // Add table names
        for (const table of schema.tables) {
            this.entityDictionary.set(table.toLowerCase(), TokenType.TABLE_NAME);
            // Add plural forms
            this.entityDictionary.set(table.toLowerCase() + 's', TokenType.TABLE_NAME);
            // Add singular forms if plural
            if (table.endsWith('s')) {
                this.entityDictionary.set(table.slice(0, -1).toLowerCase(), TokenType.TABLE_NAME);
            }
        }
        // Add column names
        for (const [table, columns] of Object.entries(schema.columns)) {
            for (const column of columns) {
                this.entityDictionary.set(column.toLowerCase(), TokenType.COLUMN_NAME);
                // Handle snake_case to natural language
                const natural = column.replace(/_/g, ' ').toLowerCase();
                if (natural !== column.toLowerCase()) {
                    this.entityDictionary.set(natural, TokenType.COLUMN_NAME);
                }
            }
        }
    }
    tokenize(input) {
        const tokens = [];
        let remaining = input;
        let position = 0;
        while (remaining.length > 0) {
            let matched = false;
            // Try to match patterns in priority order
            const sortedPatterns = [...this.patterns].sort((a, b) => b.priority - a.priority);
            for (const pattern of sortedPatterns) {
                const match = remaining.match(pattern.pattern);
                if (match && match.index === 0) {
                    const text = match[0];
                    const normalized = pattern.normalizer ? pattern.normalizer(text) : this.normalize(text);
                    tokens.push({
                        text,
                        type: pattern.type,
                        position,
                        length: text.length,
                        normalized,
                        confidence: pattern.priority / 100,
                    });
                    remaining = remaining.substring(text.length);
                    position += text.length;
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                // Check entity dictionary
                const words = remaining.split(/\s+/);
                const firstWord = words[0];
                const firstWordLower = firstWord.toLowerCase();
                if (this.entityDictionary.has(firstWordLower)) {
                    tokens.push({
                        text: firstWord,
                        type: this.entityDictionary.get(firstWordLower),
                        position,
                        length: firstWord.length,
                        normalized: firstWordLower,
                        confidence: 0.8,
                    });
                    remaining = remaining.substring(firstWord.length);
                    position += firstWord.length;
                }
                else {
                    // Default to NOUN for unrecognized words
                    const word = this.extractNextWord(remaining);
                    tokens.push({
                        text: word,
                        type: this.guessTokenType(word),
                        position,
                        length: word.length,
                        normalized: this.normalize(word),
                        confidence: 0.5,
                    });
                    remaining = remaining.substring(word.length);
                    position += word.length;
                }
            }
            // Skip whitespace
            const whitespaceMatch = remaining.match(/^\s+/);
            if (whitespaceMatch) {
                remaining = remaining.substring(whitespaceMatch[0].length);
                position += whitespaceMatch[0].length;
            }
        }
        return this.postProcess(tokens);
    }
    extractNextWord(text) {
        const match = text.match(/^[^\s]+/);
        return match ? match[0] : text[0];
    }
    guessTokenType(word) {
        // Simple heuristics for unknown words
        if (/^[A-Z]/.test(word))
            return TokenType.NOUN; // Proper noun
        if (/ing$/.test(word))
            return TokenType.VERB; // Gerund
        if (/ed$/.test(word))
            return TokenType.VERB; // Past tense
        if (/ly$/.test(word))
            return TokenType.ADVERB;
        if (/[.!?,;:]/.test(word))
            return TokenType.PUNCTUATION;
        return TokenType.NOUN; // Default
    }
    normalize(text) {
        const lower = text.toLowerCase();
        // Expand abbreviations
        if (this.abbreviations.has(lower)) {
            return this.abbreviations.get(lower);
        }
        // Remove quotes from literals
        if ((text.startsWith("'") && text.endsWith("'")) ||
            (text.startsWith('"') && text.endsWith('"'))) {
            return text.slice(1, -1);
        }
        return lower;
    }
    postProcess(tokens) {
        const processed = [];
        for (let i = 0; i < tokens.length; i++) {
            const current = tokens[i];
            const next = tokens[i + 1];
            const prev = processed[processed.length - 1];
            // Merge multi-word entities
            if (current.type === TokenType.NOUN && next?.type === TokenType.NOUN) {
                // Check if they form a known entity
                const combined = `${current.normalized} ${next.normalized}`;
                if (this.entityDictionary.has(combined)) {
                    processed.push({
                        text: `${current.text} ${next.text}`,
                        type: this.entityDictionary.get(combined),
                        position: current.position,
                        length: current.length + next.length + 1,
                        normalized: combined,
                        confidence: 0.9,
                    });
                    i++; // Skip next token
                    continue;
                }
            }
            // Handle "group by" as single token
            if (current.normalized === 'group' && next?.normalized === 'by') {
                processed.push({
                    text: `${current.text} ${next.text}`,
                    type: TokenType.GROUP_KEYWORD,
                    position: current.position,
                    length: current.length + next.length + 1,
                    normalized: 'group by',
                    confidence: 1.0,
                });
                i++; // Skip next token
                continue;
            }
            // Handle "order by" as single token
            if (current.normalized === 'order' && next?.normalized === 'by') {
                processed.push({
                    text: `${current.text} ${next.text}`,
                    type: TokenType.ORDER_KEYWORD,
                    position: current.position,
                    length: current.length + next.length + 1,
                    normalized: 'order by',
                    confidence: 1.0,
                });
                i++; // Skip next token
                continue;
            }
            processed.push(current);
        }
        return processed;
    }
    /**
     * Extract entities from tokens
     */
    extractEntities(tokens) {
        const entities = {
            tables: [],
            columns: [],
            functions: [],
            values: [],
        };
        for (const token of tokens) {
            switch (token.type) {
                case TokenType.TABLE_NAME:
                    if (!entities.tables.includes(token.normalized)) {
                        entities.tables.push(token.normalized);
                    }
                    break;
                case TokenType.COLUMN_NAME:
                    if (!entities.columns.includes(token.normalized)) {
                        entities.columns.push(token.normalized);
                    }
                    break;
                case TokenType.FUNCTION_NAME:
                case TokenType.AGGREGATION:
                    if (!entities.functions.includes(token.normalized)) {
                        entities.functions.push(token.normalized);
                    }
                    break;
                case TokenType.STRING_LITERAL:
                case TokenType.NUMBER_LITERAL:
                case TokenType.DATE_LITERAL:
                case TokenType.BOOLEAN_LITERAL:
                    entities.values.push(token.normalized);
                    break;
            }
        }
        return entities;
    }
    /**
     * Get confidence score for the tokenization
     */
    getConfidence(tokens) {
        if (tokens.length === 0)
            return 0;
        const totalConfidence = tokens.reduce((sum, token) => sum + token.confidence, 0);
        return totalConfidence / tokens.length;
    }
}
export class TokenAnalyzer {
    /**
     * Analyze tokens to determine query intent
     */
    analyzeIntent(tokens) {
        const hasSelect = tokens.some(t => t.type === TokenType.SELECT_KEYWORD);
        const hasAggregation = tokens.some(t => t.type === TokenType.AGGREGATION);
        const hasGroupBy = tokens.some(t => t.type === TokenType.GROUP_KEYWORD);
        const hasOrderBy = tokens.some(t => t.type === TokenType.ORDER_KEYWORD);
        const hasJoin = tokens.some(t => t.type === TokenType.JOIN_KEYWORD);
        const hasWhere = tokens.some(t => t.type === TokenType.WHERE_KEYWORD);
        if (hasAggregation && hasGroupBy) {
            return QueryIntent.AGGREGATE_GROUP;
        }
        if (hasAggregation) {
            return QueryIntent.AGGREGATE;
        }
        if (hasJoin) {
            return QueryIntent.JOIN;
        }
        if (hasWhere) {
            return QueryIntent.FILTER;
        }
        if (hasOrderBy) {
            return QueryIntent.SORT;
        }
        if (hasSelect) {
            return QueryIntent.SELECT;
        }
        return QueryIntent.UNKNOWN;
    }
    /**
     * Extract relationships between entities
     */
    extractRelationships(tokens) {
        const relationships = [];
        for (let i = 0; i < tokens.length - 2; i++) {
            const current = tokens[i];
            const middle = tokens[i + 1];
            const next = tokens[i + 2];
            // Look for patterns like "table.column" or "table JOIN table"
            if (current.type === TokenType.TABLE_NAME &&
                middle.type === TokenType.JOIN_KEYWORD &&
                next.type === TokenType.TABLE_NAME) {
                relationships.push({
                    type: 'join',
                    from: current.normalized,
                    to: next.normalized,
                    condition: null,
                });
            }
        }
        return relationships;
    }
}
export var QueryIntent;
(function (QueryIntent) {
    QueryIntent["SELECT"] = "SELECT";
    QueryIntent["FILTER"] = "FILTER";
    QueryIntent["AGGREGATE"] = "AGGREGATE";
    QueryIntent["AGGREGATE_GROUP"] = "AGGREGATE_GROUP";
    QueryIntent["JOIN"] = "JOIN";
    QueryIntent["SORT"] = "SORT";
    QueryIntent["INSERT"] = "INSERT";
    QueryIntent["UPDATE"] = "UPDATE";
    QueryIntent["DELETE"] = "DELETE";
    QueryIntent["UNKNOWN"] = "UNKNOWN";
})(QueryIntent || (QueryIntent = {}));
//# sourceMappingURL=advanced-tokenizer.js.map