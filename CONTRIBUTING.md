# Contributing to FHIRPath VSCode Extension

Thank you for your interest in contributing to the FHIRPath VSCode Extension! This guide will help you get started with development and ensure your contributions align with the project's standards.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Architecture](#project-architecture)
- [Development Workflow](#development-workflow)
- [Code Style and Standards](#code-style-and-standards)
- [Testing](#testing)
- [Debugging](#debugging)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Release Process](#release-process)

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 20+** - Required for development
- **npm** - Package manager (not pnpm/yarn)
- **VSCode 1.74.0+** - For testing the extension
- **Git** - For version control

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/vscode-extension.git
   cd vscode-extension
   ```
3. Add the upstream remote:
   ```bash
   git remote add upstream https://github.com/octofhir/vscode-extension.git
   ```

## Development Setup

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the extension:
   ```bash
   npm run compile
   ```

### WebAssembly Integration

This extension uses `@octofhir/fhirpath-wasm` which requires specific webpack configuration. The WASM module must be properly initialized before use. Check `src/engine/fhirPathEngine.ts` for initialization patterns.

Key webpack settings:
```javascript
experiments: {
  asyncWebAssembly: true,
  syncWebAssembly: true
}
```

### Development Commands

- **Development build with watching**: `npm run watch`
- **Production build**: `npm run compile`
- **Linting**: `npm run lint`
- **Package extension**: `npm run package`

## Project Architecture

### Directory Structure

```
src/
├── extension.ts          # Main entry point & activation
├── engine/              # FHIRPath WASM engine wrapper
├── language/            # Language service providers
└── views/               # Custom VSCode views
```

### Core Components

#### Language Service Providers
All language features are implemented as separate providers:
- `CompletionProvider` - Autocompletion
- `HoverProvider` - Hover information
- `SignatureHelpProvider` - Function signatures
- `FormattingProvider` - Code formatting
- `ValidationProvider` - Live validation
- `SymbolProvider` - Symbol navigation

#### Custom Views
- `ResultsViewProvider` - Expression evaluation results
- `AstViewProvider` - AST visualization
- `ExplorerViewProvider` - Resource exploration
- `PlaygroundViewProvider` - Interactive playground

#### Extension Activation
The extension registers all providers and commands in the `activate()` function:
- `registerLanguageProviders()` - Language service providers
- `registerCommands()` - Command palette commands
- `registerViews()` - Custom view providers

## Development Workflow

### Running the Extension

1. Open the project in VSCode
2. Press `F5` to launch Extension Development Host
3. Test extension functionality in the new window
4. Use Developer Tools for console debugging

### Making Changes

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following the coding standards

3. Test your changes thoroughly:
   - Run the extension in Development Host
   - Test affected language features
   - Verify WASM functionality works correctly

4. Commit your changes:
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

### Commit Message Format

We follow conventional commits format:
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

## Code Style and Standards

### Linting and Formatting

- **Linter**: Biome (using default configuration)
- **Formatting**: Biome handles both linting and formatting
- **Run linting**: `npm run lint`

### TypeScript Configuration

- **Target**: ES2020 with CommonJS modules
- **Strict mode**: Enabled with all strict checks
- **Source maps**: Generated for debugging
- **Declarations**: Generated for type checking

### Error Handling

The extension has comprehensive error handling:
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

Extension settings are defined in `package.json` under `contributes.configuration`:
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

## Testing

### Manual Testing

1. Launch Extension Development Host (`F5`)
2. Test core functionality:
   - Syntax highlighting in `.fhirpath` files
   - Expression evaluation
   - AST visualization
   - Playground functionality
   - Language features (completion, hover, etc.)

### WASM Testing

- Check browser/VSCode WebAssembly support
- Verify WASM files are properly bundled
- Monitor WASM module initialization in console
- Test WASM functionality with simple expressions first

### Performance Testing

- **WASM Initialization**: Cache initialized module, don't reinitialize
- **Expression Evaluation**: Implement timeouts (default 5000ms)
- **AST Visualization**: Limit depth to prevent UI freezing
- **Live Validation**: Debounce validation requests
- **Memory Management**: Properly dispose of WASM resources

## Debugging

### Extension Development

1. Open project in VSCode
2. Press F5 to launch Extension Development Host
3. Test extension functionality in the new window
4. Use Developer Tools for console debugging

### Common Issues

- **WASM not loading**: Check webpack WASM configuration
- **Extension not activating**: Verify activation events in package.json
- **Language features not working**: Check provider registration
- **Performance issues**: Monitor WASM memory usage and evaluation timeouts

For detailed debugging information, see [DEBUG_GUIDE.md](DEBUG_GUIDE.md).

## Pull Request Process

### Before Submitting

1. Ensure your code follows the project's coding standards
2. Run linting: `npm run lint`
3. Test your changes thoroughly
4. Update documentation if necessary
5. Ensure your branch is up to date with main:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

### Submitting a Pull Request

1. Push your branch to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

2. Create a pull request on GitHub with:
   - Clear title describing the change
   - Detailed description of what was changed and why
   - Reference any related issues
   - Screenshots/GIFs for UI changes

### Pull Request Guidelines

- **Keep PRs focused**: One feature or fix per PR
- **Write clear descriptions**: Explain what and why, not just what
- **Include tests**: Add or update tests for your changes
- **Update documentation**: Update relevant docs for new features
- **Be responsive**: Address review feedback promptly

### Review Process

1. Automated checks must pass (linting, building)
2. At least one maintainer review required
3. Address any requested changes
4. Maintainer will merge when approved

## Issue Reporting

### Before Creating an Issue

1. Check existing issues to avoid duplicates
2. Try the latest version of the extension
3. Gather relevant information:
   - VSCode version
   - Extension version
   - Operating system
   - Steps to reproduce
   - Expected vs actual behavior

### Bug Reports

Use the bug report template and include:
- Clear, descriptive title
- Steps to reproduce the issue
- Expected behavior
- Actual behavior
- Screenshots/error messages if applicable
- Environment details

### Feature Requests

Use the feature request template and include:
- Clear description of the proposed feature
- Use case and motivation
- Possible implementation approach
- Any relevant examples or mockups

### Security Issues

For security vulnerabilities, please email the maintainers directly rather than creating a public issue.

## Release Process

The project uses automated releases through GitHub Actions. For detailed information about the release process, see [RELEASE_GUIDE.md](RELEASE_GUIDE.md).

### Version Strategy

We follow semantic versioning:
- **Patch** (0.1.0 → 0.1.1): Bug fixes, small improvements
- **Minor** (0.1.0 → 0.2.0): New features, backwards compatible
- **Major** (0.1.0 → 1.0.0): Breaking changes, major releases

## Getting Help

- **Documentation**: Check [README.md](README.md) for usage information
- **Debugging**: See [DEBUG_GUIDE.md](DEBUG_GUIDE.md) for troubleshooting
- **Issues**: Create an issue for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions and ideas

## Code of Conduct

Please be respectful and constructive in all interactions. We're committed to providing a welcoming and inclusive environment for all contributors.

## License

By contributing to this project, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to the FHIRPath VSCode Extension! 🎉
