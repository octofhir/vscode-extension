import * as vscode from "vscode";
import type { FhirPathEngine } from "../engine/fhirPathEngine";

/**
 * Provides formatting for FHIRPath expressions
 */
export class FormattingProvider
	implements vscode.DocumentFormattingEditProvider
{
	constructor(private engine: FhirPathEngine) {}

	async provideDocumentFormattingEdits(
		document: vscode.TextDocument,
		options: vscode.FormattingOptions,
		token: vscode.CancellationToken,
	): Promise<vscode.TextEdit[]> {
		const text = document.getText();
		const config = vscode.workspace.getConfiguration("fhirpath");
		const style = config.get<string>("formatting.style", "readable");

		try {
			const formatted = await this.formatExpression(text, style, options);
			if (formatted === text) {
				return []; // No changes needed
			}

			const fullRange = new vscode.Range(
				document.positionAt(0),
				document.positionAt(text.length),
			);

			return [vscode.TextEdit.replace(fullRange, formatted)];
		} catch (error) {
			// If formatting fails, return no edits
			console.error("FHIRPath formatting error:", error);
			return [];
		}
	}

	private async formatExpression(
		expression: string,
		style: string,
		options: vscode.FormattingOptions,
	): Promise<string> {
		// First, try to use the engine's format method
		try {
			const engineFormatted = await this.engine.format(expression);
			if (engineFormatted && engineFormatted !== expression) {
				return this.applyStylePreferences(engineFormatted, style, options);
			}
		} catch (error) {
			// Fall back to manual formatting
		}

		// Manual formatting as fallback
		return this.manualFormat(expression, style, options);
	}

	private applyStylePreferences(
		formatted: string,
		style: string,
		options: vscode.FormattingOptions,
	): string {
		let result = formatted;

		if (style === "compact") {
			// Compact style: minimize whitespace
			result = result
				.replace(/\s+/g, " ")
				.replace(/\s*\(\s*/g, "(")
				.replace(/\s*\)\s*/g, ")")
				.replace(/\s*,\s*/g, ",")
				.replace(/\s*\.\s*/g, ".")
				.replace(/\s*\[\s*/g, "[")
				.replace(/\s*\]\s*/g, "]")
				.trim();
		} else {
			// Readable style: add appropriate spacing
			result = this.formatReadable(result, options);
		}

		return result;
	}

	private formatReadable(
		expression: string,
		options: vscode.FormattingOptions,
	): string {
		let result = expression;
		const indent = options.insertSpaces ? " ".repeat(options.tabSize) : "\t";

		// Add spaces around operators
		result = result
			.replace(/([^<>!=~])(=)([^=])/g, "$1 $2 $3")
			.replace(/([^!])(!~)/g, "$1 $2")
			.replace(/([^<>])(<>)/g, "$1 $2")
			.replace(/([^!])(!=)/g, "$1 $2")
			.replace(/([^<])(<=)/g, "$1 $2")
			.replace(/([^>])(>=)/g, "$1 $2")
			.replace(/([^<])(<)([^=])/g, "$1 $2 $3")
			.replace(/([^>])(>)([^=])/g, "$1 $2 $3")
			.replace(/([^~])(~)([^=])/g, "$1 $2 $3")
			.replace(/\b(and|or|xor|implies|in)\b/g, " $1 ")
			.replace(/\s+/g, " ");

		// Add spaces after commas
		result = result.replace(/,(?!\s)/g, ", ");

		// Format function calls with proper spacing
		result = result.replace(/(\w+)\s*\(/g, "$1(");

		// Handle multiline expressions (if they contain certain patterns)
		if (this.shouldFormatMultiline(result)) {
			result = this.formatMultiline(result, indent);
		}

		return result.trim();
	}

	private shouldFormatMultiline(expression: string): boolean {
		// Format as multiline if expression is long or contains complex structures
		return (
			expression.length > 80 ||
			expression.includes(".where(") ||
			expression.includes(".select(") ||
			expression.includes(".repeat(") ||
			(expression.match(/\(/g) || []).length > 2
		);
	}

	private formatMultiline(expression: string, indent: string): string {
		const result = expression;
		let depth = 0;
		let formatted = "";
		let i = 0;

		while (i < result.length) {
			const char = result[i];
			const nextChar = result[i + 1];

			if (char === "(") {
				formatted += char;
				depth++;
				// Add newline after opening parenthesis for complex expressions
				if (this.isComplexFunction(result, i)) {
					formatted += "\n" + indent.repeat(depth);
				}
			} else if (char === ")") {
				depth--;
				if (formatted.endsWith("\n" + indent.repeat(depth + 1))) {
					formatted = formatted.slice(0, -indent.length);
				}
				formatted += char;
			} else if (char === "," && depth > 0) {
				formatted += char + "\n" + indent.repeat(depth);
			} else if (char === "." && this.isChainableFunction(result, i + 1)) {
				formatted += char + "\n" + indent.repeat(depth);
			} else {
				formatted += char;
			}

			i++;
		}

		return formatted;
	}

	private isComplexFunction(expression: string, parenIndex: number): boolean {
		// Look backwards to find the function name
		let funcStart = parenIndex - 1;
		while (funcStart >= 0 && /[a-zA-Z0-9_]/.test(expression[funcStart])) {
			funcStart--;
		}
		funcStart++;

		const functionName = expression.substring(funcStart, parenIndex);
		const complexFunctions = ["where", "select", "repeat", "all", "exists"];

		return complexFunctions.includes(functionName);
	}

	private isChainableFunction(expression: string, dotIndex: number): boolean {
		// Look forward to find the function name
		let funcEnd = dotIndex;
		while (
			funcEnd < expression.length &&
			/[a-zA-Z0-9_]/.test(expression[funcEnd])
		) {
			funcEnd++;
		}

		const functionName = expression.substring(dotIndex, funcEnd);
		const chainableFunctions = [
			"where",
			"select",
			"first",
			"last",
			"exists",
			"empty",
			"count",
		];

		return chainableFunctions.includes(functionName);
	}

	private manualFormat(
		expression: string,
		style: string,
		options: vscode.FormattingOptions,
	): string {
		// Basic manual formatting when engine formatting is not available
		let result = expression;

		// Normalize whitespace
		result = result.replace(/\s+/g, " ").trim();

		// Remove spaces around dots
		result = result.replace(/\s*\.\s*/g, ".");

		// Format parentheses
		result = result.replace(/\s*\(\s*/g, "(");
		result = result.replace(/\s*\)\s*/g, ")");

		// Format brackets
		result = result.replace(/\s*\[\s*/g, "[");
		result = result.replace(/\s*\]\s*/g, "]");

		if (style === "compact") {
			// Compact: remove most spaces
			result = result.replace(/\s*,\s*/g, ",");
		} else {
			// Readable: add appropriate spacing
			result = result.replace(/\s*,\s*/g, ", ");

			// Add spaces around operators
			result = result
				.replace(/([^<>!=~])(=)([^=])/g, "$1 $2 $3")
				.replace(/([^!])(!~)/g, "$1 $2")
				.replace(/([^<>])(<>)/g, "$1 $2")
				.replace(/([^!])(!=)/g, "$1 $2")
				.replace(/([^<])(<=)/g, "$1 $2")
				.replace(/([^>])(>=)/g, "$1 $2")
				.replace(/([^<])(<)([^=])/g, "$1 $2 $3")
				.replace(/([^>])(>)([^=])/g, "$1 $2 $3")
				.replace(/([^~])(~)([^=])/g, "$1 $2 $3")
				.replace(/\b(and|or|xor|implies|in)\b/g, " $1 ")
				.replace(/\s+/g, " ");
		}

		return result.trim();
	}
}

/**
 * Provides range formatting for FHIRPath expressions
 */
export class RangeFormattingProvider
	implements vscode.DocumentRangeFormattingEditProvider
{
	constructor(private formattingProvider: FormattingProvider) {}

	async provideDocumentRangeFormattingEdits(
		document: vscode.TextDocument,
		range: vscode.Range,
		options: vscode.FormattingOptions,
		token: vscode.CancellationToken,
	): Promise<vscode.TextEdit[]> {
		const text = document.getText(range);
		const config = vscode.workspace.getConfiguration("fhirpath");
		const style = config.get<string>("formatting.style", "readable");

		try {
			const formatted = await (this.formattingProvider as any).formatExpression(
				text,
				style,
				options,
			);
			if (formatted === text) {
				return []; // No changes needed
			}

			return [vscode.TextEdit.replace(range, formatted)];
		} catch (error) {
			// If formatting fails, return no edits
			console.error("FHIRPath range formatting error:", error);
			return [];
		}
	}
}

/**
 * Provides on-type formatting for FHIRPath expressions
 */
export class OnTypeFormattingProvider
	implements vscode.OnTypeFormattingEditProvider
{
	constructor(private engine: FhirPathEngine) {}

	async provideOnTypeFormattingEdits(
		document: vscode.TextDocument,
		position: vscode.Position,
		ch: string,
		options: vscode.FormattingOptions,
		token: vscode.CancellationToken,
	): Promise<vscode.TextEdit[]> {
		const config = vscode.workspace.getConfiguration("fhirpath");
		const style = config.get<string>("formatting.style", "readable");

		if (style === "compact") {
			return []; // No on-type formatting for compact style
		}

		const line = document.lineAt(position);
		const lineText = line.text;
		const beforeCursor = lineText.substring(0, position.character);

		const edits: vscode.TextEdit[] = [];

		if (ch === ")") {
			// Auto-format function calls when closing parenthesis is typed
			const functionMatch = beforeCursor.match(/(\w+)\([^)]*\)$/);
			if (functionMatch) {
				const functionCall = functionMatch[0];
				const formatted = this.formatFunctionCall(functionCall);
				if (formatted !== functionCall) {
					const start = new vscode.Position(
						position.line,
						position.character - functionCall.length,
					);
					const end = position;
					edits.push(
						vscode.TextEdit.replace(new vscode.Range(start, end), formatted),
					);
				}
			}
		} else if (ch === ",") {
			// Add space after comma if not present
			const nextChar =
				position.character < lineText.length
					? lineText[position.character]
					: "";
			if (nextChar !== " " && nextChar !== "") {
				edits.push(vscode.TextEdit.insert(position, " "));
			}
		}

		return edits;
	}

	private formatFunctionCall(functionCall: string): string {
		// Basic function call formatting
		return functionCall
			.replace(/\(\s+/g, "(")
			.replace(/\s+\)/g, ")")
			.replace(/\s*,\s*/g, ", ");
	}
}
