import * as vscode from 'vscode';
import { FhirPathAst, AstViewState } from '../engine/types';

/**
 * Provides a webview for displaying FHIRPath AST visualization
 */
export class AstViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'fhirpathAst';
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
                        vscode.window.showInformationMessage('AST copied to clipboard');
                        break;
                    case 'export':
                        this.exportAst(message.data);
                        break;
                    case 'nodeClick':
                        this.handleNodeClick(message.nodeId);
                        break;
                    case 'expandAll':
                        this.expandAllNodes();
                        break;
                    case 'collapseAll':
                        this.collapseAllNodes();
                        break;
                }
            },
            undefined,
            []
        );
    }

    public showAst(expression: string, ast: FhirPathAst) {
        if (this._view) {
            const state: AstViewState = {
                expression,
                ast,
                timestamp: Date.now(),
                expanded: new Set(['root']) // Start with root expanded
            };

            this._view.webview.postMessage({
                type: 'showAst',
                state: {
                    ...state,
                    expanded: Array.from(state.expanded || new Set()) // Convert Set to Array for JSON serialization
                }
            });

            // Show the view
            this._view.show?.(true);
        }
    }

    public clearAst() {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'clearAst'
            });
        }
    }

    private async exportAst(data: any) {
        const options: vscode.SaveDialogOptions = {
            saveLabel: 'Export AST',
            filters: {
                'JSON': ['json'],
                'DOT': ['dot'],
                'SVG': ['svg']
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
                case 'dot':
                    content = this.convertToDot(data);
                    break;
                case 'svg':
                    content = this.convertToSvg(data);
                    break;
                default:
                    content = JSON.stringify(data, null, 2);
                    break;
            }

            await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf8'));
            vscode.window.showInformationMessage(`AST exported to ${fileUri.fsPath}`);
        }
    }

    private convertToDot(ast: any): string {
        let dotContent = 'digraph AST {\n';
        dotContent += '  node [shape=box, style=rounded];\n';
        dotContent += '  rankdir=TB;\n\n';

        const nodeId = this.generateDotNodes(ast, dotContent);
        dotContent += '\n}';

        return dotContent;
    }

    private generateDotNodes(node: any, content: string, parentId?: string): string {
        const nodeId = `node_${Math.random().toString(36).substr(2, 9)}`;
        const label = this.getNodeLabel(node);

        content += `  ${nodeId} [label="${label}"];\n`;

        if (parentId) {
            content += `  ${parentId} -> ${nodeId};\n`;
        }

        if (node.children && node.children.length > 0) {
            for (const child of node.children) {
                this.generateDotNodes(child, content, nodeId);
            }
        }

        return nodeId;
    }

    private convertToSvg(ast: any): string {
        // Simple SVG generation - in a real implementation, you might use a library like D3.js
        let svg = '<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">\n';
        svg += '  <style>\n';
        svg += '    .node { fill: #f0f0f0; stroke: #333; stroke-width: 1; }\n';
        svg += '    .text { font-family: monospace; font-size: 12px; text-anchor: middle; }\n';
        svg += '    .edge { stroke: #333; stroke-width: 1; }\n';
        svg += '  </style>\n';

        this.generateSvgNodes(ast, svg, 400, 50, 0);

        svg += '</svg>';
        return svg;
    }

    private generateSvgNodes(node: any, svg: string, x: number, y: number, level: number): void {
        const label = this.getNodeLabel(node);
        const width = Math.max(80, label.length * 8);
        const height = 30;

        // Draw node
        svg += `  <rect class="node" x="${x - width/2}" y="${y - height/2}" width="${width}" height="${height}" rx="5"/>\n`;
        svg += `  <text class="text" x="${x}" y="${y + 5}">${label}</text>\n`;

        // Draw children
        if (node.children && node.children.length > 0) {
            const childY = y + 80;
            const totalWidth = node.children.length * 120;
            const startX = x - totalWidth / 2 + 60;

            for (let i = 0; i < node.children.length; i++) {
                const childX = startX + i * 120;

                // Draw edge
                svg += `  <line class="edge" x1="${x}" y1="${y + height/2}" x2="${childX}" y2="${childY - height/2}"/>\n`;

                // Draw child node
                this.generateSvgNodes(node.children[i], svg, childX, childY, level + 1);
            }
        }
    }

    private getNodeLabel(node: any): string {
        if (node.type === 'function' && node.function) {
            return `${node.function}()`;
        } else if (node.type === 'literal' && node.value !== undefined) {
            return `"${node.value}"`;
        } else if (node.type === 'identifier' && node.name) {
            return node.name;
        } else if (node.type === 'operator' && node.operator) {
            return node.operator;
        } else if (node.expression) {
            return node.expression;
        }
        return node.type || 'Unknown';
    }

    private handleNodeClick(nodeId: string) {
        // Handle node click - could highlight corresponding text in editor
        console.log('Node clicked:', nodeId);
    }

    private expandAllNodes() {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'expandAll'
            });
        }
    }

    private collapseAllNodes() {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'collapseAll'
            });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'astView.js'));
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'astView.css'));

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
                <title>FHIRPath AST</title>
            </head>
            <body>
                <div class="container">
                    <div id="header" class="header" style="display: none;">
                        <div class="expression-info">
                            <h3>Expression</h3>
                            <code id="expression" class="expression"></code>
                        </div>
                        <div class="actions">
                            <button id="expand-all-btn" class="action-button" title="Expand all nodes">
                                <span class="codicon codicon-expand-all"></span>
                            </button>
                            <button id="collapse-all-btn" class="action-button" title="Collapse all nodes">
                                <span class="codicon codicon-collapse-all"></span>
                            </button>
                            <button id="copy-btn" class="action-button" title="Copy AST to clipboard">
                                <span class="codicon codicon-copy"></span>
                            </button>
                            <button id="export-btn" class="action-button" title="Export AST">
                                <span class="codicon codicon-export"></span>
                            </button>
                            <button id="clear-btn" class="action-button" title="Clear AST">
                                <span class="codicon codicon-clear-all"></span>
                            </button>
                        </div>
                    </div>
                    
                    <div id="content" class="content">
                        <div id="empty-state" class="empty-state">
                            <div class="empty-icon">
                                <span class="codicon codicon-symbol-structure"></span>
                            </div>
                            <h3>No AST</h3>
                            <p>Parse a FHIRPath expression to see its Abstract Syntax Tree here.</p>
                            <p class="hint">Use <kbd>Ctrl+Shift+P</kbd> and search for "FHIRPath: Show AST"</p>
                        </div>
                        
                        <div id="ast-container" class="ast-container" style="display: none;">
                            <div class="ast-info">
                                <span id="node-count" class="node-count"></span>
                                <span id="max-depth" class="max-depth"></span>
                            </div>
                            <div id="ast-tree" class="ast-tree"></div>
                        </div>
                        
                        <div id="error" class="error" style="display: none;">
                            <div class="error-icon">
                                <span class="codicon codicon-error"></span>
                            </div>
                            <div class="error-content">
                                <h4>Parse Error</h4>
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
