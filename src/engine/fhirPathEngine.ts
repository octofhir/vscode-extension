import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import {FhirPathAst, FhirPathResult, FhirResource} from './types';
import init, {
    evaluate_fhirpath,
    get_expression_ast,
    get_fhirpath_version,
    main,
    validate_fhirpath
} from '@octofhir/fhirpath-wasm';
import wasmUrl from '@octofhir/fhirpath-wasm/pkg/fhirpath_wasm_bg.wasm';

/**
 * FHIRPath engine wrapper that integrates with the fhirpath-wasm library
 */
export class FhirPathEngine {
    private wasmModule: any;
    private currentContext: FhirResource | null = null;
    private cache: Map<string, any> = new Map();
    private isInitialized = false;

    constructor() {
        this.initializeWasm();
    }

    /**
     * Initialize the WASM module
     */
    private async initializeWasm(): Promise<void> {
        const startTime = Date.now();
        console.log('[FHIRPath] Starting WASM module initialization...');

        try {
            // Step 1: Construct a proper file path to the WASM module
            // In VSCode extension context, the WASM file is bundled in the same directory as the compiled JS
            const wasmFileName = String(wasmUrl); // Convert webpack module import to string
            const wasmFilePath = path.join(__dirname, wasmFileName);

            console.log('[FHIRPath] Extension output directory:', __dirname);
            console.log('[FHIRPath] WASM file name:', wasmFileName);
            console.log('[FHIRPath] WASM file path:', wasmFilePath);

            // Check if a WASM file exists
            if (!fs.existsSync(wasmFilePath)) {
                throw new Error(`WASM file not found at path: ${wasmFilePath}`);
            }

            // Step 2: Read WASM file as bytes and initialize the module
            // This avoids the fetch/file:// URL issue by passing the bytes directly
            console.log('[FHIRPath] Reading WASM file as bytes...');
            const wasmBytes = fs.readFileSync(wasmFilePath);
            console.log('[FHIRPath] WASM file read successfully, size:', wasmBytes.length, 'bytes');

            console.log('[FHIRPath] Initializing WASM module with bytes...');
            await init(wasmBytes);
            console.log('[FHIRPath] WASM module loaded successfully');

            // Step 3: Initialize panic hook for better error messages
            console.log('[FHIRPath] Initializing panic hook...');
            main();
            console.log('[FHIRPath] Panic hook initialized');

            // Step 4: Test WASM functions availability
            console.log('[FHIRPath] Testing WASM function availability...');
            const version = get_fhirpath_version();
            console.log('[FHIRPath] FHIRPath version:', version);

            // Step 5: Create wrapper functions for the WASM API
            console.log('[FHIRPath] Creating WASM API wrappers...');
            this.wasmModule = {
                parse: (expression: string) => {
                    const result = get_expression_ast(expression);
                    return JSON.parse(result);
                },
                evaluate: (expression: string, context: any) => {
                    const contextJson = JSON.stringify(context);
                    const result = evaluate_fhirpath(expression, contextJson);
                    return JSON.parse(result);
                },
                validate: (expression: string) => {
                    const result = validate_fhirpath(expression);
                    const validation = JSON.parse(result);
                    return validation.valid || false;
                },
                format: (expression: string) => {
                    // For now, return the expression as-is since WASM doesn't have a format function
                    // This could be enhanced later with a proper formatter
                    return expression.trim();
                },
                getVersion: () => {
                    return get_fhirpath_version();
                }
            };

            this.isInitialized = true;
            const initTime = Date.now() - startTime;
            console.log(`[FHIRPath] WASM module initialized successfully in ${initTime}ms`);

        } catch (error) {
            const initTime = Date.now() - startTime;
            const errorDetails = this.analyzeInitializationError(error, initTime);

            console.error('[FHIRPath] Failed to initialize WASM module:', errorDetails);

            // Show detailed error message to user
            const userMessage = this.formatUserErrorMessage(errorDetails);
            vscode.window.showErrorMessage(userMessage, 'Show Details', 'Troubleshooting Guide')
                .then(selection => {
                    if (selection === 'Show Details') {
                        this.showDetailedErrorInfo(errorDetails);
                    } else if (selection === 'Troubleshooting Guide') {
                        this.showTroubleshootingGuide();
                    }
                });

            this.isInitialized = false;
            this.wasmModule = undefined;
            throw error;
        }
    }

