import * as vscode from 'vscode';
import { FhirPathEngine } from './engine/fhirPathEngine';
import { CompletionProvider } from './language/completion';
import { HoverProvider } from './language/hover';
import { SignatureHelpProvider } from './language/signature';
import { FormattingProvider } from './language/formatting';
import { ValidationProvider } from './language/validation';
import { SymbolProvider } from './language/symbols';
import { ResultsViewProvider } from './views/resultsView';
import { AstViewProvider } from './views/astView';
import { ExplorerViewProvider } from './views/explorerView';
import { PlaygroundViewProvider } from './views/playgroundView';

let fhirPathEngine: FhirPathEngine;
let resultsViewProvider: ResultsViewProvider;
let astViewProvider: AstViewProvider;
let explorerViewProvider: ExplorerViewProvider;
let playgroundViewProvider: PlaygroundViewProvider;
let validationProvider: ValidationProvider;
let outputChannel: vscode.OutputChannel;

// Logging utilities for better debugging
function logInfo(message: string, ...args: any[]) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] INFO: ${message}`;
    console.log(logMessage, ...args);
    if (outputChannel) {
        outputChannel.appendLine(logMessage + (args.length > 0 ? ' ' + args.map(arg => JSON.stringify(arg)).join(' ') : ''));
    }
}

function logError(message: string, error?: any) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ERROR: ${message}`;
    console.error(logMessage, error);
    if (outputChannel) {
        outputChannel.appendLine(logMessage);
        if (error) {
            outputChannel.appendLine(`Error details: ${error instanceof Error ? error.stack || error.message : JSON.stringify(error)}`);
        }
    }
}

