import * as vscode from "vscode";
import type { FhirPathEngine } from "../engine/fhirPathEngine";
import type { FhirPathResult, FhirResource } from "../engine/types";

export interface PlaygroundViewState {
	expression: string;
	context: string;
	result?: FhirPathResult;
	error?: string;
	executionTime?: number;
	timestamp: number;
}

export class PlaygroundViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "fhirpathPlaygroundView";

	private _view?: vscode.WebviewView;
	private _engine: FhirPathEngine;
	private _state: PlaygroundViewState = {
		expression: "",
		context: "{}",
		timestamp: Date.now(),
	};

	constructor(
		private readonly _extensionUri: vscode.Uri,
		engine: FhirPathEngine,
	) {
		this._engine = engine;
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri],
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		// Handle messages from the webview
		webviewView.webview.onDidReceiveMessage(async (message) => {
			switch (message.type) {
				case "evaluate":
					await this.evaluateExpression(message.expression, message.context);
					break;
				case "clear":
					this.clearPlayground();
					break;
				case "loadExample":
					this.loadExample(message.example);
					break;
				case "export":
					await this.exportResults(message.data);
					break;
				case "updateExpression":
					this._state.expression = message.expression;
					break;
				case "updateContext":
					this._state.context = message.context;
					break;
			}
		});

		// Send initial state
		this.updateWebview();
	}

	public async evaluateExpression(expression: string, contextJson: string) {
		if (!this._view) {
			return;
		}

		try {
			// Parse context JSON
			let context: FhirResource;
			try {
				context = JSON.parse(contextJson);
			} catch (error) {
				throw new Error(`Invalid JSON context: ${error}`);
			}

			// Measure execution time
			const startTime = Date.now();

			// Set context and evaluate
			this._engine.setContext(context);
			const result = await this._engine.evaluate(expression);

			const executionTime = Date.now() - startTime;

			// Update state
			this._state = {
				expression,
				context: contextJson,
				result,
				error: undefined,
				executionTime,
				timestamp: Date.now(),
			};
		} catch (error) {
			// Update state with error
			this._state = {
				expression,
				context: contextJson,
				result: undefined,
				error: error instanceof Error ? error.message : String(error),
				executionTime: undefined,
				timestamp: Date.now(),
			};
		}

		this.updateWebview();
	}

	public clearPlayground() {
		this._state = {
			expression: "",
			context: "{}",
			timestamp: Date.now(),
		};
		this.updateWebview();
	}

	public loadExample(exampleName: string) {
		const examples = this.getExamples();
		const example = examples[exampleName];

		if (example) {
			this._state = {
				expression: example.expression,
				context: JSON.stringify(example.context, null, 2),
				timestamp: Date.now(),
			};
			this.updateWebview();
		}
	}

	private async exportResults(data: any) {
		const options: vscode.SaveDialogOptions = {
			saveLabel: "Export Results",
			filters: {
				JSON: ["json"],
				CSV: ["csv"],
				Text: ["txt"],
			},
		};

		const fileUri = await vscode.window.showSaveDialog(options);
		if (fileUri) {
			let content: string;
			const extension = fileUri.path.split(".").pop()?.toLowerCase();

			switch (extension) {
				case "json":
					content = JSON.stringify(data, null, 2);
					break;
				case "csv":
					content = this.convertToCSV(data);
					break;
				case "txt":
					content = this.convertToText(data);
					break;
				default:
					content = JSON.stringify(data, null, 2);
					break;
			}

			await vscode.workspace.fs.writeFile(
				fileUri,
				Buffer.from(content, "utf8"),
			);
			vscode.window.showInformationMessage(
				`Results exported to ${fileUri.fsPath}`,
			);
		}
	}

	private convertToCSV(data: any): string {
		if (Array.isArray(data)) {
			if (data.length === 0) {
				return "";
			}

			const headers = Object.keys(data[0]);
			const csvContent = [
				headers.join(","),
				...data.map((row) =>
					headers.map((header) => JSON.stringify(row[header] || "")).join(","),
				),
			].join("\n");

			return csvContent;
		}

		return JSON.stringify(data);
	}

	private convertToText(data: any): string {
		return JSON.stringify(data, null, 2);
	}

	private updateWebview() {
		if (this._view) {
			this._view.webview.postMessage({
				type: "updateState",
				state: this._state,
			});
		}
	}

	private getExamples(): Record<string, { expression: string; context: any }> {
		return {
			"basic-patient": {
				expression: "Patient.name.given",
				context: {
					resourceType: "Patient",
					id: "example",
					name: [
						{
							use: "official",
							family: "Doe",
							given: ["John", "William"],
						},
					],
				},
			},
			"patient-telecom": {
				expression: "Patient.telecom.where(system = 'phone').value",
				context: {
					resourceType: "Patient",
					id: "example",
					telecom: [
						{
							system: "phone",
							value: "+1-555-123-4567",
							use: "home",
						},
						{
							system: "email",
							value: "john.doe@example.com",
						},
					],
				},
			},
			"observation-value": {
				expression: "Observation.valueQuantity.value",
				context: {
					resourceType: "Observation",
					id: "example",
					status: "final",
					code: {
						coding: [
							{
								system: "http://loinc.org",
								code: "29463-7",
								display: "Body Weight",
							},
						],
					},
					valueQuantity: {
						value: 70.5,
						unit: "kg",
						system: "http://unitsofmeasure.org",
						code: "kg",
					},
				},
			},
		};
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, "media", "playground.js"),
		);
		const styleResetUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, "media", "reset.css"),
		);
		const styleVSCodeUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css"),
		);
		const styleMainUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, "media", "playground.css"),
		);

		const nonce = getNonce();

		return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleResetUri}" rel="stylesheet">
                <link href="${styleVSCodeUri}" rel="stylesheet">
                <link href="${styleMainUri}" rel="stylesheet">
                <title>FHIRPath Playground</title>
            </head>
            <body>
                <div class="playground-container">
                    <div class="section">
                        <div class="section-header">
                            <h3>FHIRPath Expression</h3>
                            <div class="section-actions">
                                <button id="evaluateBtn" class="button primary" title="Evaluate Expression">
                                    <span class="codicon codicon-play"></span>
                                    Evaluate
                                </button>
                                <button id="clearBtn" class="button" title="Clear All">
                                    <span class="codicon codicon-clear-all"></span>
                                    Clear All
                                </button>
                                <select id="exampleSelect" title="Load Example">
                                    <option value="">Load Example...</option>
                                    <option value="basic-patient">Basic Patient</option>
                                    <option value="patient-telecom">Patient Telecom</option>
                                    <option value="observation-value">Observation Value</option>
                                </select>
                            </div>
                        </div>
                        <textarea id="expressionInput" 
                                  placeholder="Enter FHIRPath expression (e.g., Patient.name.given)"
                                  rows="3"></textarea>
                    </div>

                    <div class="section">
                        <div class="section-header">
                            <h3>FHIR Resource Context</h3>
                        </div>
                        <textarea id="contextInput" 
                                  placeholder="Enter FHIR resource as JSON"
                                  rows="8"></textarea>
                    </div>

                    <div class="section">
                        <div class="section-header">
                            <h3>Results</h3>
                            <div class="section-actions">
                                <button id="exportBtn" class="button" title="Export Results" disabled>
                                    <span class="codicon codicon-export"></span>
                                    Export
                                </button>
                            </div>
                        </div>
                        <div id="resultsContainer">
                            <div class="placeholder">
                                Enter an expression and click Evaluate to see results
                            </div>
                        </div>
                    </div>
                </div>

                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
	}
}

function getNonce() {
	let text = "";
	const possible =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
