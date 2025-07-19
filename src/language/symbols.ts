import * as vscode from "vscode";
import type { FhirPathEngine } from "../engine/fhirPathEngine";
import { SymbolInfo, SymbolKind } from "../engine/types";

/**
 * Provides document symbols for FHIRPath expressions
 */
export class SymbolProvider implements vscode.DocumentSymbolProvider {
	constructor(private engine: FhirPathEngine) {}

	async provideDocumentSymbols(
		document: vscode.TextDocument,
		token: vscode.CancellationToken,
	): Promise<vscode.DocumentSymbol[]> {
		const symbols: vscode.DocumentSymbol[] = [];

		try {
			if (document.languageId === "fhirpath") {
				// Parse entire document as FHIRPath expression
				const expression = document.getText().trim();
				if (expression) {
					const expressionSymbols = await this.parseExpressionSymbols(
						expression,
						new vscode.Range(
							0,
							0,
							document.lineCount - 1,
							document.lineAt(document.lineCount - 1).text.length,
						),
					);
					symbols.push(...expressionSymbols);
				}
			} else {
				// Find and parse embedded FHIRPath expressions
				const embeddedExpressions = this.findEmbeddedExpressions(document);
				for (const expr of embeddedExpressions) {
					const expressionSymbols = await this.parseExpressionSymbols(
						expr.expression,
						expr.range,
					);
					if (expressionSymbols.length > 0) {
						// Wrap in a container symbol for embedded expressions
						const containerSymbol = new vscode.DocumentSymbol(
							"FHIRPath Expression",
							expr.expression.length > 50
								? expr.expression.substring(0, 47) + "..."
								: expr.expression,
							vscode.SymbolKind.String,
							expr.range,
							expr.range,
						);
						containerSymbol.children = expressionSymbols;
						symbols.push(containerSymbol);
					}
				}
			}
		} catch (error) {
			console.error("Error parsing FHIRPath symbols:", error);
		}

		return symbols;
	}

	private findEmbeddedExpressions(
		document: vscode.TextDocument,
	): Array<{ expression: string; range: vscode.Range }> {
		const expressions: Array<{ expression: string; range: vscode.Range }> = [];
		const text = document.getText();

		// Use the same patterns as validation provider
		const patterns = this.getExpressionPatterns(document.languageId);

		for (const pattern of patterns) {
			let match;
			while ((match = pattern.regex.exec(text)) !== null) {
				const expression = match[pattern.groupIndex];
				if (expression && expression.trim()) {
					const startPos = document.positionAt(
						match.index + match[0].indexOf(expression),
					);
					const endPos = document.positionAt(
						match.index + match[0].indexOf(expression) + expression.length,
					);
					const range = new vscode.Range(startPos, endPos);
					expressions.push({ expression: expression.trim(), range });
				}
			}
		}

		return expressions;
	}

