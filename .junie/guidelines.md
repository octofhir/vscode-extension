# FHIRPath VSCode Extension - Development Guidelines

## Build & Configuration

### Prerequisites
- **Node.js 20+** - Required for development
- **npm** - Package manager (not pnpm/yarn)
- **VSCode 1.74.0+** - For testing the extension

### WebAssembly Integration
This extension uses `@octofhir/fhirpath-wasm` which requires specific webpack configuration:

```javascript
// webpack.config.js key settings
experiments: {
  asyncWebAssembly: true,
  syncWebAssembly: true
}
```

The WASM module must be properly initialized before use. Check `src/engine/fhirPathEngine.ts` for initialization patterns.

### Build Process
- **Development**: `pnpm run watch` - Webpack in development mode with file watching
- **Production**: `pnpm run compile` - Webpack in production mode for packaging
- **Packaging**: `pnpm run package` - Creates VSIX file using @vscode/vsce

### TypeScript Configuration
- **Target**: ES2020 with CommonJS modules
- **Strict mode**: Enabled with all strict checks
- **Source maps**: Generated for debugging
- **Declarations**: Generated for type checking

## Architecture Patterns

### Modular Structure
```
src/
├── extension.ts          # Main entry point & activation
├── engine/              # FHIRPath WASM engine wrapper
├── language/            # Language service providers
└── views/               # Custom VSCode views
```

### Language Service Providers
All language features are implemented as separate providers:
- `CompletionProvider` - Autocompletion
- `HoverProvider` - Hover information
- `SignatureHelpProvider` - Function signatures
- `FormattingProvider` - Code formatting
- `ValidationProvider` - Live validation
- `SymbolProvider` - Symbol navigation

### Custom Views
- `ResultsViewProvider` - Expression evaluation results
- `AstViewProvider` - AST visualization
- `ExplorerViewProvider` - Resource exploration
- `PlaygroundViewProvider` - Interactive playground

### Extension Activation
The extension registers all providers and commands in the `activate()` function. Key registration functions:
- `registerLanguageProviders()` - Language service providers
- `registerCommands()` - Command palette commands
- `registerViews()` - Custom view providers

## Development Practices

### Code Style
- **Linter**: Biome (using default configuration)
- **Formatting**: Biome handles both linting and formatting
- **Run linting**: `nnpm run lint`

### Error Handling
The extension has comprehensive error handling with multiple logging levels:
- User-facing notifications for critical errors
- Console logging for detailed debugging
- Extension Host logs for system-level issues
- Dedicated FHIRPath output channel

### WASM Module Considerations
- Always check WASM module initialization before use
- Handle async initialization properly
- Provide fallback error messages for WASM failures
- Test WASM functionality across different platforms

### Configuration Management
Extension settings are defined in `package.json` under `contributes.configuration`. Key patterns:
- Use descriptive setting names with `fhirpath.` prefix
- Provide sensible defaults
- Include detailed descriptions for user settings

### Command Implementation
Commands follow a consistent pattern:
1. Validate preconditions (active editor, WASM initialization)
2. Get current context (selection, document, etc.)
3. Execute operation with error handling
4. Display results or errors to user
5. Log operation for debugging

### View Provider Pattern
Custom views implement the `vscode.WebviewViewProvider` interface:
- Handle view resolution and updates
- Manage webview content and messaging
- Implement proper disposal and cleanup

## Debugging

### VSCode Extension Development
1. Open project in VSCode
2. Press F5 to launch Extension Development Host
3. Test extension functionality in the new window
4. Use Developer Tools for console debugging

### WASM Debugging
- Check browser/VSCode WebAssembly support
- Verify WASM files are properly bundled
- Monitor WASM module initialization in console
- Test WASM functionality with simple expressions first

### Common Issues
- **WASM not loading**: Check webpack WASM configuration
- **Extension not activating**: Verify activation events in package.json
- **Language features not working**: Check provider registration
- **Performance issues**: Monitor WASM memory usage and evaluation timeouts

## Dependencies

### Critical Dependencies
- `@octofhir/fhirpath-wasm` - Core FHIRPath evaluation engine
- `vscode-languageclient/server` - Language server protocol implementation

### Build Dependencies
- `webpack` + `ts-loader` - TypeScript compilation and bundling
- `@vscode/vsce` - Extension packaging
- `@biomejs/biome` - Linting and formatting

## Release Process

1. Update version in `package.json`
3. Run `npm run package` to create VSIX
4. Test VSIX installation manually
5. Publish to VSCode Marketplace using vsce

## Performance Considerations

- **WASM Initialization**: Cache initialized module, don't reinitialize
- **Expression Evaluation**: Implement timeouts (default 5000ms)
- **AST Visualization**: Limit depth to prevent UI freezing
- **Live Validation**: Debounce validation requests
- **Memory Management**: Properly dispose of WASM resources

## Security Notes

- WASM module runs in sandboxed environment
- Validate all user inputs before passing to WASM
- Sanitize FHIR server URLs and authentication data
- Be cautious with eval-like operations in webviews
