import * as vscode from 'vscode';
import { FhirPathEngine } from '../engine/fhirPathEngine';
import { CompletionItem, CompletionItemKind } from '../engine/types';

/**
 * Provides autocompletion for FHIRPath expressions
 */
export class CompletionProvider implements vscode.CompletionItemProvider {
    constructor(private engine: FhirPathEngine) {}

    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[]> {
        const line = document.lineAt(position);
        const lineText = line.text;
        const beforeCursor = lineText.substring(0, position.character);
        const afterCursor = lineText.substring(position.character);

        // Get the current word being typed
        const wordRange = document.getWordRangeAtPosition(position);
        const currentWord = wordRange ? document.getText(wordRange) : '';

        const completionItems: vscode.CompletionItem[] = [];

        // Add function completions
        if (this.shouldShowFunctions(beforeCursor, context)) {
            completionItems.push(...this.getFunctionCompletions(currentWord));
        }

        // Add property completions based on context
        if (this.shouldShowProperties(beforeCursor, context)) {
            completionItems.push(...await this.getPropertyCompletions(beforeCursor, currentWord));
        }

        // Add operator completions
        if (this.shouldShowOperators(beforeCursor, context)) {
            completionItems.push(...this.getOperatorCompletions(currentWord));
        }

        // Add keyword completions
        if (this.shouldShowKeywords(beforeCursor, context)) {
            completionItems.push(...this.getKeywordCompletions(currentWord));
        }

        // Add literal completions
        if (this.shouldShowLiterals(beforeCursor, context)) {
            completionItems.push(...this.getLiteralCompletions(currentWord));
        }

        return completionItems;
    }

