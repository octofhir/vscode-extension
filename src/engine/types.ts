/**
 * Type definitions for the FHIRPath engine
 */

/**
 * Represents a FHIR resource
 */
export interface FhirResource {
    resourceType: string;
    id?: string;
    meta?: {
        versionId?: string;
        lastUpdated?: string;
        profile?: string[];
        security?: any[];
        tag?: any[];
    };
    [key: string]: any;
}

/**
 * Represents the result of a FHIRPath evaluation
 */
export interface FhirPathResult {
    value: any;
    type: FhirPathValueType;
    collection?: FhirPathResult[];
}

/**
 * FHIRPath value types
 */
export type FhirPathValueType =
    | 'empty'
    | 'boolean'
    | 'integer'
    | 'decimal'
    | 'string'
    | 'date'
    | 'dateTime'
    | 'time'
    | 'quantity'
    | 'collection'
    | 'resource'
    | 'element';

/**
 * Represents the Abstract Syntax Tree of a FHIRPath expression
 */
export interface FhirPathAst {
    type: AstNodeType;
    expression?: string;
    value?: any;
    children: FhirPathAst[];
    location: AstLocation;
    operator?: string;
    function?: string;
    parameters?: FhirPathAst[];
}

/**
 * AST node types
 */
export type AstNodeType =
    | 'expression'
    | 'literal'
    | 'identifier'
    | 'function'
    | 'operator'
    | 'path'
    | 'filter'
    | 'index'
    | 'union'
    | 'parentheses';

/**
 * Location information for AST nodes
 */
export interface AstLocation {
    start: number;
    end: number;
    line?: number;
    column?: number;
}

/**
 * Validation error information
 */
export interface ValidationError {
    message: string;
    location: AstLocation;
    severity: 'error' | 'warning' | 'info';
    code?: string;
}

/**
 * Function signature information
 */
export interface FunctionSignature {
    name: string;
    description: string;
    parameters: FunctionParameter[];
    returnType: FhirPathValueType;
    examples?: string[];
}

/**
 * Function parameter information
 */
export interface FunctionParameter {
    name: string;
    type: FhirPathValueType | FhirPathValueType[];
    optional?: boolean;
    description: string;
}

/**
 * Completion item information
 */
export interface CompletionItem {
    label: string;
    kind: CompletionItemKind;
    detail?: string;
    documentation?: string;
    insertText?: string;
    sortText?: string;
    filterText?: string;
}

/**
 * Completion item kinds
 */
export enum CompletionItemKind {
    Function = 'function',
    Property = 'property',
    Variable = 'variable',
    Keyword = 'keyword',
    Operator = 'operator',
    Literal = 'literal'
}

/**
 * Hover information
 */
export interface HoverInfo {
    contents: string | string[];
    range?: {
        start: number;
        end: number;
    };
}

/**
 * Symbol information
 */
export interface SymbolInfo {
    name: string;
    kind: SymbolKind;
    location: AstLocation;
    detail?: string;
    children?: SymbolInfo[];
}

/**
 * Symbol kinds
 */
export enum SymbolKind {
    Function = 'function',
    Property = 'property',
    Variable = 'variable',
    Expression = 'expression',
    Operator = 'operator'
}

/**
 * Diagnostic information
 */
export interface Diagnostic {
    range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
    message: string;
    severity: DiagnosticSeverity;
    code?: string | number;
    source?: string;
}

/**
 * Diagnostic severity levels
 */
export enum DiagnosticSeverity {
    Error = 1,
    Warning = 2,
    Information = 3,
    Hint = 4
}

/**
 * Configuration for the FHIRPath engine
 */
export interface EngineConfig {
    timeout?: number;
    maxDepth?: number;
    enableCache?: boolean;
    strictMode?: boolean;
}

/**
 * Cache entry
 */
export interface CacheEntry {
    key: string;
    value: any;
    timestamp: number;
    ttl?: number;
}

/**
 * Server authentication configuration
 */
export interface ServerAuth {
    type: 'none' | 'basic' | 'bearer' | 'oauth2';
    username?: string;
    password?: string;
    token?: string;
    clientId?: string;
    clientSecret?: string;
    tokenUrl?: string;
}

/**
 * FHIR server configuration
 */
export interface ServerConfig {
    url: string;
    auth: ServerAuth;
    timeout?: number;
    headers?: Record<string, string>;
}

/**
 * Evaluation context
 */
export interface EvaluationContext {
    resource: FhirResource;
    variables?: Record<string, any>;
    functions?: Record<string, Function>;
}

/**
 * Formatting options
 */
export interface FormattingOptions {
    style: 'compact' | 'readable';
    indentSize?: number;
    maxLineLength?: number;
    insertSpaces?: boolean;
}

/**
 * Extension settings
 */
export interface ExtensionSettings {
    defaultContext?: string;
    server?: ServerConfig;
    formatting?: FormattingOptions;
    evaluation?: {
        timeout: number;
    };
    highlighting?: {
        enabled: boolean;
        fileTypes: string[];
    };
    validation?: {
        liveValidation: boolean;
    };
    ast?: {
        maxDepth: number;
    };
}

/**
 * View state for results panel
 */
export interface ResultsViewState {
    expression: string;
    result: FhirPathResult;
    context?: FhirResource;
    timestamp: number;
    executionTime?: number;
}

/**
 * View state for AST panel
 */
export interface AstViewState {
    expression: string;
    ast: FhirPathAst;
    timestamp: number;
    expanded?: Set<string>;
}

/**
 * Explorer tree item
 */
export interface ExplorerItem {
    id: string;
    label: string;
    description?: string;
    tooltip?: string;
    iconPath?: string;
    contextValue?: string;
    children?: ExplorerItem[];
    collapsibleState?: 'none' | 'collapsed' | 'expanded';
}

/**
 * Language feature context
 */
export interface LanguageContext {
    document: {
        uri: string;
        languageId: string;
        version: number;
        getText(): string;
        getText(range: { start: number; end: number }): string;
        positionAt(offset: number): { line: number; character: number };
        offsetAt(position: { line: number; character: number }): number;
    };
    position: { line: number; character: number };
    word?: {
        word: string;
        startColumn: number;
        endColumn: number;
    };
}

/**
 * Quick fix action
 */
export interface QuickFixAction {
    title: string;
    kind: string;
    diagnostics?: Diagnostic[];
    edit?: {
        changes: Record<string, TextEdit[]>;
    };
    command?: {
        title: string;
        command: string;
        arguments?: any[];
    };
}

/**
 * Text edit for quick fixes
 */
export interface TextEdit {
    range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
    newText: string;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
    parseTime?: number;
    evaluationTime?: number;
    totalTime: number;
    memoryUsage?: number;
    cacheHits?: number;
    cacheMisses?: number;
}
