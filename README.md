# FHIRPath VSCode Extension

A comprehensive Visual Studio Code extension that provides full support for FHIRPath expressions with syntax highlighting, validation, evaluation, and debugging capabilities.

## Features

### 🎨 Syntax Highlighting
- **Dedicated FHIRPath files**: Full syntax highlighting for `.fhirpath` files
- **Embedded expressions**: Syntax highlighting for FHIRPath expressions in:
  - JSON files (in string literals)
  - JavaScript/TypeScript files (in string literals)
  - YAML files (in string values)
  - XML files (in attribute values and text content)
  - FSH files (FHIR Shorthand, in expression rules)

### ✅ Validation & Error Checking
- **Real-time validation**: Validate expressions as you type
- **Diagnostics integration**: Errors and warnings appear in the Problems panel
- **Contextual error messages**: Clear, specific error messages with FHIRPath specification references

### 🚀 Expression Evaluation
- **Context-aware evaluation**: Evaluate expressions against:
  - Active FHIR resource documents
  - User-provided FHIR resources
  - Resources fetched from configured FHIR servers
- **Result visualization**: View results in formatted JSON, table view, or resource explorer
- **Performance metrics**: Optional execution time and memory usage display

### 🌳 AST Visualization
- **Interactive AST view**: Visual representation of the Abstract Syntax Tree
- **Node inspection**: Detailed information for each AST node
- **Export capabilities**: Export AST as JSON, DOT, or SVG formats

### 💡 IntelliSense
- **Autocompletion**: Context-aware suggestions for FHIRPath functions and resource properties
- **Hover information**: Documentation for functions, operators, and resource properties
- **Signature help**: Function signatures with parameter information
- **Code snippets**: Pre-defined snippets for common FHIRPath patterns

### 🎮 Interactive Playground
- **Sidebar playground**: Dedicated playground view accessible from the activity bar
- **Live evaluation**: Test FHIRPath expressions against FHIR resources in real-time
- **Built-in examples**: Pre-loaded examples for common use cases (Patient, Observation, etc.)
- **Export results**: Export evaluation results in JSON, CSV, or text formats
- **Keyboard shortcuts**: Ctrl+Enter to evaluate, Ctrl+K to clear

### 🔧 Developer Tools
- **Code formatting**: Format FHIRPath expressions according to best practices
- **Go to definition**: Navigate to resource definitions
- **Find references**: Discover where expressions are used
- **Symbol navigation**: Quick navigation through complex expressions

## Installation

### From VSCode Marketplace
1. Open VSCode
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "FHIRPath"
4. Click "Install"

### From VSIX Package
1. Download the `.vsix` file from the releases page
2. Open VSCode
3. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
4. Click the "..." menu and select "Install from VSIX..."
5. Select the downloaded `.vsix` file

## Quick Start

### 1. Create a FHIRPath File
Create a new file with the `.fhirpath` extension:

```fhirpath
// Basic property access
Patient.name.given

// Function usage
Patient.name.where(use = 'official').family

// Complex expressions
Patient.contact.where(relationship.coding.exists(system = 'http://terminology.hl7.org/CodeSystem/v2-0131' and code = 'C')).telecom.where(system = 'phone').value
```

### 2. Set FHIR Resource Context
Use the command palette (Ctrl+Shift+P / Cmd+Shift+P) and run:
- `FHIRPath: Set FHIR Resource Context`

Or configure a default context in settings:
```json
{
  "fhirpath.defaultContext": "{\"resourceType\": \"Patient\", \"id\": \"example\"}"
}
```

### 3. Evaluate Expressions

#### Using the Playground
1. **Open the playground**: Click the play icon (▶️) in the activity bar on the left
2. **Enter your expression**: Type a FHIRPath expression in the top text area
3. **Add FHIR context**: Paste a FHIR resource JSON in the middle text area
4. **Evaluate**: Click the "Evaluate" button or press Ctrl+Enter
5. **View results**: See the results in the bottom panel with execution time

#### Using File-based Evaluation
- **Right-click** in a FHIRPath file and select "Evaluate FHIRPath Expression"
- Use **Ctrl+Shift+P** and run "FHIRPath: Evaluate Expression"
- Results appear in the FHIRPath Results panel

## Commands

| Command | Description | Shortcut |
|---------|-------------|----------|
| `FHIRPath: Evaluate Expression` | Evaluate the selected or current expression | - |
| `FHIRPath: Validate Expression` | Validate the selected or current expression | - |
| `FHIRPath: Show AST` | Display the AST for the current expression | - |
| `FHIRPath: Format Expression` | Format the current expression | - |
| `FHIRPath: Set Context` | Set the current FHIR resource context | - |
| `FHIRPath: Clear Cache` | Clear cached evaluation results | - |
| `FHIRPath: Show Documentation` | Show documentation for the current element | - |
| `FHIRPath Playground: Evaluate Expression` | Evaluate expression in playground | - |
| `FHIRPath Playground: Clear Playground` | Clear all playground content | - |
| `FHIRPath Playground: Load Example` | Load a pre-built example | - |
| `FHIRPath Playground: Export Results` | Export playground results | - |