    private shouldShowFunctions(beforeCursor: string, context: vscode.CompletionContext): boolean {
        // Show functions after dot, opening parenthesis, or at the beginning
        return /(\.|^|\s|\()$/.test(beforeCursor) || context.triggerCharacter === '.';
    }

    private shouldShowProperties(beforeCursor: string, context: vscode.CompletionContext): boolean {
        // Show properties after dot
        return /\.$/.test(beforeCursor) || context.triggerCharacter === '.';
    }

    private shouldShowOperators(beforeCursor: string, context: vscode.CompletionContext): boolean {
        // Show operators after identifiers or closing brackets/parentheses
        return /[a-zA-Z0-9_\]\)]$/.test(beforeCursor);
    }

    private shouldShowKeywords(beforeCursor: string, context: vscode.CompletionContext): boolean {
        // Show keywords at the beginning or after whitespace
        return /(\s|^)$/.test(beforeCursor);
    }

    private shouldShowLiterals(beforeCursor: string, context: vscode.CompletionContext): boolean {
        // Show literals in appropriate contexts
        return /(\s|^|\(|,)$/.test(beforeCursor);
    }

    private getFunctionCompletions(currentWord: string): vscode.CompletionItem[] {
        const functions = this.engine.getAvailableFunctions();
        return functions.map(func => {
            const item = new vscode.CompletionItem(func, vscode.CompletionItemKind.Function);
            item.detail = 'FHIRPath function';
            item.documentation = new vscode.MarkdownString(this.engine.getFunctionDocumentation(func) || '');
            item.insertText = new vscode.SnippetString(`${func}($1)`);
            item.sortText = `1_${func}`; // Prioritize functions
            return item;
        });
    }

    private async getPropertyCompletions(beforeCursor: string, currentWord: string): Promise<vscode.CompletionItem[]> {
        const completions: vscode.CompletionItem[] = [];

        // Get current FHIR resource context
        const context = this.engine.getContext();
        if (!context) {
            return this.getCommonFhirProperties();
        }

        // Analyze the path before the cursor to determine available properties
        const pathMatch = beforeCursor.match(/([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\.$$/);
        if (pathMatch) {
            const path = pathMatch[1];
            return this.getPropertiesForPath(context, path);
        }

        return this.getCommonFhirProperties();
    }

    private getCommonFhirProperties(): vscode.CompletionItem[] {
        const commonProperties = [
            'resourceType', 'id', 'meta', 'implicitRules', 'language',
            'text', 'contained', 'extension', 'modifierExtension'
        ];

        return commonProperties.map(prop => {
            const item = new vscode.CompletionItem(prop, vscode.CompletionItemKind.Property);
            item.detail = 'FHIR property';
            item.sortText = `2_${prop}`;
            return item;
        });
    }

    private getPropertiesForPath(context: any, path: string): vscode.CompletionItem[] {
        const completions: vscode.CompletionItem[] = [];

        try {
            // Navigate to the object at the given path
            const pathParts = path.split('.');
            let current = context;

            for (const part of pathParts) {
                if (current && typeof current === 'object' && part in current) {
                    current = current[part];
                } else {
                    return [];
                }
            }

            // If current is an array, get properties from the first element
            if (Array.isArray(current) && current.length > 0) {
                current = current[0];
            }

            // Get properties from the current object
            if (current && typeof current === 'object') {
                Object.keys(current).forEach(key => {
                    const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Property);
                    item.detail = 'FHIR property';
                    item.sortText = `2_${key}`;
                    completions.push(item);
                });
            }
        } catch (error) {
            // If path navigation fails, return common properties
            return this.getCommonFhirProperties();
        }

        return completions;
    }

    private getOperatorCompletions(currentWord: string): vscode.CompletionItem[] {
        const operators = [
            { label: '=', detail: 'Equals' },
            { label: '!=', detail: 'Not equals' },
            { label: '<>', detail: 'Not equals (alternative)' },
            { label: '<', detail: 'Less than' },
            { label: '<=', detail: 'Less than or equal' },
            { label: '>', detail: 'Greater than' },
            { label: '>=', detail: 'Greater than or equal' },
            { label: '~', detail: 'Equivalent' },
            { label: '!~', detail: 'Not equivalent' },
            { label: 'and', detail: 'Logical AND' },
            { label: 'or', detail: 'Logical OR' },
            { label: 'xor', detail: 'Logical XOR' },
            { label: 'implies', detail: 'Logical implication' },
            { label: 'in', detail: 'Membership test' },
            { label: 'contains', detail: 'Collection contains' },
            { label: '|', detail: 'Union operator' }
        ];

        return operators.map(op => {
            const item = new vscode.CompletionItem(op.label, vscode.CompletionItemKind.Operator);
            item.detail = op.detail;
            item.sortText = `3_${op.label}`;
            return item;
        });
    }

    private getKeywordCompletions(currentWord: string): vscode.CompletionItem[] {
        const keywords = [
            { label: 'if', detail: 'Conditional expression' },
            { label: 'then', detail: 'Then clause' },
            { label: 'else', detail: 'Else clause' },
            { label: 'is', detail: 'Type check' },
            { label: 'as', detail: 'Type cast' },
            { label: '$this', detail: 'Current context' },
            { label: '$index', detail: 'Current index in iteration' },
            { label: '$total', detail: 'Total count in iteration' }
        ];

        return keywords.map(kw => {
            const item = new vscode.CompletionItem(kw.label, vscode.CompletionItemKind.Keyword);
            item.detail = kw.detail;
            item.sortText = `4_${kw.label}`;
            return item;
        });
    }

    private getLiteralCompletions(currentWord: string): vscode.CompletionItem[] {
        const literals = [
            { label: 'true', detail: 'Boolean true' },
            { label: 'false', detail: 'Boolean false' },
            { label: '{}', detail: 'Empty collection' },
            { label: "''", detail: 'Empty string', insertText: "'$1'" },
            { label: '""', detail: 'Empty string', insertText: '"$1"' }
        ];

        return literals.map(lit => {
            const item = new vscode.CompletionItem(lit.label, vscode.CompletionItemKind.Value);
            item.detail = lit.detail;
            if (lit.insertText) {
                item.insertText = new vscode.SnippetString(lit.insertText);
            }
            item.sortText = `5_${lit.label}`;
            return item;
        });
    }

    resolveCompletionItem(
        item: vscode.CompletionItem,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.CompletionItem> {
        // Add additional documentation or details if needed
        return item;
    }
}
