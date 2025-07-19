import * as vscode from "vscode";
import type { FhirPathEngine } from "../engine/fhirPathEngine";

/**
 * Provides hover information for FHIRPath expressions
 */
export class HoverProvider implements vscode.HoverProvider {
	constructor(private engine: FhirPathEngine) {}

	async provideHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
	): Promise<vscode.Hover | null> {
		const wordRange = document.getWordRangeAtPosition(position);
		if (!wordRange) {
			return null;
		}

		const word = document.getText(wordRange);
		const line = document.lineAt(position);
		const lineText = line.text;
		const beforeWord = lineText.substring(0, wordRange.start.character);
		const afterWord = lineText.substring(wordRange.end.character);

		// First, try to get expression-level information for the entire line
		const expressionHover = await this.getExpressionHover(
			lineText.trim(),
			wordRange,
		);
		if (expressionHover) {
			return expressionHover;
		}

		// Check if it's a function
		if (this.isFunctionContext(word, afterWord)) {
			return this.getFunctionHover(word, wordRange);
		}

		// Check if it's an operator
		const operatorHover = this.getOperatorHover(word, wordRange);
		if (operatorHover) {
			return operatorHover;
		}

		// Check if it's a keyword
		const keywordHover = this.getKeywordHover(word, wordRange);
		if (keywordHover) {
			return keywordHover;
		}

		// Check if it's a property in the current context
		const propertyHover = await this.getPropertyHover(
			word,
			beforeWord,
			wordRange,
		);
		if (propertyHover) {
			return propertyHover;
		}

		// Check if it's a literal
		const literalHover = this.getLiteralHover(word, wordRange);
		if (literalHover) {
			return literalHover;
		}

		return null;
	}

	/**
	 * Get comprehensive hover information for a FHIRPath expression
	 */
	private async getExpressionHover(
		expression: string,
		range: vscode.Range,
	): Promise<vscode.Hover | null> {
		if (!expression || expression.length === 0) {
			return null;
		}

		// Only provide expression-level hover for expressions that look like FHIRPath
		if (!this.looksLikeFhirPath(expression)) {
			return null;
		}

		const contents = new vscode.MarkdownString();
		contents.appendCodeblock(expression, "fhirpath");
		contents.appendMarkdown("**FHIRPath Expression**\n\n");

		try {
			// Validate the expression
			const isValid = await this.engine.validate(expression);

			if (isValid) {
				contents.appendMarkdown("✅ **Valid Expression**\n\n");

				// Try to evaluate if context is available
				const context = this.engine.getContext();
				if (context) {
					try {
						const result = await this.engine.evaluate(expression, context);
						contents.appendMarkdown("📊 **Evaluation Result:**\n");
						contents.appendCodeblock(JSON.stringify(result, null, 2), "json");
						contents.appendMarkdown("\n");
					} catch (evalError) {
						contents.appendMarkdown("⚠️ **Evaluation Error:**\n");
						contents.appendMarkdown(`\`${evalError}\`\n\n`);
					}
				} else {
					contents.appendMarkdown("ℹ️ **No Context Available**\n");
					contents.appendMarkdown(
						"Set a FHIR resource context to see evaluation results.\n\n",
					);
				}
			} else {
				contents.appendMarkdown("❌ **Invalid Expression**\n\n");
				contents.appendMarkdown(
					"This FHIRPath expression contains syntax errors.\n\n",
				);

				// Add syntax help
				contents.appendMarkdown("**Common FHIRPath Patterns:**\n");
				contents.appendMarkdown("- `property` - Access a property\n");
				contents.appendMarkdown(
					"- `property.subproperty` - Navigate nested properties\n",
				);
				contents.appendMarkdown(
					"- `property[0]` - Access first element in array\n",
				);
				contents.appendMarkdown(
					"- `property.where(condition)` - Filter elements\n",
				);
				contents.appendMarkdown(
					"- `property.exists()` - Check if property exists\n\n",
				);
			}

			// Add general help
			contents.appendMarkdown("**Quick Help:**\n");
			contents.appendMarkdown("- Use single quotes for strings: `'value'`\n");
			contents.appendMarkdown("- Use @ prefix for dates: `@2023-01-01`\n");
			contents.appendMarkdown(
				"- Use parentheses for grouping: `(a or b) and c`\n",
			);
			contents.appendMarkdown(
				"- [FHIRPath Specification](https://build.fhir.org/ig/HL7/FHIRPath/)\n",
			);
		} catch (error) {
			contents.appendMarkdown("❌ **Validation Error**\n\n");
			contents.appendMarkdown(`Error: \`${error}\`\n\n`);
			contents.appendMarkdown("**Troubleshooting:**\n");
			contents.appendMarkdown("- Check syntax and spelling\n");
			contents.appendMarkdown("- Ensure proper use of quotes and operators\n");
			contents.appendMarkdown(
				"- Verify property names match FHIR specification\n",
			);
		}

		return new vscode.Hover(contents, range);
	}

	/**
	 * Check if a string looks like a FHIRPath expression
	 */
	private looksLikeFhirPath(text: string): boolean {
		// Basic heuristics to identify FHIRPath expressions
		const fhirPathPatterns = [
			/\w+\.\w+/, // property.subproperty
			/\w+\[\d+\]/, // property[index]
			/\w+\(\)/, // function()
			/\w+\.where\(/, // property.where(
			/\w+\.exists\(\)/, // property.exists()
			/\w+\.first\(\)/, // property.first()
			/\w+\.last\(\)/, // property.last()
			/\w+\.count\(\)/, // property.count()
			/\w+\.empty\(\)/, // property.empty()
			/@\d{4}-\d{2}-\d{2}/, // date literal
			/'\w+'/, // string literal
			/\band\b|\bor\b|\bxor\b/, // logical operators
			/=|!=|<>|<=|>=|<|>/, // comparison operators
		];

		return fhirPathPatterns.some((pattern) => pattern.test(text));
	}

	private isFunctionContext(word: string, afterWord: string): boolean {
		// Check if the word is followed by an opening parenthesis
		return /^\s*\(/.test(afterWord);
	}

	private getFunctionHover(
		functionName: string,
		range: vscode.Range,
	): vscode.Hover | null {
		const documentation = this.engine.getFunctionDocumentation(functionName);
		if (!documentation) {
			return null;
		}

		const contents = new vscode.MarkdownString();
		contents.appendCodeblock(`${functionName}()`, "fhirpath");
		contents.appendMarkdown(`**FHIRPath Function**\n\n${documentation}`);

		// Add examples if available
		const examples = this.getFunctionExamples(functionName);
		if (examples.length > 0) {
			contents.appendMarkdown("\n\n**Examples:**\n");
			examples.forEach((example) => {
				contents.appendCodeblock(example, "fhirpath");
			});
		}

		return new vscode.Hover(contents, range);
	}

	private getOperatorHover(
		word: string,
		range: vscode.Range,
	): vscode.Hover | null {
		const operators: Record<string, string> = {
			"=": "Equality operator. Returns true if the left and right operands are equal.",
			"!=": "Inequality operator. Returns true if the left and right operands are not equal.",
			"<>": "Inequality operator (alternative syntax). Returns true if the left and right operands are not equal.",
			"<": "Less than operator. Returns true if the left operand is less than the right operand.",
			"<=": "Less than or equal operator. Returns true if the left operand is less than or equal to the right operand.",
			">": "Greater than operator. Returns true if the left operand is greater than the right operand.",
			">=": "Greater than or equal operator. Returns true if the left operand is greater than or equal to the right operand.",
			"~": "Equivalence operator. Returns true if the left and right operands are equivalent.",
			"!~": "Non-equivalence operator. Returns true if the left and right operands are not equivalent.",
			and: "Logical AND operator. Returns true if both operands are true.",
			or: "Logical OR operator. Returns true if either operand is true.",
			xor: "Logical XOR operator. Returns true if exactly one operand is true.",
			implies:
				"Logical implication operator. Returns true if the left operand is false or the right operand is true.",
			in: "Membership operator. Returns true if the left operand is a member of the right operand collection.",
			contains:
				"Collection contains operator. Returns true if the left collection contains the right operand.",
			"|": "Union operator. Combines two collections into one.",
			"+": "Addition operator for numbers or string concatenation.",
			"-": "Subtraction operator for numbers.",
			"*": "Multiplication operator for numbers.",
			"/": "Division operator for numbers.",
			div: "Integer division operator.",
			mod: "Modulo operator. Returns the remainder of division.",
		};

		const description = operators[word];
		if (!description) {
			return null;
		}

		const contents = new vscode.MarkdownString();
		contents.appendCodeblock(word, "fhirpath");
		contents.appendMarkdown(`**FHIRPath Operator**\n\n${description}`);

		return new vscode.Hover(contents, range);
	}

	private getKeywordHover(
		word: string,
		range: vscode.Range,
	): vscode.Hover | null {
		const keywords: Record<string, string> = {
			if: "Conditional expression keyword. Used to create conditional logic: `if condition then value1 else value2`",
			then: "Then clause in conditional expressions. Specifies the value to return when the condition is true.",
			else: "Else clause in conditional expressions. Specifies the value to return when the condition is false.",
			is: "Type checking operator. Returns true if the operand is of the specified type.",
			as: "Type casting operator. Casts the operand to the specified type.",
			$this:
				"Special variable that refers to the current context item in iterations and filters.",
			$index:
				"Special variable that contains the current index (0-based) in collection iterations.",
			$total:
				"Special variable that contains the total count of items in collection iterations.",
			true: "Boolean literal representing the true value.",
			false: "Boolean literal representing the false value.",
		};

		const description = keywords[word];
		if (!description) {
			return null;
		}

		const contents = new vscode.MarkdownString();
		contents.appendCodeblock(word, "fhirpath");
		contents.appendMarkdown(`**FHIRPath Keyword**\n\n${description}`);

		return new vscode.Hover(contents, range);
	}

	private async getPropertyHover(
		word: string,
		beforeWord: string,
		range: vscode.Range,
	): Promise<vscode.Hover | null> {
		const context = this.engine.getContext();
		if (!context) {
			return this.getCommonPropertyHover(word, range);
		}

		// Try to determine the type and description of the property
		const propertyInfo = this.getPropertyInfo(word, beforeWord, context);
		if (!propertyInfo) {
			return this.getCommonPropertyHover(word, range);
		}

		const contents = new vscode.MarkdownString();
		contents.appendCodeblock(word, "fhirpath");
		contents.appendMarkdown(`**FHIR Property**\n\n${propertyInfo.description}`);

		if (propertyInfo.type) {
			contents.appendMarkdown(`\n\n**Type:** \`${propertyInfo.type}\``);
		}

		if (propertyInfo.cardinality) {
			contents.appendMarkdown(
				`\n\n**Cardinality:** \`${propertyInfo.cardinality}\``,
			);
		}

		return new vscode.Hover(contents, range);
	}

	private getCommonPropertyHover(
		word: string,
		range: vscode.Range,
	): vscode.Hover | null {
		const commonProperties: Record<
			string,
			{ description: string; type: string; cardinality: string }
		> = {
			resourceType: {
				description: "The type of FHIR resource.",
				type: "string",
				cardinality: "1..1",
			},
			id: {
				description: "The logical id of the resource.",
				type: "id",
				cardinality: "0..1",
			},
			meta: {
				description: "Metadata about the resource.",
				type: "Meta",
				cardinality: "0..1",
			},
			implicitRules: {
				description:
					"A reference to a set of rules that were followed when the resource was constructed.",
				type: "uri",
				cardinality: "0..1",
			},
			language: {
				description: "The base language in which the resource is written.",
				type: "code",
				cardinality: "0..1",
			},
			text: {
				description:
					"A human-readable narrative that contains a summary of the resource.",
				type: "Narrative",
				cardinality: "0..1",
			},
			contained: {
				description: "Resources contained within this resource.",
				type: "Resource",
				cardinality: "0..*",
			},
			extension: {
				description: "Additional content defined by implementations.",
				type: "Extension",
				cardinality: "0..*",
			},
			modifierExtension: {
				description: "Extensions that cannot be ignored.",
				type: "Extension",
				cardinality: "0..*",
			},
		};

		const propertyInfo = commonProperties[word];
		if (!propertyInfo) {
			return null;
		}

		const contents = new vscode.MarkdownString();
		contents.appendCodeblock(word, "fhirpath");
		contents.appendMarkdown(`**FHIR Property**\n\n${propertyInfo.description}`);
		contents.appendMarkdown(`\n\n**Type:** \`${propertyInfo.type}\``);
		contents.appendMarkdown(
			`\n\n**Cardinality:** \`${propertyInfo.cardinality}\``,
		);

		return new vscode.Hover(contents, range);
	}

	private getPropertyInfo(
		word: string,
		beforeWord: string,
		context: any,
	): { description: string; type?: string; cardinality?: string } | null {
		// This is a simplified implementation
		// In a real implementation, you would use FHIR structure definitions
		// to get accurate property information

		try {
			// Navigate to the current context based on the path before the word
			const pathMatch = beforeWord.match(
				/([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\.$$/,
			);
			let current = context;

			if (pathMatch) {
				const path = pathMatch[1];
				const pathParts = path.split(".");

				for (const part of pathParts) {
					if (current && typeof current === "object" && part in current) {
						current = current[part];
					} else {
						return null;
					}
				}
			}

			// Check if the property exists in the current context
			if (current && typeof current === "object") {
				if (Array.isArray(current) && current.length > 0) {
					current = current[0];
				}

				if (word in current) {
					const value = current[word];
					const type = Array.isArray(value) ? "array" : typeof value;
					return {
						description: `Property '${word}' in the current FHIR resource context.`,
						type: type,
						cardinality: Array.isArray(value) ? "0..*" : "0..1",
					};
				}
			}
		} catch (error) {
			// Ignore errors and return null
		}

		return null;
	}

	private getLiteralHover(
		word: string,
		range: vscode.Range,
	): vscode.Hover | null {
		// Check for numeric literals
		if (/^\d+$/.test(word)) {
			const contents = new vscode.MarkdownString();
			contents.appendCodeblock(word, "fhirpath");
			contents.appendMarkdown(
				"**Integer Literal**\n\nA numeric integer value.",
			);
			return new vscode.Hover(contents, range);
		}

		if (/^\d+\.\d+$/.test(word)) {
			const contents = new vscode.MarkdownString();
			contents.appendCodeblock(word, "fhirpath");
			contents.appendMarkdown(
				"**Decimal Literal**\n\nA numeric decimal value.",
			);
			return new vscode.Hover(contents, range);
		}

		return null;
	}

	private getFunctionExamples(functionName: string): string[] {
		const examples: Record<string, string[]> = {
			empty: ["name.empty()", "telecom.where(system = 'phone').empty()"],
			exists: ["name.exists()", "telecom.where(system = 'email').exists()"],
			count: ["name.count()", "telecom.count()"],
			length: ["name.family.length()", "id.length()"],
			first: ["name.first()", "telecom.first()"],
			last: ["name.last()", "telecom.last()"],
			where: [
				"telecom.where(system = 'phone')",
				"name.where(use = 'official')",
			],
			select: ["name.select(family)", "telecom.select(value)"],
			contains: ["name.family.contains('Smith')", "id.contains('123')"],
			startsWith: ["name.family.startsWith('Sm')", "id.startsWith('pat')"],
			endsWith: ["name.family.endsWith('th')", "id.endsWith('123')"],
			substring: ["name.family.substring(0, 3)", "id.substring(1)"],
			toString: ["birthDate.toString()", "active.toString()"],
			toInteger: ["'123'.toInteger()", "age.toString().toInteger()"],
			toDecimal: [
				"'123.45'.toDecimal()",
				"weight.value.toString().toDecimal()",
			],
		};

		return examples[functionName] || [];
	}
}
