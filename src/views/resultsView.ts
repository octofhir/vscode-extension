import * as vscode from 'vscode';
import { FhirPathResult, ResultsViewState } from '../engine/types';

/**
 * Provides a webview for displaying FHIRPath evaluation results
 */
export class ResultsViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'fhirpathResults';
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(
            message => {
                switch (message.type) {
                    case 'copy':
                        vscode.env.clipboard.writeText(message.text);
                        vscode.window.showInformationMessage('Copied to clipboard');
                        break;
                    case 'export':
                        this.exportResults(message.data);
                        break;
                }
            },
            undefined,
            []
        );
    }

    public showResults(expression: string, result: FhirPathResult, executionTime?: number) {
        if (this._view) {
            const state: ResultsViewState = {
                expression,
                result,
                timestamp: Date.now(),
                executionTime
            };

            this._view.webview.postMessage({
                type: 'showResults',
                state
            });

            // Show the view
            this._view.show?.(true);
        }
    }

    public clearResults() {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'clearResults'
            });
        }
    }

    private async exportResults(data: any) {
        const options: vscode.SaveDialogOptions = {
            saveLabel: 'Export Results',
            filters: {
                'JSON': ['json'],
                'CSV': ['csv'],
                'Text': ['txt']
            }
        };

        const fileUri = await vscode.window.showSaveDialog(options);
        if (fileUri) {
            let content: string;
            const extension = fileUri.path.split('.').pop()?.toLowerCase();

            switch (extension) {
                case 'json':
                    content = JSON.stringify(data, null, 2);
                    break;
                case 'csv':
                    content = this.convertToCSV(data);
                    break;
                default:
                    content = this.convertToText(data);
                    break;
            }

            await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf8'));
            vscode.window.showInformationMessage(`Results exported to ${fileUri.fsPath}`);
        }
    }

    private convertToCSV(data: any): string {
        if (Array.isArray(data)) {
            if (data.length === 0) return '';
            
            const headers = Object.keys(data[0]);
            const csvRows = [headers.join(',')];
            
            for (const row of data) {
                const values = headers.map(header => {
                    const value = row[header];
                    return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
                });
                csvRows.push(values.join(','));
            }
            
            return csvRows.join('\n');
        } else {
            return `"Key","Value"\n"Result","${JSON.stringify(data).replace(/"/g, '""')}"`;
        }
    }

    private convertToText(data: any): string {
        return JSON.stringify(data, null, 2);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'resultsView.js'));
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'resultsView.css'));

        // Use a nonce to only allow a specific script to be run.
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
                <title>FHIRPath Results</title>
            </head>
            <body>
                <div class="container">
                    <div id="header" class="header" style="display: none;">
                        <div class="expression-info">
                            <h3>Expression</h3>
                            <code id="expression" class="expression"></code>
                        </div>
                        <div class="execution-info">
                            <span id="execution-time" class="execution-time"></span>
                            <span id="timestamp" class="timestamp"></span>
                        </div>
                        <div class="actions">
                            <button id="copy-btn" class="action-button" title="Copy result to clipboard">
                                <span class="codicon codicon-copy"></span>
                            </button>
                            <button id="export-btn" class="action-button" title="Export results">
                                <span class="codicon codicon-export"></span>
                            </button>
                            <button id="clear-btn" class="action-button" title="Clear results">
                                <span class="codicon codicon-clear-all"></span>
                            </button>
                        </div>
                    </div>
                    
                    <div id="content" class="content">
                        <div id="empty-state" class="empty-state">
                            <div class="empty-icon">
                                <span class="codicon codicon-symbol-property"></span>
                            </div>
                            <h3>No Results</h3>
                            <p>Evaluate a FHIRPath expression to see results here.</p>
                            <p class="hint">Use <kbd>Ctrl+Shift+P</kbd> and search for "FHIRPath: Evaluate Expression"</p>
                        </div>
                        
                        <div id="results" class="results" style="display: none;">
                            <div class="result-summary">
                                <span id="result-type" class="result-type"></span>
                                <span id="result-count" class="result-count"></span>
                            </div>
                            <div id="result-content" class="result-content"></div>
                        </div>
                        
                        <div id="error" class="error" style="display: none;">
                            <div class="error-icon">
                                <span class="codicon codicon-error"></span>
                            </div>
                            <div class="error-content">
                                <h4>Evaluation Error</h4>
                                <pre id="error-message"></pre>
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
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