    /**
     * Analyze initialization error and provide detailed diagnostic information
     */
    private analyzeInitializationError(error: any, initTime: number): any {
        const errorDetails = {
            timestamp: new Date().toISOString(),
            initTime,
            originalError: error,
            errorType: 'unknown',
            category: 'initialization',
            message: error?.message || 'Unknown error',
            stack: error?.stack,
            systemInfo: {
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.version,
                vsCodeVersion: vscode.version,
                extensionVersion: '0.1.0'
            },
            diagnostics: {
                wasmSupported: typeof (globalThis as any).WebAssembly !== 'undefined',
                wasmInstantiateSupported: typeof (globalThis as any).WebAssembly?.instantiate === 'function',
                fetchSupported: typeof fetch !== 'undefined'
            }
        };

        // Categorize error types
        if (error?.message?.includes('fetch')) {
            errorDetails.errorType = 'network';
            errorDetails.category = 'wasm_loading';
        } else if (error?.message?.includes('WebAssembly')) {
            errorDetails.errorType = 'wasm_instantiation';
            errorDetails.category = 'wasm_loading';
        } else if (error?.message?.includes('import')) {
            errorDetails.errorType = 'module_import';
            errorDetails.category = 'dependency';
        } else if (error?.name === 'TypeError') {
            errorDetails.errorType = 'type_error';
            errorDetails.category = 'function_binding';
        } else if (error?.name === 'ReferenceError') {
            errorDetails.errorType = 'reference_error';
            errorDetails.category = 'function_binding';
        }

        return errorDetails;
    }

    /**
     * Format user-friendly error message
     */
    private formatUserErrorMessage(errorDetails: any): string {
        const baseMessage = 'Failed to initialize FHIRPath engine';

        switch (errorDetails.errorType) {
            case 'network':
                return `${baseMessage}: Network error while loading WASM module. Check your internet connection and firewall settings.`;
            case 'wasm_instantiation':
                return `${baseMessage}: WebAssembly instantiation failed. Your environment may not support WebAssembly.`;
            case 'module_import':
                return `${baseMessage}: Module import error. The FHIRPath WASM package may be corrupted or missing.`;
            case 'type_error':
                return `${baseMessage}: Function binding error. The WASM module interface may be incompatible.`;
            case 'reference_error':
                return `${baseMessage}: Missing function reference. The WASM module may not be properly exported.`;
            default:
                return `${baseMessage}: ${errorDetails.message}`;
        }
    }

    /**
     * Show detailed error information in a new document
     */
    private async showDetailedErrorInfo(errorDetails: any): Promise<void> {
        const content = `FHIRPath Engine Initialization Error Report
Generated: ${errorDetails.timestamp}

ERROR SUMMARY
=============
Type: ${errorDetails.errorType}
Category: ${errorDetails.category}
Message: ${errorDetails.message}
Initialization Time: ${errorDetails.initTime}ms

SYSTEM INFORMATION
==================
Platform: ${errorDetails.systemInfo.platform}
Architecture: ${errorDetails.systemInfo.arch}
Node.js Version: ${errorDetails.systemInfo.nodeVersion}
VS Code Version: ${errorDetails.systemInfo.vsCodeVersion}
Extension Version: ${errorDetails.systemInfo.extensionVersion}

DIAGNOSTICS
===========
WebAssembly Supported: ${errorDetails.diagnostics.wasmSupported}
WebAssembly.instantiate Available: ${errorDetails.diagnostics.wasmInstantiateSupported}
Fetch API Available: ${errorDetails.diagnostics.fetchSupported}

ORIGINAL ERROR
==============
${errorDetails.originalError}

STACK TRACE
===========
${errorDetails.stack || 'No stack trace available'}

TROUBLESHOOTING STEPS
====================
1. Restart VS Code and try again
2. Check if your VS Code version supports WebAssembly
3. Verify internet connection for downloading WASM modules
4. Check VS Code extension logs for additional details
5. Try disabling other extensions that might conflict
6. Report this issue with the above details if problem persists
`;

        const doc = await vscode.workspace.openTextDocument({
            content,
            language: 'plaintext'
        });
        await vscode.window.showTextDocument(doc);
    }