	private getExpressionPatterns(
		languageId: string,
	): Array<{ regex: RegExp; groupIndex: number }> {
		switch (languageId) {
			case "json":
				return [
					{
						regex:
							/"(?:expression|criteria|condition|path|select|where|filter)"\s*:\s*"([^"]+)"/g,
						groupIndex: 1,
					},
				];
			case "yaml":
				return [
					{
						regex:
							/(?:expression|criteria|condition|path|select|where|filter)\s*:\s*([^\n\r]+)/g,
						groupIndex: 1,
					},
					{
						regex:
							/(?:expression|criteria|condition|path|select|where|filter)\s*:\s*"([^"]+)"/g,
						groupIndex: 1,
					},
					{
						regex:
							/(?:expression|criteria|condition|path|select|where|filter)\s*:\s*'([^']+)'/g,
						groupIndex: 1,
					},
				];
			case "xml":
				return [
					{
						regex:
							/<(?:expression|criteria|condition|path|select|where|filter)(?:\s[^>]*)?>([^<]+)<\/(?:expression|criteria|condition|path|select|where|filter)>/g,
						groupIndex: 1,
					},
					{
						regex:
							/(?:expression|criteria|condition|path|select|where|filter)\s*=\s*"([^"]+)"/g,
						groupIndex: 1,
					},
				];
			case "javascript":
			case "typescript":
				return [
					{
						regex:
							/(?:fhirpath|fhir_path|evaluate|expression)\s*\(\s*["`']([^"`']+)["`']/g,
						groupIndex: 1,
					},
					{ regex: /expression\s*[:=]\s*["`']([^"`']+)["`']/g, groupIndex: 1 },
				];
			case "fsh":
				return [
					{ regex: /obeys\s+[a-zA-Z0-9_-]+\s*:\s*"([^"]+)"/g, groupIndex: 1 },
					{ regex: /obeys\s+[a-zA-Z0-9_-]+\s*:\s*'([^']+)'/g, groupIndex: 1 },
					{ regex: /obeys\s+[a-zA-Z0-9_-]+\s*:\s*([^\n\r]+)/g, groupIndex: 1 },
					{ regex: /Expression\s*:\s*"([^"]+)"/g, groupIndex: 1 },
					{ regex: /Expression\s*:\s*'([^']+)'/g, groupIndex: 1 },
					{ regex: /Expression\s*:\s*([^\n\r]+)/g, groupIndex: 1 },
				];
			default:
				return [];
		}
	}

	private async parseExpressionSymbols(
		expression: string,
		range: vscode.Range,
	): Promise<vscode.DocumentSymbol[]> {
		const symbols: vscode.DocumentSymbol[] = [];

		try {
			// Try to get AST from engine
			const ast = await this.engine.parseToAst(expression);
			if (ast) {
				const astSymbols = this.convertAstToSymbols(ast, range);
				symbols.push(...astSymbols);
			}
		} catch (error) {
			// Fall back to manual parsing
			const manualSymbols = this.manualParseSymbols(expression, range);
			symbols.push(...manualSymbols);
		}

		return symbols;
	}

	private convertAstToSymbols(
		ast: any,
		range: vscode.Range,
	): vscode.DocumentSymbol[] {
		const symbols: vscode.DocumentSymbol[] = [];

		if (ast.type === "function" && ast.function) {
			const symbol = new vscode.DocumentSymbol(
				ast.function,
				"Function call",
				vscode.SymbolKind.Function,
				range,
				range,
			);

			// Add parameters as children
			if (ast.parameters && ast.parameters.length > 0) {
				symbol.children = ast.parameters.map((param: any, index: number) => {
					return new vscode.DocumentSymbol(
						`Parameter ${index + 1}`,
						this.getAstNodeDescription(param),
						vscode.SymbolKind.Variable,
						range,
						range,
					);
				});
			}

			symbols.push(symbol);
		} else if (ast.type === "path" && ast.expression) {
			const symbol = new vscode.DocumentSymbol(
				ast.expression,
				"Path expression",
				vscode.SymbolKind.Property,
				range,
				range,
			);
			symbols.push(symbol);
		} else if (ast.type === "operator" && ast.operator) {
			const symbol = new vscode.DocumentSymbol(
				ast.operator,
				"Operator",
				vscode.SymbolKind.Operator,
				range,
				range,
			);
			symbols.push(symbol);
		}

		// Process children
		if (ast.children && ast.children.length > 0) {
			for (const child of ast.children) {
				const childSymbols = this.convertAstToSymbols(child, range);
				symbols.push(...childSymbols);
			}
		}

		return symbols;
	}

	private getAstNodeDescription(node: any): string {
		if (node.type === "literal") {
			return `Literal: ${node.value}`;
		} else if (node.type === "identifier") {
			return `Identifier: ${node.name}`;
		} else if (node.type === "function") {
			return `Function: ${node.function}()`;
		} else if (node.type === "path") {
			return `Path: ${node.expression}`;
		}
		return node.type || "Unknown";
	}

	private manualParseSymbols(
		expression: string,
		range: vscode.Range,
	): vscode.DocumentSymbol[] {
		const symbols: vscode.DocumentSymbol[] = [];

		// Find function calls
		const functionMatches = expression.matchAll(
			/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g,
		);
		for (const match of functionMatches) {
			const functionName = match[1];
			const symbol = new vscode.DocumentSymbol(
				functionName,
				"Function call",
				vscode.SymbolKind.Function,
				range,
				range,
			);
			symbols.push(symbol);
		}

		// Find property paths
		const pathMatches = expression.matchAll(
			/\b([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)+)/g,
		);
		for (const match of pathMatches) {
			const path = match[1];
			const symbol = new vscode.DocumentSymbol(
				path,
				"Property path",
				vscode.SymbolKind.Property,
				range,
				range,
			);
			symbols.push(symbol);
		}

		// Find operators
		const operatorMatches = expression.matchAll(
			/\b(and|or|xor|implies|in|contains|where|select)\b/g,
		);
		for (const match of operatorMatches) {
			const operator = match[1];
			const symbol = new vscode.DocumentSymbol(
				operator,
				"Operator",
				vscode.SymbolKind.Operator,
				range,
				range,
			);
			symbols.push(symbol);
		}

		// Find literals
		const stringMatches = expression.matchAll(/'([^']*)'|"([^"]*)"/g);
		for (const match of stringMatches) {
			const literal = match[1] || match[2];
			if (literal) {
				const symbol = new vscode.DocumentSymbol(
					`"${literal}"`,
					"String literal",
					vscode.SymbolKind.String,
					range,
					range,
				);
				symbols.push(symbol);
			}
		}

		const numberMatches = expression.matchAll(/\b(\d+(?:\.\d+)?)\b/g);
		for (const match of numberMatches) {
			const number = match[1];
			const symbol = new vscode.DocumentSymbol(
				number,
				"Number literal",
				vscode.SymbolKind.Number,
				range,
				range,
			);
			symbols.push(symbol);
		}

		return symbols;
	}
}

/**
 * Provides workspace symbols for FHIRPath expressions
 */
