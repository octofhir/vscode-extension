import * as vscode from "vscode";
import type { FhirPathEngine } from "../engine/fhirPathEngine";
import { Diagnostic, DiagnosticSeverity } from "../engine/types";

/**
 * Provides validation and diagnostics for FHIRPath expressions
 */
export class ValidationProvider implements vscode.Disposable {
	private diagnosticCollection: vscode.DiagnosticCollection;
	private disposables: vscode.Disposable[] = [];

	constructor(private engine: FhirPathEngine) {
		this.diagnosticCollection =
			vscode.languages.createDiagnosticCollection("fhirpath");

		// Register event listeners
		this.disposables.push(
			vscode.workspace.onDidChangeTextDocument(this.onDocumentChange, this),
			vscode.workspace.onDidOpenTextDocument(this.onDocumentOpen, this),
			vscode.workspace.onDidCloseTextDocument(this.onDocumentClose, this),
			this.diagnosticCollection,
		);

		// Validate all open FHIRPath documents
		vscode.workspace.textDocuments.forEach((doc) => {
			if (this.shouldValidateDocument(doc)) {
				this.validateDocument(doc);
			}
		});
	}

	private onDocumentChange(event: vscode.TextDocumentChangeEvent): void {
		if (this.shouldValidateDocument(event.document)) {
			// Debounce validation to avoid excessive calls
			this.debounceValidation(event.document);
		}
	}

	private onDocumentOpen(document: vscode.TextDocument): void {
		if (this.shouldValidateDocument(document)) {
			this.validateDocument(document);
		}
	}

	private onDocumentClose(document: vscode.TextDocument): void {
		this.diagnosticCollection.delete(document.uri);
	}

	private shouldValidateDocument(document: vscode.TextDocument): boolean {
		const config = vscode.workspace.getConfiguration("fhirpath");
		const liveValidation = config.get<boolean>(
			"validation.liveValidation",
			true,
		);

		if (!liveValidation) {
			return false;
		}

		// Validate .fhirpath files
		if (document.languageId === "fhirpath") {
			return true;
		}

		// Validate FHIRPath expressions in other file types
		const enabledFileTypes = config.get<string[]>("highlighting.fileTypes", []);
		return enabledFileTypes.includes(document.languageId);
	}

	private validationTimeouts = new Map<string, NodeJS.Timeout>();

	private debounceValidation(document: vscode.TextDocument): void {
		const uri = document.uri.toString();

		// Clear existing timeout
		const existingTimeout = this.validationTimeouts.get(uri);
		if (existingTimeout) {
			clearTimeout(existingTimeout);
		}

		// Set new timeout
		const timeout = setTimeout(() => {
			this.validateDocument(document);
			this.validationTimeouts.delete(uri);
		}, 500); // 500ms debounce

		this.validationTimeouts.set(uri, timeout);
	}

	private async validateDocument(document: vscode.TextDocument): Promise<void> {
		try {
			const diagnostics: vscode.Diagnostic[] = [];

			if (document.languageId === "fhirpath") {
				// Validate entire document as FHIRPath expression
				const expression = document.getText().trim();
				if (expression) {
					const expressionDiagnostics = await this.validateExpression(
						expression,
						new vscode.Range(
							0,
							0,
							document.lineCount - 1,
							document.lineAt(document.lineCount - 1).text.length,
						),
					);
					diagnostics.push(...expressionDiagnostics);
				}
			} else {
				// Find and validate embedded FHIRPath expressions
				const embeddedExpressions = this.findEmbeddedExpressions(document);
				for (const expr of embeddedExpressions) {
					const expressionDiagnostics = await this.validateExpression(
						expr.expression,
						expr.range,
					);
					diagnostics.push(...expressionDiagnostics);
				}
			}

			this.diagnosticCollection.set(document.uri, diagnostics);
		} catch (error) {
			console.error("Error validating FHIRPath document:", error);
		}
	}

