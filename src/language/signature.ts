import * as vscode from "vscode";
import type { FhirPathEngine } from "../engine/fhirPathEngine";

/**
 * Provides signature help for FHIRPath function calls
 */
export class SignatureHelpProvider implements vscode.SignatureHelpProvider {
	constructor(private engine: FhirPathEngine) {}

	async provideSignatureHelp(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
		context: vscode.SignatureHelpContext,
	): Promise<vscode.SignatureHelp | null> {
		const line = document.lineAt(position);
		const lineText = line.text;
		const beforeCursor = lineText.substring(0, position.character);

		// Find the function call context
		const functionCall = this.findFunctionCall(beforeCursor);
		if (!functionCall) {
			return null;
		}

		const signature = this.getFunctionSignature(functionCall.functionName);
		if (!signature) {
			return null;
		}

		const signatureHelp = new vscode.SignatureHelp();
		signatureHelp.signatures = [signature];
		signatureHelp.activeSignature = 0;
		signatureHelp.activeParameter = functionCall.parameterIndex;

		return signatureHelp;
	}

	private findFunctionCall(
		text: string,
	): { functionName: string; parameterIndex: number } | null {
		// Find the last unclosed function call
		let depth = 0;
		let functionStart = -1;
		let parameterIndex = 0;

		for (let i = text.length - 1; i >= 0; i--) {
			const char = text[i];

			if (char === ")") {
				depth++;
			} else if (char === "(") {
				depth--;
				if (depth < 0) {
					// Found the opening parenthesis of our function call
					functionStart = i;
					break;
				}
			} else if (char === "," && depth === 0) {
				parameterIndex++;
			}
		}

		if (functionStart === -1) {
			return null;
		}

		// Extract the function name
		const beforeParen = text.substring(0, functionStart);
		const functionMatch = beforeParen.match(/([a-zA-Z_][a-zA-Z0-9_]*)$/);
		if (!functionMatch) {
			return null;
		}

		const functionName = functionMatch[1];

		// Count parameters more accurately
		const insideParens = text.substring(functionStart + 1);
		parameterIndex = this.countParameters(insideParens);

		return { functionName, parameterIndex };
	}

	private countParameters(text: string): number {
		let depth = 0;
		let parameterCount = 0;
		let hasContent = false;

		for (const char of text) {
			if (char === "(") {
				depth++;
			} else if (char === ")") {
				depth--;
			} else if (char === "," && depth === 0) {
				parameterCount++;
				hasContent = false;
			} else if (char.trim() !== "") {
				hasContent = true;
			}
		}

		// If there's content after the last comma (or no commas), count it as a parameter
		if (hasContent || parameterCount === 0) {
			return parameterCount;
		}

		return parameterCount;
	}

	private getFunctionSignature(
		functionName: string,
	): vscode.SignatureInformation | null {
		const signatures = this.getFunctionSignatures();
		const signatureInfo = signatures[functionName];

		if (!signatureInfo) {
			return null;
		}

		const signature = new vscode.SignatureInformation(
			signatureInfo.label,
			new vscode.MarkdownString(signatureInfo.documentation),
		);

		signature.parameters = signatureInfo.parameters.map(
			(param) =>
				new vscode.ParameterInformation(
					param.label,
					new vscode.MarkdownString(param.documentation),
				),
		);

		return signature;
	}

