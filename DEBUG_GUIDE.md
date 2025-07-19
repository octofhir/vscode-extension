# How to Inspect Errors in the FHIRPath VSCode Extension

This guide explains how to inspect and debug errors when using the installed FHIRPath VSCode extension.

## Overview

The FHIRPath extension has comprehensive error handling with multiple ways to inspect errors:

1. **User-facing error messages** - Displayed as VSCode notifications
2. **Console logging** - Detailed error information in the Developer Console
3. **Extension Host logs** - System-level extension errors
4. **Output panel** - Extension-specific output channel

## Methods to Inspect Errors

### 1. VSCode Error Notifications

The extension displays user-friendly error messages through VSCode's notification system. These appear as red error notifications in the bottom-right corner of VSCode.

**Common error messages you might see:**
- `Failed to initialize FHIRPath engine`
- `Evaluation error: [specific error details]`
- `Validation error: [specific error details]`
- `AST parsing error: [specific error details]`
- `Formatting error: [specific error details]`
- `Error setting context: [specific error details]`
- `Failed to load resource from server: [specific error details]`

### 2. Developer Console (Primary Method)

The most detailed error information is logged to the VSCode Developer Console.

**How to access:**
1. Open VSCode
2. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
3. Type "Developer: Toggle Developer Tools"
4. Select the command to open Developer Tools
5. Click on the "Console" tab
6. Look for error messages prefixed with extension-related information

**What you'll find in the console:**
- `Failed to initialize FHIRPath WASM module:` - WASM initialization errors
- `Error parsing FHIRPath symbols:` - Symbol parsing issues
- `Error processing file:` - File processing errors
- `FHIRPath formatting error:` - Formatting-related errors
- `FHIRPath range formatting error:` - Range formatting issues
- `Error validating FHIRPath document:` - Document validation errors
- `Error loading recent files:` - Explorer view errors

### 3. Extension Host Logs

For system-level extension errors, check the Extension Host logs.

**How to access:**
1. Open VSCode
2. Go to `View` → `Output`
3. In the Output panel dropdown, select "Extension Host"
4. Look for errors related to the FHIRPath extension

### 4. FHIRPath Output Channel

The extension has its own dedicated output channel for logging and debugging information.

**How to access:**
1. Open VSCode
2. Go to `View` → `Output`
3. In the Output panel dropdown, select "FHIRPath"
4. View detailed logging information including:
   - Extension activation messages
   - Expression evaluation logs
   - Error details with timestamps
   - Debug information

**What you'll find in the FHIRPath output channel:**
- `[timestamp] INFO: FHIRPath extension is now active!` - Extension activation
- `[timestamp] INFO: Expression evaluated successfully: [expression]` - Successful evaluations
- `[timestamp] ERROR: Evaluation error for expression: [expression]` - Evaluation failures
- `[timestamp] INFO: FHIRPath cache cleared` - Cache operations
- Debug information from the Show Debug Information command

## Common Error Scenarios and Debugging Steps

### 1. Extension Fails to Activate

**Symptoms:**
- Extension commands are not available
- No FHIRPath syntax highlighting
- Extension appears inactive

**Debugging steps:**
1. Check Developer Console for activation errors
2. Look for `FHIRPath extension is now active!` message
3. Check Extension Host logs for loading errors
4. Verify extension is enabled in Extensions panel

### 2. WASM Module Initialization Fails

**Symptoms:**
- Error: "FHIRPath WASM module is not initialized"
- Extension commands fail with undefined errors

**Debugging steps:**
1. Check Developer Console for WASM initialization errors
2. Look for messages starting with "Failed to initialize FHIRPath WASM module:"
3. Check if WASM files are properly bundled with the extension
4. Verify browser/VSCode supports WebAssembly

### 3. Expression Evaluation Fails

**Symptoms:**
- Error notifications when evaluating expressions
- Unexpected evaluation results

**Debugging steps:**
1. Check the exact error message in the notification
2. Look in Developer Console for detailed error information
3. Verify the FHIRPath expression syntax
4. Check if a valid FHIR context is set

### 4. Language Features Not Working

**Symptoms:**
- No syntax highlighting
- No autocompletion
- No hover information

**Debugging steps:**
1. Check if file is recognized as FHIRPath (look at language indicator in status bar)
2. Check Developer Console for language provider errors
3. Verify extension is active and properly loaded
4. Check if the file extension is `.fhirpath` or if FHIRPath language is manually selected

### 5. Debug Information Command

The extension provides a dedicated command to gather diagnostic information.

**How to use:**
1. Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Type "FHIRPath: Show Debug Information"
3. Select the command
4. The FHIRPath output channel will open automatically
5. Review the diagnostic information displayed

**Information provided:**
- Extension version
- VSCode version
- Platform and Node.js version
- Current FHIR context status
- WASM module initialization status
- Timestamp of the diagnostic request

## Advanced Debugging

### Enable Verbose Logging

To get more detailed logging information:

1. Open VSCode Settings (`Ctrl+,` or `Cmd+,`)
2. Search for "log level"
3. Set "Log Level" to "Trace" or "Debug"
4. Restart VSCode
5. Check all log sources mentioned above for more detailed information

### Inspect Extension Files

To verify extension installation:

1. Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Type "Extensions: Show Installed Extensions"
3. Find "FHIRPath" extension
4. Click the gear icon → "Extension Settings"
5. Verify configuration is correct

### Network-Related Errors

For FHIR server connectivity issues:

1. Check Developer Console for network errors
2. Verify FHIR server URL configuration
3. Check authentication settings
4. Test server connectivity outside VSCode

## Reporting Issues

When reporting issues, please include:

1. **Error message** from VSCode notification
2. **Console logs** from Developer Console
3. **Extension Host logs** if relevant
4. **Steps to reproduce** the error
5. **VSCode version** and **extension version**
6. **Operating system** information
7. **Sample FHIRPath expression** that causes the error (if applicable)

## Configuration for Better Debugging

Add these settings to your VSCode `settings.json` for better debugging experience:

```json
{
    "fhirpath.evaluation.timeout": 10000,
    "fhirpath.validation.liveValidation": true,
    "developer.reload.onSave": true
}
```

## Quick Troubleshooting Checklist

- [ ] Check VSCode notifications for error messages
- [ ] Open Developer Console and look for errors
- [ ] Verify extension is active and enabled
- [ ] Check Extension Host logs
- [ ] Restart VSCode
- [ ] Reinstall extension if necessary
- [ ] Check VSCode and extension versions
- [ ] Verify WASM support in your environment

## Getting Help

If you're still experiencing issues after following this guide:

1. Check the extension's GitHub repository for known issues
2. Search existing issues for similar problems
3. Create a new issue with detailed debugging information
4. Include all relevant logs and error messages
