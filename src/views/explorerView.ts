import * as vscode from 'vscode';
import * as path from 'path';
import { ExplorerItem } from '../engine/types';

/**
 * Provides a tree view for the FHIRPath explorer
 */
export class ExplorerViewProvider implements vscode.TreeDataProvider<ExplorerItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ExplorerItem | undefined | null | void> = new vscode.EventEmitter<ExplorerItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ExplorerItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private savedExpressions: ExplorerItem[] = [];
    private savedContexts: ExplorerItem[] = [];
    private recentFiles: ExplorerItem[] = [];

    constructor() {
        this.loadSavedData();
        this.setupFileWatcher();
    }

    refresh(): void {
        this.loadSavedData();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ExplorerItem): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(element.label);

        treeItem.id = element.id;
        treeItem.description = element.description;
        treeItem.tooltip = element.tooltip || element.label;
        treeItem.contextValue = element.contextValue;

        if (element.children && element.children.length > 0) {
            treeItem.collapsibleState = element.collapsibleState === 'expanded'
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.Collapsed;
        } else {
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        }

        // Set icons
        if (element.iconPath) {
            treeItem.iconPath = element.iconPath;
        } else {
            treeItem.iconPath = this.getIconForItem(element);
        }

        // Set commands for clickable items
        if (element.contextValue === 'expression' || element.contextValue === 'context' || element.contextValue === 'file') {
            treeItem.command = {
                command: 'fhirpath.openItem',
                title: 'Open',
                arguments: [element]
            };
        }

        return treeItem;
    }

    getChildren(element?: ExplorerItem): Thenable<ExplorerItem[]> {
        if (!element) {
            // Root level items
            return Promise.resolve([
                {
                    id: 'expressions',
                    label: 'Saved Expressions',
                    contextValue: 'expressionsContainer',
                    children: this.savedExpressions,
                    collapsibleState: 'expanded'
                },
                {
                    id: 'contexts',
                    label: 'Saved Contexts',
                    contextValue: 'contextsContainer',
                    children: this.savedContexts,
                    collapsibleState: 'expanded'
                },
                {
                    id: 'recent',
                    label: 'Recent Files',
                    contextValue: 'recentContainer',
                    children: this.recentFiles,
                    collapsibleState: 'collapsed'
                }
            ]);
        } else {
            return Promise.resolve(element.children || []);
        }
    }

    private getIconForItem(element: ExplorerItem): vscode.ThemeIcon {
        switch (element.contextValue) {
            case 'expressionsContainer':
                return new vscode.ThemeIcon('symbol-function');
            case 'contextsContainer':
                return new vscode.ThemeIcon('database');
            case 'recentContainer':
                return new vscode.ThemeIcon('history');
            case 'expression':
                return new vscode.ThemeIcon('symbol-property');
            case 'context':
                return new vscode.ThemeIcon('json');
            case 'file':
                return new vscode.ThemeIcon('file');
            default:
                return new vscode.ThemeIcon('circle-outline');
        }
    }

    private loadSavedData(): void {
        // Load saved expressions from workspace state
        const workspaceState = vscode.workspace.getConfiguration('fhirpath');

        // Load saved expressions
        const expressions = workspaceState.get<any[]>('savedExpressions', []);
        this.savedExpressions = expressions.map((expr, index) => ({
            id: `expr_${index}`,
            label: expr.name || `Expression ${index + 1}`,
            description: expr.expression.length > 30 ? expr.expression.substring(0, 27) + '...' : expr.expression,
            tooltip: `${expr.name || 'Unnamed Expression'}\n${expr.expression}`,
            contextValue: 'expression',
            collapsibleState: 'none'
        }));

        // Load saved contexts
        const contexts = workspaceState.get<any[]>('savedContexts', []);
        this.savedContexts = contexts.map((ctx, index) => ({
            id: `ctx_${index}`,
            label: ctx.name || `Context ${index + 1}`,
            description: ctx.resourceType || 'Unknown',
            tooltip: `${ctx.name || 'Unnamed Context'}\nResource Type: ${ctx.resourceType || 'Unknown'}`,
            contextValue: 'context',
            collapsibleState: 'none'
        }));

        // Load recent files
        this.loadRecentFiles();
    }

    private async loadRecentFiles(): Promise<void> {
        try {
            // Find recent FHIRPath files
            const fhirPathFiles = await vscode.workspace.findFiles('**/*.fhirpath', '**/node_modules/**', 10);

            this.recentFiles = fhirPathFiles.map((uri, index) => ({
                id: `file_${index}`,
                label: path.basename(uri.fsPath),
                description: path.dirname(uri.fsPath),
                tooltip: uri.fsPath,
                contextValue: 'file',
                collapsibleState: 'none'
            }));
        } catch (error) {
            console.error('Error loading recent files:', error);
            this.recentFiles = [];
        }
    }

    private setupFileWatcher(): void {
        // Watch for changes to FHIRPath files
        const watcher = vscode.workspace.createFileSystemWatcher('**/*.fhirpath');

        watcher.onDidCreate(() => this.refresh());
        watcher.onDidDelete(() => this.refresh());
        watcher.onDidChange(() => this.refresh());
    }

    // Public methods for managing items
    public async addExpression(name: string, expression: string): Promise<void> {
        const workspaceState = vscode.workspace.getConfiguration('fhirpath');
        const expressions = workspaceState.get<any[]>('savedExpressions', []);

        expressions.push({ name, expression, timestamp: Date.now() });

        await workspaceState.update('savedExpressions', expressions, vscode.ConfigurationTarget.Workspace);
        this.refresh();
    }

    public async removeExpression(id: string): Promise<void> {
        const index = parseInt(id.replace('expr_', ''));
        const workspaceState = vscode.workspace.getConfiguration('fhirpath');
        const expressions = workspaceState.get<any[]>('savedExpressions', []);

        expressions.splice(index, 1);

        await workspaceState.update('savedExpressions', expressions, vscode.ConfigurationTarget.Workspace);
        this.refresh();
    }

    public async addContext(name: string, context: any): Promise<void> {
        const workspaceState = vscode.workspace.getConfiguration('fhirpath');
        const contexts = workspaceState.get<any[]>('savedContexts', []);

        contexts.push({
            name,
            resourceType: context.resourceType,
            context: context,
            timestamp: Date.now()
        });

        await workspaceState.update('savedContexts', contexts, vscode.ConfigurationTarget.Workspace);
        this.refresh();
    }

    public async removeContext(id: string): Promise<void> {
        const index = parseInt(id.replace('ctx_', ''));
        const workspaceState = vscode.workspace.getConfiguration('fhirpath');
        const contexts = workspaceState.get<any[]>('savedContexts', []);

        contexts.splice(index, 1);

        await workspaceState.update('savedContexts', contexts, vscode.ConfigurationTarget.Workspace);
        this.refresh();
    }

    public getSavedExpression(id: string): any | null {
        const index = parseInt(id.replace('expr_', ''));
        const workspaceState = vscode.workspace.getConfiguration('fhirpath');
        const expressions = workspaceState.get<any[]>('savedExpressions', []);

        return expressions[index] || null;
    }

    public getSavedContext(id: string): any | null {
        const index = parseInt(id.replace('ctx_', ''));
        const workspaceState = vscode.workspace.getConfiguration('fhirpath');
        const contexts = workspaceState.get<any[]>('savedContexts', []);

        return contexts[index] || null;
    }
}

