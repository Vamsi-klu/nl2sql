/**
 * Advanced tokenizer with linguistic analysis for NL2SQL
 * Provides comprehensive tokenization with POS tagging, lemmatization, and entity recognition
 */
export interface Token {
    text: string;
    type: TokenType;
    position: number;
    length: number;
    normalized: string;
    confidence: number;
    metadata?: Record<string, unknown>;
}
export declare enum TokenType {
    SELECT_KEYWORD = "SELECT_KEYWORD",
    FROM_KEYWORD = "FROM_KEYWORD",
    WHERE_KEYWORD = "WHERE_KEYWORD",
    JOIN_KEYWORD = "JOIN_KEYWORD",
    GROUP_KEYWORD = "GROUP_KEYWORD",
    ORDER_KEYWORD = "ORDER_KEYWORD",
    HAVING_KEYWORD = "HAVING_KEYWORD",
    COMPARISON_OP = "COMPARISON_OP",
    LOGICAL_OP = "LOGICAL_OP",
    ARITHMETIC_OP = "ARITHMETIC_OP",
    TABLE_NAME = "TABLE_NAME",
    COLUMN_NAME = "COLUMN_NAME",
    FUNCTION_NAME = "FUNCTION_NAME",
    ALIAS = "ALIAS",
    STRING_LITERAL = "STRING_LITERAL",
    NUMBER_LITERAL = "NUMBER_LITERAL",
    DATE_LITERAL = "DATE_LITERAL",
    BOOLEAN_LITERAL = "BOOLEAN_LITERAL",
    NULL_LITERAL = "NULL_LITERAL",
    NOUN = "NOUN",
    VERB = "VERB",
    ADJECTIVE = "ADJECTIVE",
    ADVERB = "ADVERB",
    PREPOSITION = "PREPOSITION",
    DETERMINER = "DETERMINER",
    PRONOUN = "PRONOUN",
    CONJUNCTION = "CONJUNCTION",
    AGGREGATION = "AGGREGATION",
    TEMPORAL = "TEMPORAL",
    QUANTIFIER = "QUANTIFIER",
    NEGATION = "NEGATION",
    QUESTION = "QUESTION",
    PUNCTUATION = "PUNCTUATION",
    UNKNOWN = "UNKNOWN"
}
export declare class AdvancedTokenizer {
    private patterns;
    private entityDictionary;
    private abbreviations;
    constructor(schema?: {
        tables: string[];
        columns: Record<string, string[]>;
    });
    private initializeEntityDictionary;
    tokenize(input: string): Token[];
    private extractNextWord;
    private guessTokenType;
    private normalize;
    private postProcess;
    /**
     * Extract entities from tokens
     */
    extractEntities(tokens: Token[]): {
        tables: string[];
        columns: string[];
        functions: string[];
        values: unknown[];
    };
    /**
     * Get confidence score for the tokenization
     */
    getConfidence(tokens: Token[]): number;
}
export declare class TokenAnalyzer {
    /**
     * Analyze tokens to determine query intent
     */
    analyzeIntent(tokens: Token[]): QueryIntent;
    /**
     * Extract relationships between entities
     */
    extractRelationships(tokens: Token[]): EntityRelationship[];
}
export declare enum QueryIntent {
    SELECT = "SELECT",
    FILTER = "FILTER",
    AGGREGATE = "AGGREGATE",
    AGGREGATE_GROUP = "AGGREGATE_GROUP",
    JOIN = "JOIN",
    SORT = "SORT",
    INSERT = "INSERT",
    UPDATE = "UPDATE",
    DELETE = "DELETE",
    UNKNOWN = "UNKNOWN"
}
export interface EntityRelationship {
    type: 'join' | 'filter' | 'group';
    from: string;
    to: string;
    condition: string | null;
}