## Configuration

### Extension Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `fhirpath.defaultContext` | Default FHIR resource for evaluation | `""` |
| `fhirpath.server.url` | FHIR server URL for fetching resources | `""` |
| `fhirpath.server.auth` | Authentication settings for FHIR server | `{}` |
| `fhirpath.formatting.style` | Formatting style (`compact` or `readable`) | `"readable"` |
| `fhirpath.evaluation.timeout` | Evaluation timeout in milliseconds | `5000` |
| `fhirpath.highlighting.enabled` | Enable/disable syntax highlighting | `true` |
| `fhirpath.highlighting.fileTypes` | File types for FHIRPath highlighting | `["json", "javascript", "typescript", "yaml", "xml", "fsh"]` |
| `fhirpath.validation.liveValidation` | Enable/disable live validation | `true` |
| `fhirpath.ast.maxDepth` | Maximum AST visualization depth | `10` |

### Example Configuration

```json
{
  "fhirpath.server.url": "https://hapi.fhir.org/baseR4",
  "fhirpath.server.auth": {
    "type": "bearer",
    "token": "your-token-here"
  },
  "fhirpath.formatting.style": "readable",
  "fhirpath.validation.liveValidation": true,
  "fhirpath.highlighting.fileTypes": [
    "json",
    "javascript",
    "typescript",
    "yaml",
    "fsh"
  ]
}
```

## Building and Testing

### Prerequisites
- Node.js 20+
- pnpm package manager

### Development Setup

```bash
# Clone the repository
git clone https://github.com/octofhir/vscode-extension.git
cd vscode-extension

# Install dependencies
npm install

# Build the extension
npm run compile

# Watch for changes during development
npm run watch
```

### Testing

```bash
# Run linting
npm run lint

npm run pretest
```

### Packaging

```bash
# Create VSIX package
npm run package

# This creates fhirpath-extension-0.1.0.vsix
```

### Installing Development Version

1. Build the extension: `npm run package`
2. Install in VSCode:
   - Open VSCode
   - Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
   - Click "..." menu → "Install from VSIX..."
   - Select the generated `.vsix` file

## Supported FHIRPath Features

This extension is powered by the [OctoFHIR FHIRPath](https://github.com/octofhir/fhirpath-rs) Rust implementation via WebAssembly, providing:

- ✅ **Path navigation**: `Patient.name.family`
- ✅ **Functions**: `where()`, `select()`, `exists()`, `empty()`, etc.
- ✅ **Operators**: `=`, `!=`, `>`, `<`, `and`, `or`, `in`, `contains`
- ✅ **Literals**: strings, numbers, booleans, dates
- ✅ **Collections**: indexing, filtering, transformation
- ✅ **Type checking**: `is`, `as`, `ofType()`
- ✅ **Math functions**: `abs()`, `ceiling()`, `floor()`, `round()`
- ✅ **String functions**: `substring()`, `contains()`, `matches()`
- 🚧 **Advanced features**: Custom functions, extensions (in development)

## Troubleshooting

### Common Issues

**Extension not activating**
- Ensure you have VSCode 1.74.0 or later
- Check the Output panel for error messages

**Syntax highlighting not working**
- Verify file extension is `.fhirpath`
- Check that `fhirpath.highlighting.enabled` is `true`

**Evaluation errors**
- Ensure a valid FHIR resource context is set
- Check that the FHIRPath expression syntax is correct
- Verify FHIR server connectivity if using remote resources

**Performance issues**
- Reduce `fhirpath.ast.maxDepth` for complex expressions
- Increase `fhirpath.evaluation.timeout` for slow evaluations
- Clear cache using "FHIRPath: Clear Cache" command

### Getting Help

- 📖 [FHIRPath Specification](https://build.fhir.org/ig/HL7/FHIRPath/)
- 🐛 [Report Issues](https://github.com/octofhir/vscode-extension/issues)
- 💬 [Discussions](https://github.com/octofhir/vscode-extension/discussions)

## Contributing

We welcome contributions! Please see our [Contributing Guide](https://github.com/octofhir/vscode-extension/blob/main/CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run `pnpm run pretest` to ensure all checks pass
6. Submit a pull request

## License

This extension is part of the OctoFHIR FHIRPath project and is licensed under the [Apache License 2.0](https://github.com/octofhir/fhirpath-rs/blob/main/LICENSE.md).

## Acknowledgments

- Built on the [FHIRPath specification](https://build.fhir.org/ig/HL7/FHIRPath/) by HL7
- Powered by the OctoFHIR FHIRPath Rust implementation
- Uses the VSCode Extension API

---

**Enjoy working with FHIRPath expressions in VSCode!** 🚀