export class WorkspaceSymbolProvider implements vscode.WorkspaceSymbolProvider {
	constructor(private engine: FhirPathEngine) {}

	async provideWorkspaceSymbols(
		query: string,
		token: vscode.CancellationToken,
	): Promise<vscode.SymbolInformation[]> {
		const symbols: vscode.SymbolInformation[] = [];

		// Search through all FHIRPath files in the workspace
		const fhirPathFiles = await vscode.workspace.findFiles(
			"**/*.fhirpath",
			"**/node_modules/**",
		);

		for (const fileUri of fhirPathFiles) {
			if (token.isCancellationRequested) {
				break;
			}

			try {
				const document = await vscode.workspace.openTextDocument(fileUri);
				const documentSymbols = await this.getDocumentSymbols(document);

				for (const symbol of documentSymbols) {
					if (this.matchesQuery(symbol.name, query)) {
						const symbolInfo = new vscode.SymbolInformation(
							symbol.name,
							symbol.kind,
							symbol.detail || "",
							new vscode.Location(fileUri, symbol.range),
						);
						symbols.push(symbolInfo);
					}
				}
			} catch (error) {
				console.error(`Error processing file ${fileUri.toString()}:`, error);
			}
		}

		return symbols;
	}

	private async getDocumentSymbols(
		document: vscode.TextDocument,
	): Promise<vscode.DocumentSymbol[]> {
		const symbolProvider = new SymbolProvider(this.engine);
		return await symbolProvider.provideDocumentSymbols(
			document,
			new vscode.CancellationTokenSource().token,
		);
	}

	private matchesQuery(symbolName: string, query: string): boolean {
		if (!query) {
			return true;
		}

		const lowerSymbol = symbolName.toLowerCase();
		const lowerQuery = query.toLowerCase();

		// Exact match
		if (lowerSymbol === lowerQuery) {
			return true;
		}

		// Contains match
		if (lowerSymbol.includes(lowerQuery)) {
			return true;
		}

		// Fuzzy match (simple implementation)
		return this.fuzzyMatch(lowerSymbol, lowerQuery);
	}

	private fuzzyMatch(text: string, pattern: string): boolean {
		let patternIndex = 0;

		for (let i = 0; i < text.length && patternIndex < pattern.length; i++) {
			if (text[i] === pattern[patternIndex]) {
				patternIndex++;
			}
		}

		return patternIndex === pattern.length;
	}
}

/**
 * Provides call hierarchy for FHIRPath functions
 */
export class CallHierarchyProvider implements vscode.CallHierarchyProvider {
	constructor(private engine: FhirPathEngine) {}

	async prepareCallHierarchy(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
	): Promise<vscode.CallHierarchyItem[]> {
		const wordRange = document.getWordRangeAtPosition(position);
		if (!wordRange) {
			return [];
		}

		const word = document.getText(wordRange);
		const availableFunctions = this.engine.getAvailableFunctions();

		if (availableFunctions.includes(word)) {
			const item = new vscode.CallHierarchyItem(
				vscode.SymbolKind.Function,
				word,
				"FHIRPath function",
				document.uri,
				wordRange,
				wordRange,
			);
			return [item];
		}

		return [];
	}

	async provideCallHierarchyIncomingCalls(
		item: vscode.CallHierarchyItem,
		token: vscode.CancellationToken,
	): Promise<vscode.CallHierarchyIncomingCall[]> {
		// Find all calls to this function in the workspace
		const calls: vscode.CallHierarchyIncomingCall[] = [];
		const functionName = item.name;

		// Search for function calls in FHIRPath files
		const fhirPathFiles = await vscode.workspace.findFiles(
			"**/*.fhirpath",
			"**/node_modules/**",
		);

		for (const fileUri of fhirPathFiles) {
			if (token.isCancellationRequested) {
				break;
			}

			try {
				const document = await vscode.workspace.openTextDocument(fileUri);
				const text = document.getText();
				const regex = new RegExp(`\\b${functionName}\\s*\\(`, "g");

				let match;
				while ((match = regex.exec(text)) !== null) {
					const position = document.positionAt(match.index);
					const range = new vscode.Range(
						position,
						position.translate(0, functionName.length),
					);

					const caller = new vscode.CallHierarchyItem(
						vscode.SymbolKind.Function,
						`Call to ${functionName}`,
						"Function call",
						fileUri,
						range,
						range,
					);

					calls.push(new vscode.CallHierarchyIncomingCall(caller, [range]));
				}
			} catch (error) {
				console.error(`Error processing file ${fileUri.toString()}:`, error);
			}
		}

		return calls;
	}

	async provideCallHierarchyOutgoingCalls(
		item: vscode.CallHierarchyItem,
		token: vscode.CancellationToken,
	): Promise<vscode.CallHierarchyOutgoingCall[]> {
		// For FHIRPath functions, we don't typically have outgoing calls
		// This would be more relevant for user-defined functions
		return [];
	}
}