/**
 * Commands for the FHIRPath explorer
 */
export class ExplorerCommands {
    constructor(private explorerProvider: ExplorerViewProvider) {
        this.registerCommands();
    }

    private registerCommands(): void {
        vscode.commands.registerCommand('fhirpath.openItem', (item: ExplorerItem) => {
            this.openItem(item);
        });

        vscode.commands.registerCommand('fhirpath.saveExpression', async () => {
            await this.saveCurrentExpression();
        });

        vscode.commands.registerCommand('fhirpath.saveContext', async () => {
            await this.saveCurrentContext();
        });

        vscode.commands.registerCommand('fhirpath.removeExpression', async (item: ExplorerItem) => {
            await this.explorerProvider.removeExpression(item.id);
        });

        vscode.commands.registerCommand('fhirpath.removeContext', async (item: ExplorerItem) => {
            await this.explorerProvider.removeContext(item.id);
        });

        vscode.commands.registerCommand('fhirpath.refreshExplorer', () => {
            this.explorerProvider.refresh();
        });

        vscode.commands.registerCommand('fhirpath.newFhirPathFile', async () => {
            await this.createNewFhirPathFile();
        });
    }

    private async openItem(item: ExplorerItem): Promise<void> {
        switch (item.contextValue) {
            case 'expression':
                await this.openExpression(item);
                break;
            case 'context':
                await this.openContext(item);
                break;
            case 'file':
                await this.openFile(item);
                break;
        }
    }