	private findEmbeddedExpressions(
		document: vscode.TextDocument,
	): Array<{ expression: string; range: vscode.Range }> {
		const expressions: Array<{ expression: string; range: vscode.Range }> = [];
		const text = document.getText();

		// Patterns for different file types
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
					// Function calls
					{
						regex:
							/(?:fhirpath|fhir_path|evaluate|expression)\s*\(\s*["`']([^"`']+)["`']/g,
						groupIndex: 1,
					},
					// React hooks
					{
						regex:
							/(?:useFHIRPath|useFhirPath|useQuery|useExpression|useValidation)\s*\(\s*["`']([^"`']+)["`']/g,
						groupIndex: 1,
					},
					// Object properties (enhanced)
					{
						regex:
							/(?:expression|path|query|rule|criteria|condition|select|where|filter|expr|fhirpath)\s*[:=]\s*["`']([^"`']+)["`']/g,
						groupIndex: 1,
					},
					// Template literals
					{
						regex:
							/(?:fhirpath|fhir_path|evaluate|expression|useFHIRPath|useFhirPath|useQuery|useExpression)\s*\(\s*`([^`]+)`/g,
						groupIndex: 1,
					},
					{
						regex:
							/(?:expression|path|query|rule|criteria|condition|select|where|filter|expr|fhirpath)\s*[:=]\s*`([^`]+)`/g,
						groupIndex: 1,
					},
					// Class properties and methods
					{
						regex:
							/(?:private|public|protected)?\s*(?:expression|path|query|rule|criteria|condition|select|where|filter|expr|fhirpath)\s*[:=]\s*["`']([^"`']+)["`']/g,
						groupIndex: 1,
					},
					// Function parameters with defaults
					{
						regex:
							/(?:expression|path|query|rule|criteria|condition|select|where|filter|expr|fhirpath)\s*=\s*["`']([^"`']+)["`']/g,
						groupIndex: 1,
					},
					// Array and Map values
					{
						regex:
							/\[\s*["`']([^"`']*(?:Patient|Observation|Condition|Encounter|Bundle)\.[^"`']*)["`']/g,
						groupIndex: 1,
					},
					{
						regex:
							/(?:set|add)\s*\(\s*["`'][^"`']*["`']\s*,\s*["`']([^"`']*(?:Patient|Observation|Condition|Encounter|Bundle)\.[^"`']*)["`']/g,
						groupIndex: 1,
					},
				];
			case "javascriptreact":
			case "typescriptreact":
				return [
					// JSX/TSX attributes
					{
						regex:
							/(?:expression|path|query|rule|criteria|condition|select|where|filter)\s*=\s*["`']([^"`']+)["`']/g,
						groupIndex: 1,
					},
					// JSX expressions with strings
					{
						regex:
							/(?:expression|path|query|rule|criteria|condition|select|where|filter)\s*=\s*\{\s*["`']([^"`']+)["`']\s*\}/g,
						groupIndex: 1,
					},
					// All JavaScript/TypeScript patterns
					{
						regex:
							/(?:fhirpath|fhir_path|evaluate|expression)\s*\(\s*["`']([^"`']+)["`']/g,
						groupIndex: 1,
					},
					{
						regex:
							/(?:useFHIRPath|useFhirPath|useQuery|useExpression|useValidation)\s*\(\s*["`']([^"`']+)["`']/g,
						groupIndex: 1,
					},
					{
						regex:
							/(?:expression|path|query|rule|criteria|condition|select|where|filter|expr|fhirpath)\s*[:=]\s*["`']([^"`']+)["`']/g,
						groupIndex: 1,
					},
					{
						regex:
							/(?:fhirpath|fhir_path|evaluate|expression|useFHIRPath|useFhirPath|useQuery|useExpression)\s*\(\s*`([^`]+)`/g,
						groupIndex: 1,
					},
					{
						regex:
							/(?:expression|path|query|rule|criteria|condition|select|where|filter|expr|fhirpath)\s*[:=]\s*`([^`]+)`/g,
						groupIndex: 1,
					},
					// React component props and state
					{
						regex:
							/useState\s*\(\s*["`']([^"`']*(?:Patient|Observation|Condition|Encounter|Bundle)\.[^"`']*)["`']/g,
						groupIndex: 1,
					},
					{
						regex:
							/useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[^}]*(?:fhirpath|evaluate)\s*\(\s*["`']([^"`']+)["`']/g,
						groupIndex: 1,
					},
					// Component default props
					{
						regex:
							/\{\s*(?:expression|path|query|rule|criteria|condition|select|where|filter)\s*=\s*["`']([^"`']+)["`']/g,
						groupIndex: 1,
					},
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

	private async validateExpression(
		expression: string,
		range: vscode.Range,
	): Promise<vscode.Diagnostic[]> {
		const diagnostics: vscode.Diagnostic[] = [];

		try {
			// Basic syntax validation
			const isValid = await this.engine.validate(expression);
			if (!isValid) {
				diagnostics.push(
					new vscode.Diagnostic(
						range,
						"Invalid FHIRPath expression syntax",
						vscode.DiagnosticSeverity.Error,
					),
				);
			}

			// Additional semantic validations
			const semanticDiagnostics = await this.performSemanticValidation(
				expression,
				range,
			);
			diagnostics.push(...semanticDiagnostics);
		} catch (error) {
			// Parse error
			diagnostics.push(
				new vscode.Diagnostic(
					range,
					`FHIRPath parse error: ${error}`,
					vscode.DiagnosticSeverity.Error,
				),
			);
		}

		return diagnostics;
	}

	private async performSemanticValidation(
		expression: string,
		range: vscode.Range,
	): Promise<vscode.Diagnostic[]> {
		const diagnostics: vscode.Diagnostic[] = [];

		// Check for common issues
		const issues = this.findCommonIssues(expression);
		for (const issue of issues) {
			const diagnostic = new vscode.Diagnostic(
				range,
				issue.message,
				this.mapSeverity(issue.severity),
			);
			diagnostic.code = issue.code;
			diagnostic.source = "fhirpath";
			diagnostics.push(diagnostic);
		}

		// Check for deprecated functions
		const deprecatedFunctions = this.findDeprecatedFunctions(expression);
		for (const func of deprecatedFunctions) {
			diagnostics.push(
				new vscode.Diagnostic(
					range,
					`Function '${func}' is deprecated`,
					vscode.DiagnosticSeverity.Warning,
				),
			);
		}

		// Check for performance issues
		const performanceIssues = this.findPerformanceIssues(expression);
		for (const issue of performanceIssues) {
			diagnostics.push(
				new vscode.Diagnostic(
					range,
					issue,
					vscode.DiagnosticSeverity.Information,
				),
			);
		}

		return diagnostics;
	}

	private findCommonIssues(
		expression: string,
	): Array<{ message: string; severity: DiagnosticSeverity; code?: string }> {
		const issues: Array<{
			message: string;
			severity: DiagnosticSeverity;
			code?: string;
		}> = [];

		// Check for unmatched parentheses
		const openParens = (expression.match(/\(/g) || []).length;
		const closeParens = (expression.match(/\)/g) || []).length;
		if (openParens !== closeParens) {
			issues.push({
				message: "Unmatched parentheses",
				severity: DiagnosticSeverity.Error,
				code: "unmatched-parens",
			});
		}

		// Check for unmatched brackets
		const openBrackets = (expression.match(/\[/g) || []).length;
		const closeBrackets = (expression.match(/\]/g) || []).length;
		if (openBrackets !== closeBrackets) {
			issues.push({
				message: "Unmatched brackets",
				severity: DiagnosticSeverity.Error,
				code: "unmatched-brackets",
			});
		}

		// Check for empty function calls
		if (expression.match(/\w+\(\s*\)/)) {
			const emptyFunctions = expression.match(/(\w+)\(\s*\)/g);
			if (emptyFunctions) {
				for (const func of emptyFunctions) {
					const funcName = func.replace(/\(\s*\)/, "");
					if (!this.isValidEmptyFunction(funcName)) {
						issues.push({
							message: `Function '${funcName}' requires parameters`,
							severity: DiagnosticSeverity.Error,
							code: "missing-parameters",
						});
					}
				}
			}
		}

		// Check for potential typos in function names
		const functionNames = expression.match(
			/\b[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\()/g,
		);
		if (functionNames) {
			const validFunctions = this.engine.getAvailableFunctions();
			for (const funcName of functionNames) {
				if (!validFunctions.includes(funcName)) {
					const suggestion = this.findClosestFunction(funcName, validFunctions);
					const message = suggestion
						? `Unknown function '${funcName}'. Did you mean '${suggestion}'?`
						: `Unknown function '${funcName}'`;
					issues.push({
						message,
						severity: DiagnosticSeverity.Error,
						code: "unknown-function",
					});
				}
			}
		}

		// Check for double negation
		if (expression.includes("not not") || expression.includes("!!")) {
			issues.push({
				message: "Double negation detected. Consider simplifying.",
				severity: DiagnosticSeverity.Information,
				code: "double-negation",
			});
		}

		return issues;
	}

	private isValidEmptyFunction(functionName: string): boolean {
		const validEmptyFunctions = [
			"empty",
			"exists",
			"count",
			"length",
			"toString",
			"toInteger",
			"toDecimal",
			"toBoolean",
			"first",
			"last",
			"tail",
			"distinct",
			"isDistinct",
			"single",
			"allTrue",
			"anyTrue",
			"allFalse",
			"anyFalse",
			"lower",
			"upper",
			"toChars",
			"abs",
			"ceiling",
			"floor",
			"truncate",
			"exp",
			"ln",
			"log",
			"sqrt",
			"now",
			"today",
			"timeOfDay",
		];
		return validEmptyFunctions.includes(functionName);
	}

	private findClosestFunction(
		input: string,
		validFunctions: string[],
	): string | null {
		let minDistance = Infinity;
		let closest = null;

		for (const func of validFunctions) {
			const distance = this.levenshteinDistance(
				input.toLowerCase(),
				func.toLowerCase(),
			);
			if (distance < minDistance && distance <= 2) {
				// Only suggest if distance is reasonable
				minDistance = distance;
				closest = func;
			}
		}

		return closest;
	}

	private levenshteinDistance(a: string, b: string): number {
		const matrix = Array(b.length + 1)
			.fill(null)
			.map(() => Array(a.length + 1).fill(null));

		for (let i = 0; i <= a.length; i++) {
			matrix[0][i] = i;
		}

		for (let j = 0; j <= b.length; j++) {
			matrix[j][0] = j;
		}

		for (let j = 1; j <= b.length; j++) {
			for (let i = 1; i <= a.length; i++) {
				const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
				matrix[j][i] = Math.min(
					matrix[j][i - 1] + 1, // deletion
					matrix[j - 1][i] + 1, // insertion
					matrix[j - 1][i - 1] + indicator, // substitution
				);
			}
		}

		return matrix[b.length][a.length];
	}

	private findDeprecatedFunctions(expression: string): string[] {
		const deprecated: string[] = [];
		const deprecatedFunctions = ["toQuantity", "convertsToQuantity"]; // Example deprecated functions

		for (const func of deprecatedFunctions) {
			if (expression.includes(func + "(")) {
				deprecated.push(func);
			}
		}

		return deprecated;
	}

	private findPerformanceIssues(expression: string): string[] {
		const issues: string[] = [];

		// Check for potentially expensive operations
		if (expression.includes(".repeat(")) {
			issues.push(
				"Using repeat() function may impact performance with large datasets",
			);
		}

		if (expression.match(/\.\*\./)) {
			issues.push(
				"Recursive descent (..) may impact performance with deep structures",
			);
		}

		// Check for complex nested expressions
		const depth = this.calculateNestingDepth(expression);
		if (depth > 5) {
			issues.push(
				"Deep nesting detected. Consider breaking into smaller expressions for better readability",
			);
		}

		return issues;
	}

	private calculateNestingDepth(expression: string): number {
		let maxDepth = 0;
		let currentDepth = 0;

		for (const char of expression) {
			if (char === "(" || char === "[") {
				currentDepth++;
				maxDepth = Math.max(maxDepth, currentDepth);
			} else if (char === ")" || char === "]") {
				currentDepth--;
			}
		}

		return maxDepth;
	}

	private mapSeverity(severity: DiagnosticSeverity): vscode.DiagnosticSeverity {
		switch (severity) {
			case DiagnosticSeverity.Error:
				return vscode.DiagnosticSeverity.Error;
			case DiagnosticSeverity.Warning:
				return vscode.DiagnosticSeverity.Warning;
			case DiagnosticSeverity.Information:
				return vscode.DiagnosticSeverity.Information;
			case DiagnosticSeverity.Hint:
				return vscode.DiagnosticSeverity.Hint;
			default:
				return vscode.DiagnosticSeverity.Error;
		}
	}

	dispose(): void {
		this.disposables.forEach((d) => d.dispose());
		this.validationTimeouts.forEach((timeout) => clearTimeout(timeout));
		this.validationTimeouts.clear();
	}
}