function logWarning(message: string, ...args: any[]) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] WARNING: ${message}`;
    console.warn(logMessage, ...args);
    if (outputChannel) {
        outputChannel.appendLine(logMessage + (args.length > 0 ? ' ' + args.map(arg => JSON.stringify(arg)).join(' ') : ''));
    }
}

export function activate(context: vscode.ExtensionContext) {
    // Create output channel for debugging
    outputChannel = vscode.window.createOutputChannel('FHIRPath');
    context.subscriptions.push(outputChannel);

    console.log('FHIRPath extension is now active!');
    logInfo('FHIRPath extension is now active!');

    // Initialize the FHIRPath engine
    fhirPathEngine = new FhirPathEngine();

    // Initialize view providers
    resultsViewProvider = new ResultsViewProvider(context.extensionUri);
    astViewProvider = new AstViewProvider(context.extensionUri);
    explorerViewProvider = new ExplorerViewProvider();
    playgroundViewProvider = new PlaygroundViewProvider(context.extensionUri, fhirPathEngine);

    // Initialize validation provider
    validationProvider = new ValidationProvider(fhirPathEngine);

    // Register language providers
    registerLanguageProviders(context);

    // Register commands
    registerCommands(context);

    // Register views
    registerViews(context);

    // Set context for when extension is enabled
    vscode.commands.executeCommand('setContext', 'fhirpath:enabled', true);
}

function registerLanguageProviders(context: vscode.ExtensionContext) {
    const fhirPathSelector: vscode.DocumentSelector = { language: 'fhirpath' };

    // Completion provider
    const completionProvider = new CompletionProvider(fhirPathEngine);
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            fhirPathSelector,
            completionProvider,
            '.', '(', ','
        )
    );

    // Hover provider
    const hoverProvider = new HoverProvider(fhirPathEngine);
    context.subscriptions.push(
        vscode.languages.registerHoverProvider(fhirPathSelector, hoverProvider)
    );

    // Signature help provider
    const signatureProvider = new SignatureHelpProvider(fhirPathEngine);
    context.subscriptions.push(
        vscode.languages.registerSignatureHelpProvider(
            fhirPathSelector,
            signatureProvider,
            '(', ','
        )
    );

    // Formatting provider
    const formattingProvider = new FormattingProvider(fhirPathEngine);
    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider(
            fhirPathSelector,
            formattingProvider
        )
    );

    // Symbol provider
    const symbolProvider = new SymbolProvider(fhirPathEngine);
    context.subscriptions.push(
        vscode.languages.registerDocumentSymbolProvider(fhirPathSelector, symbolProvider)
    );

    // Validation (diagnostics)
    context.subscriptions.push(validationProvider);
}

function registerCommands(context: vscode.ExtensionContext) {
    // Evaluate Expression command
    const evaluateCommand = vscode.commands.registerCommand(
        'fhirpath.evaluateExpression',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor');
                return;
            }

            const selection = editor.selection;
            const text = selection.isEmpty
                ? editor.document.getText()
                : editor.document.getText(selection);

            if (!text.trim()) {
                vscode.window.showErrorMessage('No FHIRPath expression to evaluate');
                return;
            }

            try {
                const result = await fhirPathEngine.evaluate(text.trim());
                logInfo(`Expression evaluated successfully: ${text.trim()}`);
                resultsViewProvider.showResults(text.trim(), result);
            } catch (error) {
                logError(`Evaluation error for expression: ${text.trim()}`, error);
                vscode.window.showErrorMessage(`Evaluation error: ${error}`);
            }
        }
    );

    // Validate Expression command
    const validateCommand = vscode.commands.registerCommand(
        'fhirpath.validateExpression',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor');
                return;
            }

            const selection = editor.selection;
            const text = selection.isEmpty
                ? editor.document.getText()
                : editor.document.getText(selection);

            if (!text.trim()) {
                vscode.window.showErrorMessage('No FHIRPath expression to validate');
                return;
            }

            try {
                const isValid = await fhirPathEngine.validate(text.trim());
                if (isValid) {
                    vscode.window.showInformationMessage('FHIRPath expression is valid. Hover over the expression for detailed information.');
                } else {
                    vscode.window.showInformationMessage('FHIRPath expression has validation issues. Hover over the expression to see details and get help.');
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Validation error: ${error}. Hover over the expression for troubleshooting help.`);
            }
        }
    );

    // Show AST command
    const showAstCommand = vscode.commands.registerCommand(
        'fhirpath.showAST',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor');
                return;
            }

            const selection = editor.selection;
            const text = selection.isEmpty
                ? editor.document.getText()
                : editor.document.getText(selection);

            if (!text.trim()) {
                vscode.window.showErrorMessage('No FHIRPath expression to analyze');
                return;
            }

            try {
                const ast = await fhirPathEngine.parseToAst(text.trim());
                astViewProvider.showAst(text.trim(), ast);
            } catch (error) {
                vscode.window.showErrorMessage(`AST parsing error: ${error}`);
            }
        }
    );

    // Format Expression command
    const formatCommand = vscode.commands.registerCommand(
        'fhirpath.formatExpression',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor');
                return;
            }

            const document = editor.document;
            const selection = editor.selection;
            const text = selection.isEmpty
                ? document.getText()
                : document.getText(selection);

            if (!text.trim()) {
                vscode.window.showErrorMessage('No FHIRPath expression to format');
                return;
            }

            try {
                const formatted = await fhirPathEngine.format(text.trim());
                const range = selection.isEmpty
                    ? new vscode.Range(0, 0, document.lineCount, 0)
                    : selection;

                await editor.edit(editBuilder => {
                    editBuilder.replace(range, formatted);
                });
            } catch (error) {
                vscode.window.showErrorMessage(`Formatting error: ${error}`);
            }
        }
    );

    // Set Context command
    const setContextCommand = vscode.commands.registerCommand(
        'fhirpath.setContext',
        async () => {
            const options = [
                'Load from file',
                'Load from FHIR server',
                'Enter JSON manually'
            ];

            const choice = await vscode.window.showQuickPick(options, {
                placeHolder: 'Select how to set the FHIR resource context'
            });

            if (!choice) return;

            try {
                switch (choice) {
                    case 'Load from file':
                        await loadContextFromFile();
                        break;
                    case 'Load from FHIR server':
                        await loadContextFromServer();
                        break;
                    case 'Enter JSON manually':
                        await loadContextManually();
                        break;
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Error setting context: ${error}`);
            }
        }
    );

    // Clear Cache command
    const clearCacheCommand = vscode.commands.registerCommand(
        'fhirpath.clearCache',
        () => {
            fhirPathEngine.clearCache();
            logInfo('FHIRPath cache cleared');
            vscode.window.showInformationMessage('FHIRPath cache cleared');
        }
    );

    // Debug Info command
    const debugInfoCommand = vscode.commands.registerCommand(
        'fhirpath.showDebugInfo',
        () => {
            const debugInfo = {
                extensionVersion: vscode.extensions.getExtension('octofhir.fhirpath-extension')?.packageJSON?.version || 'unknown',
                vscodeVersion: vscode.version,
                platform: process.platform,
                nodeVersion: process.version,
                hasContext: !!fhirPathEngine.getContext(),
                contextType: fhirPathEngine.getContext()?.resourceType || 'none',
                wasmInitialized: 'check console for initialization status',
                timestamp: new Date().toISOString()
            };

            logInfo('Debug information requested', debugInfo);
            outputChannel.show();
            outputChannel.appendLine('=== FHIRPath Extension Debug Information ===');
            outputChannel.appendLine(JSON.stringify(debugInfo, null, 2));
            outputChannel.appendLine('=== End Debug Information ===');

            vscode.window.showInformationMessage('Debug information written to FHIRPath output channel');
        }
    );

    // Show Documentation command
    const showDocumentationCommand = vscode.commands.registerCommand(
        'fhirpath.showDocumentation',
        () => {
            vscode.env.openExternal(vscode.Uri.parse('https://build.fhir.org/ig/HL7/FHIRPath/'));
        }
    );

    // Playground commands
    const playgroundEvaluateCommand = vscode.commands.registerCommand(
        'fhirpath.playground.evaluate',
        () => {
            // The playground handles evaluation internally via webview messages
            vscode.window.showInformationMessage('Use the Evaluate button in the playground view');
        }
    );

    const playgroundClearCommand = vscode.commands.registerCommand(
        'fhirpath.playground.clear',
        () => {
            playgroundViewProvider.clearPlayground();
        }
    );

    const playgroundLoadExampleCommand = vscode.commands.registerCommand(
        'fhirpath.playground.loadExample',
        async () => {
            const examples = ['basic-patient', 'patient-telecom', 'observation-value'];
            const selected = await vscode.window.showQuickPick(examples, {
                placeHolder: 'Select an example to load'
            });
            if (selected) {
                playgroundViewProvider.loadExample(selected);
            }
        }
    );

    const playgroundExportCommand = vscode.commands.registerCommand(
        'fhirpath.playground.export',
        () => {
            // The playground handles export internally via webview messages
            vscode.window.showInformationMessage('Use the Export button in the playground view');
        }
    );

    context.subscriptions.push(
        evaluateCommand,
        validateCommand,
        showAstCommand,
        formatCommand,
        setContextCommand,
        clearCacheCommand,
        debugInfoCommand,
        showDocumentationCommand,
        playgroundEvaluateCommand,
        playgroundClearCommand,
        playgroundLoadExampleCommand,
        playgroundExportCommand
    );
}

function registerViews(context: vscode.ExtensionContext) {
    // Register results view
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'fhirpathResults',
            resultsViewProvider
        )
    );

    // Register AST view
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'fhirpathAst',
            astViewProvider
        )
    );

    // Register explorer view
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider(
            'fhirpathExplorer',
            explorerViewProvider
        )
    );

    // Register playground view
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'fhirpathPlaygroundView',
            playgroundViewProvider
        )
    );
}

async function loadContextFromFile() {
    const fileUri = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: {
            'JSON files': ['json']
        }
    });

    if (fileUri && fileUri[0]) {
        const document = await vscode.workspace.openTextDocument(fileUri[0]);
        const content = document.getText();
        try {
            const resource = JSON.parse(content);
            fhirPathEngine.setContext(resource);
            vscode.window.showInformationMessage('FHIR resource context loaded from file');
        } catch (error) {
            vscode.window.showErrorMessage('Invalid JSON in selected file');
        }
    }
}

async function loadContextFromServer() {
    const config = vscode.workspace.getConfiguration('fhirpath');
    const serverUrl = config.get<string>('server.url');

    if (!serverUrl) {
        vscode.window.showErrorMessage('No FHIR server URL configured. Please set fhirpath.server.url in settings.');
        return;
    }

    const resourceId = await vscode.window.showInputBox({
        prompt: 'Enter resource ID (e.g., Patient/123)',
        placeHolder: 'Patient/123'
    });

    if (resourceId) {
        try {
            const resource = await fhirPathEngine.loadFromServer(serverUrl, resourceId);
            fhirPathEngine.setContext(resource);
            vscode.window.showInformationMessage(`FHIR resource ${resourceId} loaded from server`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load resource from server: ${error}`);
        }
    }
}

async function loadContextManually() {
    const json = await vscode.window.showInputBox({
        prompt: 'Enter FHIR resource JSON',
        placeHolder: '{"resourceType": "Patient", ...}'
    });

    if (json) {
        try {
            const resource = JSON.parse(json);
            fhirPathEngine.setContext(resource);
            vscode.window.showInformationMessage('FHIR resource context set manually');
        } catch (error) {
            vscode.window.showErrorMessage('Invalid JSON format');
        }
    }
}

export function deactivate() {
    if (validationProvider) {
        validationProvider.dispose();
    }
}