    private async openExpression(item: ExplorerItem): Promise<void> {
        const expression = this.explorerProvider.getSavedExpression(item.id);
        if (expression) {
            // Create a new untitled document with the expression
            const document = await vscode.workspace.openTextDocument({
                content: expression.expression,
                language: 'fhirpath'
            });
            await vscode.window.showTextDocument(document);
        }
    }

    private async openContext(item: ExplorerItem): Promise<void> {
        const context = this.explorerProvider.getSavedContext(item.id);
        if (context) {
            // Create a new untitled document with the context JSON
            const document = await vscode.workspace.openTextDocument({
                content: JSON.stringify(context.context, null, 2),
                language: 'json'
            });
            await vscode.window.showTextDocument(document);
        }
    }

    private async openFile(item: ExplorerItem): Promise<void> {
        if (item.tooltip) {
            const uri = vscode.Uri.file(item.tooltip);
            const document = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(document);
        }
    }

    private async saveCurrentExpression(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }

        const expression = editor.document.getText().trim();
        if (!expression) {
            vscode.window.showErrorMessage('No expression to save');
            return;
        }

        const name = await vscode.window.showInputBox({
            prompt: 'Enter a name for this expression',
            placeHolder: 'My FHIRPath Expression'
        });

        if (name) {
            await this.explorerProvider.addExpression(name, expression);
            vscode.window.showInformationMessage(`Expression "${name}" saved`);
        }
    }

    private async saveCurrentContext(): Promise<void> {
        const contextJson = await vscode.window.showInputBox({
            prompt: 'Enter FHIR resource JSON or select from active editor',
            placeHolder: '{"resourceType": "Patient", ...}'
        });

        if (!contextJson) {
            return;
        }

        try {
            const context = JSON.parse(contextJson);
            const name = await vscode.window.showInputBox({
                prompt: 'Enter a name for this context',
                placeHolder: `${context.resourceType || 'FHIR'} Context`
            });

            if (name) {
                await this.explorerProvider.addContext(name, context);
                vscode.window.showInformationMessage(`Context "${name}" saved`);
            }
        } catch (error) {
            vscode.window.showErrorMessage('Invalid JSON format');
        }
    }

    private async createNewFhirPathFile(): Promise<void> {
        const fileName = await vscode.window.showInputBox({
            prompt: 'Enter file name',
            placeHolder: 'expression.fhirpath'
        });

        if (fileName) {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const filePath = vscode.Uri.joinPath(workspaceFolder.uri, fileName);
                await vscode.workspace.fs.writeFile(filePath, Buffer.from('', 'utf8'));

                const document = await vscode.workspace.openTextDocument(filePath);
                await vscode.window.showTextDocument(document);
            } else {
                // Create untitled document
                const document = await vscode.workspace.openTextDocument({
                    content: '',
                    language: 'fhirpath'
                });
                await vscode.window.showTextDocument(document);
            }
        }
    }
}