	private getFunctionSignatures(): Record<
		string,
		{
			label: string;
			documentation: string;
			parameters: Array<{ label: string; documentation: string }>;
		}
	> {
		return {
			where: {
				label: "where(criteria: expression): collection",
				documentation:
					"Returns a collection containing only those elements for which the criteria expression evaluates to true.",
				parameters: [
					{
						label: "criteria",
						documentation:
							"The boolean expression to evaluate for each element",
					},
				],
			},
			select: {
				label: "select(projection: expression): collection",
				documentation:
					"Evaluates the projection expression for each item in the input collection.",
				parameters: [
					{
						label: "projection",
						documentation: "The expression to evaluate for each element",
					},
				],
			},
			repeat: {
				label: "repeat(projection: expression): collection",
				documentation:
					"Repeatedly applies the projection expression to the input collection.",
				parameters: [
					{
						label: "projection",
						documentation: "The expression to repeatedly apply",
					},
				],
			},
			ofType: {
				label: "ofType(type: identifier): collection",
				documentation:
					"Returns a collection that contains all items in the input collection that are of the given type.",
				parameters: [
					{
						label: "type",
						documentation: "The type to filter by",
					},
				],
			},
			as: {
				label: "as(type: identifier): collection",
				documentation:
					"Returns the input collection if it is of the specified type, otherwise returns empty.",
				parameters: [
					{
						label: "type",
						documentation: "The type to cast to",
					},
				],
			},
			is: {
				label: "is(type: identifier): boolean",
				documentation:
					"Returns true if the input collection is of the specified type.",
				parameters: [
					{
						label: "type",
						documentation: "The type to check against",
					},
				],
			},
			skip: {
				label: "skip(num: integer): collection",
				documentation: "Returns all but the first num items in a collection.",
				parameters: [
					{
						label: "num",
						documentation: "The number of items to skip",
					},
				],
			},
			take: {
				label: "take(num: integer): collection",
				documentation: "Returns the first num items in a collection.",
				parameters: [
					{
						label: "num",
						documentation: "The number of items to take",
					},
				],
			},
			intersect: {
				label: "intersect(other: collection): collection",
				documentation: "Returns the intersection of two collections.",
				parameters: [
					{
						label: "other",
						documentation: "The collection to intersect with",
					},
				],
			},
			exclude: {
				label: "exclude(other: collection): collection",
				documentation: "Returns the set difference between two collections.",
				parameters: [
					{
						label: "other",
						documentation: "The collection to exclude",
					},
				],
			},
			union: {
				label: "union(other: collection): collection",
				documentation: "Returns the union of two collections.",
				parameters: [
					{
						label: "other",
						documentation: "The collection to union with",
					},
				],
			},
			combine: {
				label: "combine(other: collection): collection",
				documentation:
					"Merges the input and other collections into a single collection.",
				parameters: [
					{
						label: "other",
						documentation: "The collection to combine with",
					},
				],
			},
			contains: {
				label: "contains(substring: string): boolean",
				documentation:
					"Returns true if the input string contains the given substring.",
				parameters: [
					{
						label: "substring",
						documentation: "The substring to search for",
					},
				],
			},
			indexOf: {
				label: "indexOf(substring: string): integer",
				documentation:
					"Returns the 0-based index of the first occurrence of the given substring in the input string.",
				parameters: [
					{
						label: "substring",
						documentation: "The substring to find the index of",
					},
				],
			},
			substring: {
				label: "substring(start: integer, length?: integer): string",
				documentation:
					"Returns the part of the input string starting at position start.",
				parameters: [
					{
						label: "start",
						documentation: "The starting position (0-based)",
					},
					{
						label: "length",
						documentation: "The length of the substring (optional)",
					},
				],
			},
			startsWith: {
				label: "startsWith(prefix: string): boolean",
				documentation:
					"Returns true if the input string starts with the given prefix.",
				parameters: [
					{
						label: "prefix",
						documentation: "The prefix to check for",
					},
				],
			},
			endsWith: {
				label: "endsWith(suffix: string): boolean",
				documentation:
					"Returns true if the input string ends with the given suffix.",
				parameters: [
					{
						label: "suffix",
						documentation: "The suffix to check for",
					},
				],
			},
			matches: {
				label: "matches(regex: string): boolean",
				documentation:
					"Returns true if the input string matches the given regular expression.",
				parameters: [
					{
						label: "regex",
						documentation: "The regular expression pattern",
					},
				],
			},
			replaceMatches: {
				label: "replaceMatches(regex: string, replacement: string): string",
				documentation:
					"Replaces each substring of the input string that matches the given regular expression.",
				parameters: [
					{
						label: "regex",
						documentation: "The regular expression pattern",
					},
					{
						label: "replacement",
						documentation: "The replacement string",
					},
				],
			},
			replace: {
				label: "replace(pattern: string, replacement: string): string",
				documentation:
					"Replaces each occurrence of the given substring in the input string.",
				parameters: [
					{
						label: "pattern",
						documentation: "The substring to replace",
					},
					{
						label: "replacement",
						documentation: "The replacement string",
					},
				],
			},
			split: {
				label: "split(separator: string): collection",
				documentation:
					"Splits the input string around matches of the given separator.",
				parameters: [
					{
						label: "separator",
						documentation: "The separator string",
					},
				],
			},
			join: {
				label: "join(separator: string): string",
				documentation:
					"Joins a collection of strings with the given separator.",
				parameters: [
					{
						label: "separator",
						documentation: "The separator string",
					},
				],
			},
			power: {
				label: "power(exponent: number): number",
				documentation: "Raises the input to the power of the exponent.",
				parameters: [
					{
						label: "exponent",
						documentation: "The exponent value",
					},
				],
			},
			round: {
				label: "round(precision?: integer): number",
				documentation:
					"Rounds the input to the nearest integer or specified precision.",
				parameters: [
					{
						label: "precision",
						documentation: "The number of decimal places (optional)",
					},
				],
			},
			all: {
				label: "all(criteria: expression): boolean",
				documentation:
					"Returns true if the criteria expression evaluates to true for all items in the input collection.",
				parameters: [
					{
						label: "criteria",
						documentation:
							"The boolean expression to evaluate for each element",
					},
				],
			},
			subsetOf: {
				label: "subsetOf(other: collection): boolean",
				documentation:
					"Returns true if the input collection is a subset of the other collection.",
				parameters: [
					{
						label: "other",
						documentation: "The collection to compare against",
					},
				],
			},
			supersetOf: {
				label: "supersetOf(other: collection): boolean",
				documentation:
					"Returns true if the input collection is a superset of the other collection.",
				parameters: [
					{
						label: "other",
						documentation: "The collection to compare against",
					},
				],
			},
			// Functions with no parameters
			empty: {
				label: "empty(): boolean",
				documentation:
					"Returns true if the input collection is empty ({ }) and false otherwise.",
				parameters: [],
			},
			exists: {
				label: "exists(): boolean",
				documentation:
					"Returns true if the collection has any elements, and false otherwise.",
				parameters: [],
			},
			count: {
				label: "count(): integer",
				documentation:
					"Returns the integer count of the number of items in the input collection.",
				parameters: [],
			},
			length: {
				label: "length(): integer",
				documentation: "Returns the length of the input string.",
				parameters: [],
			},
			toString: {
				label: "toString(): string",
				documentation: "Converts the input to a string representation.",
				parameters: [],
			},
			toInteger: {
				label: "toInteger(): integer",
				documentation: "Converts the input to an integer.",
				parameters: [],
			},
			toDecimal: {
				label: "toDecimal(): decimal",
				documentation: "Converts the input to a decimal.",
				parameters: [],
			},
			toBoolean: {
				label: "toBoolean(): boolean",
				documentation: "Converts the input to a boolean.",
				parameters: [],
			},
			first: {
				label: "first(): any",
				documentation: "Returns the first item in a collection.",
				parameters: [],
			},
			last: {
				label: "last(): any",
				documentation: "Returns the last item in a collection.",
				parameters: [],
			},
			tail: {
				label: "tail(): collection",
				documentation: "Returns all but the first item in a collection.",
				parameters: [],
			},
			distinct: {
				label: "distinct(): collection",
				documentation:
					"Returns a collection with only the unique items from the input collection.",
				parameters: [],
			},
			isDistinct: {
				label: "isDistinct(): boolean",
				documentation:
					"Returns true if all items in the collection are distinct.",
				parameters: [],
			},
			single: {
				label: "single(): any",
				documentation: "Returns the single item in the input collection.",
				parameters: [],
			},
			allTrue: {
				label: "allTrue(): boolean",
				documentation:
					"Returns true if all items in the input collection are true.",
				parameters: [],
			},
			anyTrue: {
				label: "anyTrue(): boolean",
				documentation:
					"Returns true if any item in the input collection is true.",
				parameters: [],
			},
			allFalse: {
				label: "allFalse(): boolean",
				documentation:
					"Returns true if all items in the input collection are false.",
				parameters: [],
			},
			anyFalse: {
				label: "anyFalse(): boolean",
				documentation:
					"Returns true if any item in the input collection is false.",
				parameters: [],
			},
			lower: {
				label: "lower(): string",
				documentation: "Converts the input string to lowercase.",
				parameters: [],
			},
			upper: {
				label: "upper(): string",
				documentation: "Converts the input string to uppercase.",
				parameters: [],
			},
			toChars: {
				label: "toChars(): collection",
				documentation:
					"Converts the input string to a collection of single-character strings.",
				parameters: [],
			},
			abs: {
				label: "abs(): number",
				documentation: "Returns the absolute value of the input.",
				parameters: [],
			},
			ceiling: {
				label: "ceiling(): integer",
				documentation:
					"Returns the smallest integer greater than or equal to the input.",
				parameters: [],
			},
			floor: {
				label: "floor(): integer",
				documentation:
					"Returns the largest integer less than or equal to the input.",
				parameters: [],
			},
			truncate: {
				label: "truncate(): integer",
				documentation: "Returns the integer part of the input.",
				parameters: [],
			},
			exp: {
				label: "exp(): number",
				documentation: "Returns e raised to the power of the input.",
				parameters: [],
			},
			ln: {
				label: "ln(): number",
				documentation: "Returns the natural logarithm of the input.",
				parameters: [],
			},
			log: {
				label: "log(): number",
				documentation: "Returns the logarithm base 10 of the input.",
				parameters: [],
			},
			sqrt: {
				label: "sqrt(): number",
				documentation: "Returns the square root of the input.",
				parameters: [],
			},
		};
	}
}