    /**
     * Show troubleshooting guide
     */
    private async showTroubleshootingGuide(): Promise<void> {
        const content = `FHIRPath Extension Troubleshooting Guide

COMMON ISSUES AND SOLUTIONS
===========================

1. WASM Module Loading Errors
   - Ensure VS Code version 1.74.0 or higher
   - Check internet connection for initial WASM download
   - Restart VS Code to clear any cached modules
   - Try disabling other extensions temporarily

2. WebAssembly Not Supported
   - Update VS Code to the latest version
   - Check if running in a restricted environment
   - Verify WebAssembly support in your system

3. Network/Firewall Issues
   - Check corporate firewall settings
   - Verify proxy configuration in VS Code
   - Try using VS Code in a different network environment

4. Extension Conflicts
   - Disable other FHIR or healthcare-related extensions
   - Check for extensions that modify WebAssembly behavior
   - Try running VS Code with extensions disabled

5. Performance Issues
   - Close unnecessary VS Code windows
   - Increase VS Code memory limits if needed
   - Check system resources (RAM, CPU)

GETTING HELP
============
If none of these solutions work:

1. Check the VS Code Developer Console (Help > Toggle Developer Tools)
2. Look for additional error messages in the console
3. Report the issue with:
   - Your system information
   - VS Code version
   - Complete error message
   - Steps to reproduce

For more help, visit:
- Extension documentation
- GitHub issues page
- VS Code troubleshooting guide
`;

        const doc = await vscode.workspace.openTextDocument({
            content,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(doc);
    }

    /**
     * Show FHIRPath expression help and syntax guide
     */
    private async showExpressionHelp(): Promise<void> {
        const content = `FHIRPath Expression Syntax Guide

BASIC SYNTAX
============

1. Simple Path Navigation
   - patient.name          # Access name property
   - patient.name.given    # Access nested property
   - patient.name[0]       # Access first element in array

2. Functions
   - patient.name.exists()           # Check if property exists
   - patient.name.empty()            # Check if property is empty
   - patient.name.count()            # Count elements
   - patient.name.first()            # Get first element
   - patient.name.last()             # Get last element

3. Filtering
   - patient.name.where(use = 'official')    # Filter by condition
   - patient.telecom.where(system = 'phone') # Filter telecom entries

4. Boolean Operations
   - patient.active = true           # Equality check
   - patient.birthDate < @2000-01-01 # Date comparison
   - patient.name.exists() and patient.active = true  # Logical AND

5. String Operations
   - patient.name.family.startsWith('Sm')    # String starts with
   - patient.name.family.contains('ith')     # String contains
   - patient.name.family.length()           # String length

COMMON PATTERNS
===============

Patient Information:
- patient.id                    # Patient ID
- patient.name.family           # Family name
- patient.name.given            # Given names
- patient.birthDate             # Birth date
- patient.gender                # Gender

Contact Information:
- patient.telecom.where(system='phone').value    # Phone number
- patient.telecom.where(system='email').value    # Email address

Address:
- patient.address.line          # Address lines
- patient.address.city          # City
- patient.address.postalCode    # Postal code

TROUBLESHOOTING
===============

Common Errors:
1. "Property not found" - Check spelling and case sensitivity
2. "Invalid syntax" - Check parentheses and quotes
3. "Type mismatch" - Ensure correct data types in comparisons

Tips:
- Use single quotes for string literals: 'value'
- Use @ prefix for date literals: @2023-01-01
- Check the FHIR specification for correct property names
- Test expressions step by step from simple to complex

For more information, visit the FHIRPath specification:
https://build.fhir.org/ig/HL7/FHIRPath/
`;

        const doc = await vscode.workspace.openTextDocument({
            content,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(doc);
    }

    /**
     * Show FHIR resource context help and examples
     */
    private async showContextHelp(): Promise<void> {
        const content = `FHIR Resource Context Guide

WHAT IS CONTEXT?
================
The context is the FHIR resource that FHIRPath expressions are evaluated against.
Without a context, expressions cannot be evaluated.

SETTING CONTEXT
===============
You can set context in several ways:

1. Using the Command Palette:
   - Press Ctrl+Shift+P (Cmd+Shift+P on Mac)
   - Type "FHIRPath: Set FHIR Resource Context"
   - Paste your FHIR resource JSON

2. Using the FHIRPath Playground:
   - Open the FHIRPath Playground from the Activity Bar
   - Load an example resource or paste your own
   - The context will be automatically set

3. Loading from a FHIR Server:
   - Configure server settings in VS Code preferences
   - Use "Load from Server" commands to fetch resources

EXAMPLE CONTEXTS
================

Patient Resource:
\`\`\`json
{
  "resourceType": "Patient",
  "id": "example-patient",
  "name": [
    {
      "use": "official",
      "family": "Doe",
      "given": ["John", "Michael"]
    }
  ],
  "gender": "male",
  "birthDate": "1990-01-01",
  "active": true,
  "telecom": [
    {
      "system": "phone",
      "value": "+1-555-123-4567",
      "use": "home"
    },
    {
      "system": "email",
      "value": "john.doe@example.com",
      "use": "home"
    }
  ]
}
\`\`\`

Observation Resource:
\`\`\`json
{
  "resourceType": "Observation",
  "id": "example-observation",
  "status": "final",
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "29463-7",
        "display": "Body Weight"
      }
    ]
  },
  "subject": {
    "reference": "Patient/example-patient"
  },
  "valueQuantity": {
    "value": 70,
    "unit": "kg",
    "system": "http://unitsofmeasure.org",
    "code": "kg"
  }
}
\`\`\`

TESTING EXPRESSIONS
===================
Once you have a context set, you can test expressions like:

For Patient context:
- id                           # Returns "example-patient"
- name.family                  # Returns ["Doe"]
- name.given                   # Returns [["John", "Michael"]]
- telecom.where(system='phone').value  # Returns ["+1-555-123-4567"]

For Observation context:
- status                       # Returns "final"
- code.coding.display          # Returns ["Body Weight"]
- valueQuantity.value          # Returns 70

TROUBLESHOOTING
===============
- Make sure your JSON is valid FHIR format
- Check that resourceType is specified
- Verify property names match FHIR specification
- Use the FHIRPath Playground to test expressions interactively

For more information about FHIR resources:
https://www.hl7.org/fhir/resourcelist.html
`;

        const doc = await vscode.workspace.openTextDocument({
            content,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(doc);
    }

    /**
     * Ensure the WASM module is initialized
     */
    private async ensureInitialized(): Promise<void> {
        if (!this.isInitialized) {
            await this.initializeWasm();
        }
    }

    /**
     * Set the current FHIR resource context
     */
    setContext(resource: FhirResource): void {
        this.currentContext = resource;
        this.clearCache(); // Clear cache when context changes
    }

    /**
     * Get the current FHIR resource context
     */
    getContext(): FhirResource | null {
        return this.currentContext;
    }

    /**
     * Parse a FHIRPath expression and return the AST
     */
    async parseToAst(expression: string): Promise<FhirPathAst> {
        console.log(`[FHIRPath] Parsing expression: "${expression}"`);

        try {
            await this.ensureInitialized();
        } catch (error) {
            const errorMsg = 'FHIRPath engine is not initialized. Please check the error details and try restarting VS Code.';
            console.error('[FHIRPath] Parse failed - engine not initialized:', error);
            vscode.window.showErrorMessage(errorMsg, 'Show Troubleshooting Guide')
                .then(selection => {
                    if (selection === 'Show Troubleshooting Guide') {
                        this.showTroubleshootingGuide();
                    }
                });
            throw new Error(errorMsg);
        }

        if (!this.wasmModule) {
            const errorMsg = 'FHIRPath WASM module is not available. The engine failed to initialize properly.';
            console.error('[FHIRPath] Parse failed - WASM module not available');
            vscode.window.showErrorMessage(errorMsg, 'Retry Initialization', 'Show Troubleshooting Guide')
                .then(selection => {
                    if (selection === 'Retry Initialization') {
                        this.initializeWasm();
                    } else if (selection === 'Show Troubleshooting Guide') {
                        this.showTroubleshootingGuide();
                    }
                });
            throw new Error(errorMsg);
        }

        const cacheKey = `ast:${expression}`;
        if (this.cache.has(cacheKey)) {
            console.log('[FHIRPath] Using cached AST result');
            return this.cache.get(cacheKey);
        }

        try {
            const ast = this.wasmModule.parse(expression);
            this.cache.set(cacheKey, ast);
            console.log('[FHIRPath] Expression parsed successfully');
            return ast;
        } catch (error) {
            const errorMsg = `Failed to parse FHIRPath expression "${expression}": ${error}`;
            console.error('[FHIRPath] Parse error:', error);
            // Parse errors are now shown as inline diagnostics in the editor instead of popup messages
            throw new Error(errorMsg);
        }
    }

    /**
     * Validate a FHIRPath expression
     */
    async validate(expression: string): Promise<boolean> {
        console.log(`[FHIRPath] Validating expression: "${expression}"`);

        try {
            await this.ensureInitialized();
        } catch (error) {
            const errorMsg = 'FHIRPath engine is not initialized. Cannot validate expression.';
            console.error('[FHIRPath] Validation failed - engine not initialized:', error);
            vscode.window.showErrorMessage(errorMsg, 'Show Troubleshooting Guide')
                .then(selection => {
                    if (selection === 'Show Troubleshooting Guide') {
                        this.showTroubleshootingGuide();
                    }
                });
            return false;
        }

        if (!this.wasmModule) {
            const errorMsg = 'FHIRPath WASM module is not available. Cannot validate expression.';
            console.error('[FHIRPath] Validation failed - WASM module not available');
            vscode.window.showErrorMessage(errorMsg, 'Retry Initialization', 'Show Troubleshooting Guide')
                .then(selection => {
                    if (selection === 'Retry Initialization') {
                        this.initializeWasm();
                    } else if (selection === 'Show Troubleshooting Guide') {
                        this.showTroubleshootingGuide();
                    }
                });
            return false;
        }

        const cacheKey = `validate:${expression}`;
        if (this.cache.has(cacheKey)) {
            console.log('[FHIRPath] Using cached validation result');
            return this.cache.get(cacheKey);
        }

        try {
            const isValid = this.wasmModule.validate(expression);
            this.cache.set(cacheKey, isValid);
            console.log(`[FHIRPath] Expression validation result: ${isValid}`);

            // Validation result is now shown via hover instead of warning messages

            return isValid;
        } catch (error) {
            console.error('[FHIRPath] Validation error:', error);
            // Validation errors are now shown as inline diagnostics in the editor instead of popup messages
            return false;
        }
    }

    /**
     * Evaluate a FHIRPath expression against the current context
     */
    async evaluate(expression: string, context?: FhirResource): Promise<FhirPathResult> {
        console.log(`[FHIRPath] Evaluating expression: "${expression}"`);

        try {
            await this.ensureInitialized();
        } catch (error) {
            const errorMsg = 'FHIRPath engine is not initialized. Cannot evaluate expression.';
            console.error('[FHIRPath] Evaluation failed - engine not initialized:', error);
            vscode.window.showErrorMessage(errorMsg, 'Show Troubleshooting Guide')
                .then(selection => {
                    if (selection === 'Show Troubleshooting Guide') {
                        this.showTroubleshootingGuide();
                    }
                });
            throw new Error(errorMsg);
        }

        if (!this.wasmModule) {
            const errorMsg = 'FHIRPath WASM module is not available. Cannot evaluate expression.';
            console.error('[FHIRPath] Evaluation failed - WASM module not available');
            vscode.window.showErrorMessage(errorMsg, 'Retry Initialization', 'Show Troubleshooting Guide')
                .then(selection => {
                    if (selection === 'Retry Initialization') {
                        this.initializeWasm();
                    } else if (selection === 'Show Troubleshooting Guide') {
                        this.showTroubleshootingGuide();
                    }
                });
            throw new Error(errorMsg);
        }

        const evaluationContext = context || this.currentContext;
        if (!evaluationContext) {
            const errorMsg = 'No FHIR resource context available. Please set a context first.';
            console.error('[FHIRPath] Evaluation failed - no context available');
            vscode.window.showErrorMessage(errorMsg, 'Set Context', 'Show Context Help')
                .then(selection => {
                    if (selection === 'Set Context') {
                        vscode.commands.executeCommand('fhirpath.setContext');
                    } else if (selection === 'Show Context Help') {
                        this.showContextHelp();
                    }
                });
            throw new Error(errorMsg);
        }

        console.log(`[FHIRPath] Using context: ${evaluationContext.resourceType || 'Unknown'} (${evaluationContext.id || 'no ID'})`);

        const cacheKey = `eval:${expression}:${JSON.stringify(evaluationContext)}`;
        if (this.cache.has(cacheKey)) {
            console.log('[FHIRPath] Using cached evaluation result');
            return this.cache.get(cacheKey);
        }

        try {
            const startTime = Date.now();
            const result = this.wasmModule.evaluate(expression, evaluationContext);
            const evalTime = Date.now() - startTime;

            this.cache.set(cacheKey, result);
            console.log(`[FHIRPath] Expression evaluated successfully in ${evalTime}ms`);
            console.log(`[FHIRPath] Result: ${JSON.stringify(result).substring(0, 200)}${JSON.stringify(result).length > 200 ? '...' : ''}`);

            return result;
        } catch (error) {
            const errorMsg = `Failed to evaluate FHIRPath expression "${expression}": ${error}`;
            console.error('[FHIRPath] Evaluation error:', error);
            vscode.window.showErrorMessage(`Evaluation Error: ${error}`, 'Show Expression Help', 'Show Context Help')
                .then(selection => {
                    if (selection === 'Show Expression Help') {
                        this.showExpressionHelp();
                    } else if (selection === 'Show Context Help') {
                        this.showContextHelp();
                    }
                });
            throw new Error(errorMsg);
        }
    }

    /**
     * Format a FHIRPath expression
     */
    async format(expression: string): Promise<string> {
        await this.ensureInitialized();

        if (!this.wasmModule) {
            throw new Error('FHIRPath WASM module is not initialized. Please check the console for initialization errors.');
        }

        const cacheKey = `format:${expression}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const formatted = this.wasmModule.format(expression);
            this.cache.set(cacheKey, formatted);
            return formatted;
        } catch (error) {
            throw new Error(`Failed to format FHIRPath expression: ${error}`);
        }
    }

    /**
     * Load a FHIR resource from a server
     */
    async loadFromServer(serverUrl: string, resourceId: string): Promise<FhirResource> {
        const config = vscode.workspace.getConfiguration('fhirpath');
        const auth = config.get<any>('server.auth');

        const url = `${serverUrl.replace(/\/$/, '')}/${resourceId}`;
        const headers: Record<string, string> = {
            'Accept': 'application/fhir+json'
        };

        // Add authentication if configured
        if (auth && auth.type === 'bearer' && auth.token) {
            headers['Authorization'] = `Bearer ${auth.token}`;
        } else if (auth && auth.type === 'basic' && auth.username && auth.password) {
            const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
            headers['Authorization'] = `Basic ${credentials}`;
        }

        try {
            const resource = await this.makeHttpRequest(url, headers);
            return resource;
        } catch (error) {
            throw new Error(`Failed to load resource from server: ${error}`);
        }
    }

    /**
     * Make HTTP request using Node.js built-in modules
     */
    private makeHttpRequest(url: string, headers: Record<string, string>): Promise<any> {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const isHttps = urlObj.protocol === 'https:';
            const httpModule = isHttps ? https : http;

            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: 'GET',
                headers: headers
            };

            const req = httpModule.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            const jsonData = JSON.parse(data);
                            resolve(jsonData);
                        } catch (parseError) {
                            reject(new Error(`Failed to parse JSON response: ${parseError}`));
                        }
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.end();
        });
    }

    /**
     * Get function documentation
     */
    getFunctionDocumentation(functionName: string): string | null {
        const docs = this.getFunctionDocs();
        return docs[functionName] || null;
    }

    /**
     * Get all available functions
     */
    getAvailableFunctions(): string[] {
        return Object.keys(this.getFunctionDocs());
    }

    /**
     * Clear the cache
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }

    /**
     * Get the FHIRPath specification version from the WASM module
     */
    async getVersion(): Promise<string> {
        await this.ensureInitialized();
        return this.wasmModule.getVersion();
    }

    private getFunctionDocs(): Record<string, string> {
        return {
            'empty': 'Returns true if the input collection is empty ({ }) and false otherwise.',
            'exists': 'Returns true if the collection has any elements, and false otherwise.',
            'count': 'Returns the integer count of the number of items in the input collection.',
            'length': 'Returns the length of the input string.',
            'toString': 'Converts the input to a string representation.',
            'toInteger': 'Converts the input to an integer.',
            'toDecimal': 'Converts the input to a decimal.',
            'toBoolean': 'Converts the input to a boolean.',
            'toDateTime': 'Converts the input to a dateTime.',
            'toDate': 'Converts the input to a date.',
            'toTime': 'Converts the input to a time.',
            'convertsToString': 'Returns true if the input can be converted to a string.',
            'convertsToInteger': 'Returns true if the input can be converted to an integer.',
            'convertsToDecimal': 'Returns true if the input can be converted to a decimal.',
            'convertsToBoolean': 'Returns true if the input can be converted to a boolean.',
            'convertsToDateTime': 'Returns true if the input can be converted to a dateTime.',
            'convertsToDate': 'Returns true if the input can be converted to a date.',
            'convertsToTime': 'Returns true if the input can be converted to a time.',
            'first': 'Returns the first item in a collection.',
            'last': 'Returns the last item in a collection.',
            'tail': 'Returns all but the first item in a collection.',
            'skip': 'Returns all but the first num items in a collection.',
            'take': 'Returns the first num items in a collection.',
            'intersect': 'Returns the intersection of two collections.',
            'exclude': 'Returns the set difference between two collections.',
            'union': 'Returns the union of two collections.',
            'combine': 'Merges the input and other collections into a single collection.',
            'distinct': 'Returns a collection with only the unique items from the input collection.',
            'isDistinct': 'Returns true if all items in the collection are distinct.',
            'subsetOf': 'Returns true if the input collection is a subset of the other collection.',
            'supersetOf': 'Returns true if the input collection is a superset of the other collection.',
            'where': 'Returns a collection containing only those elements for which the criteria expression evaluates to true.',
            'select': 'Evaluates the projection expression for each item in the input collection.',
            'repeat': 'Repeatedly applies the projection expression to the input collection.',
            'ofType': 'Returns a collection that contains all items in the input collection that are of the given type.',
            'as': 'Returns the input collection if it is of the specified type, otherwise returns empty.',
            'is': 'Returns true if the input collection is of the specified type.',
            'single': 'Returns the single item in the input collection.',
            'all': 'Returns true if the criteria expression evaluates to true for all items in the input collection.',
            'allTrue': 'Returns true if all items in the input collection are true.',
            'anyTrue': 'Returns true if any item in the input collection is true.',
            'allFalse': 'Returns true if all items in the input collection are false.',
            'anyFalse': 'Returns true if any item in the input collection is false.',
            'contains': 'Returns true if the input string contains the given substring.',
            'indexOf': 'Returns the 0-based index of the first occurrence of the given substring in the input string.',
            'substring': 'Returns the part of the input string starting at position start.',
            'startsWith': 'Returns true if the input string starts with the given prefix.',
            'endsWith': 'Returns true if the input string ends with the given suffix.',
            'matches': 'Returns true if the input string matches the given regular expression.',
            'replaceMatches': 'Replaces each substring of the input string that matches the given regular expression.',
            'replace': 'Replaces each occurrence of the given substring in the input string.',
            'split': 'Splits the input string around matches of the given separator.',
            'join': 'Joins a collection of strings with the given separator.',
            'lower': 'Converts the input string to lowercase.',
            'upper': 'Converts the input string to uppercase.',
            'toChars': 'Converts the input string to a collection of single-character strings.',
            'abs': 'Returns the absolute value of the input.',
            'ceiling': 'Returns the smallest integer greater than or equal to the input.',
            'exp': 'Returns e raised to the power of the input.',
            'floor': 'Returns the largest integer less than or equal to the input.',
            'ln': 'Returns the natural logarithm of the input.',
            'log': 'Returns the logarithm base 10 of the input.',
            'power': 'Raises the input to the power of the exponent.',
            'round': 'Rounds the input to the nearest integer.',
            'sqrt': 'Returns the square root of the input.',
            'truncate': 'Returns the integer part of the input.'
        };
    }
}
