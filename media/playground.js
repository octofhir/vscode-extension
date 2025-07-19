// FHIRPath Playground JavaScript

(function() {
    const vscode = acquireVsCodeApi();

    // DOM elements
    let expressionInput;
    let contextInput;
    let resultsContainer;
    let evaluateBtn;
    let clearBtn;
    let exportBtn;
    let exampleSelect;

    // State
    let currentState = {
        expression: '',
        context: '{}',
        result: null,
        error: null,
        executionTime: null,
        timestamp: Date.now()
    };

    // Initialize when DOM is loaded
    document.addEventListener('DOMContentLoaded', function() {
        initializeElements();
        setupEventListeners();
        setupMessageHandling();

        // Request initial state
        vscode.postMessage({ type: 'ready' });
    });

    function initializeElements() {
        expressionInput = document.getElementById('expressionInput');
        contextInput = document.getElementById('contextInput');
        resultsContainer = document.getElementById('resultsContainer');
        evaluateBtn = document.getElementById('evaluateBtn');
        clearBtn = document.getElementById('clearBtn');
        exportBtn = document.getElementById('exportBtn');
        exampleSelect = document.getElementById('exampleSelect');
    }

    function setupEventListeners() {
        // Expression input
        expressionInput.addEventListener('input', function() {
            currentState.expression = this.value;
            vscode.postMessage({
                type: 'updateExpression',
                expression: this.value
            });
        });

        // Context input
        contextInput.addEventListener('input', function() {
            currentState.context = this.value;
            vscode.postMessage({
                type: 'updateContext',
                context: this.value
            });
            validateJSON(this.value);
        });

        // Evaluate button
        evaluateBtn.addEventListener('click', function() {
            evaluateExpression();
        });

        // Clear button
        clearBtn.addEventListener('click', function() {
            clearPlayground();
        });

        // Export button
        exportBtn.addEventListener('click', function() {
            exportResults();
        });

        // Example select
        exampleSelect.addEventListener('change', function() {
            if (this.value) {
                loadExample(this.value);
                this.value = ''; // Reset select
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            // Ctrl/Cmd + Enter to evaluate
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                evaluateExpression();
            }

            // Ctrl/Cmd + K to clear
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                clearPlayground();
            }
        });
    }

    function setupMessageHandling() {
        window.addEventListener('message', function(event) {
            const message = event.data;

            switch (message.type) {
                case 'updateState':
                    updateState(message.state);
                    break;
            }
        });
    }

    function evaluateExpression() {
        const expression = expressionInput.value.trim();
        const context = contextInput.value.trim();

        if (!expression) {
            showError('Please enter a FHIRPath expression');
            return;
        }

        if (!context) {
            showError('Please enter a FHIR resource context');
            return;
        }

        // Validate JSON context
        try {
            JSON.parse(context);
        } catch (error) {
            showError('Invalid JSON in context: ' + error.message);
            return;
        }

        // Show loading state
        showLoading();

        // Send evaluation request
        vscode.postMessage({
            type: 'evaluate',
            expression: expression,
            context: context
        });
    }

    function clearPlayground() {
        // Clear UI elements immediately for better user experience
        expressionInput.value = '';
        contextInput.value = '{}';
        showPlaceholder();
        exportBtn.disabled = true;

        // Update local state
        currentState = {
            expression: '',
            context: '{}',
            result: null,
            error: null,
            executionTime: null,
            timestamp: Date.now()
        };

        // Notify backend to update its state
        vscode.postMessage({ type: 'clear' });
    }

    function loadExample(exampleName) {
        vscode.postMessage({
            type: 'loadExample',
            example: exampleName
        });
    }

    function exportResults() {
        if (currentState.result) {
            vscode.postMessage({
                type: 'export',
                data: {
                    expression: currentState.expression,
                    context: JSON.parse(currentState.context),
                    result: currentState.result,
                    executionTime: currentState.executionTime,
                    timestamp: currentState.timestamp
                }
            });
        }
    }

    function updateState(state) {
        currentState = state;

        // Update inputs
        if (expressionInput.value !== state.expression) {
            expressionInput.value = state.expression || '';
        }

        if (contextInput.value !== state.context) {
            contextInput.value = state.context || '{}';
        }

        // Update results
        if (state.error) {
            showError(state.error);
        } else if (state.result !== undefined) {
            showResult(state.result, state.executionTime);
        } else {
            showPlaceholder();
        }

        // Update export button state
        exportBtn.disabled = !state.result;
    }

    function showResult(result, executionTime) {
        const resultHtml = `
            <div class="result-content">
                <div class="result-header">
                    <div class="result-status success">
                        <span class="codicon codicon-check"></span>
                        Success
                    </div>
                    <div class="result-meta">
                        ${executionTime ? `Executed in ${executionTime}ms` : ''}
                    </div>
                </div>
                <div class="result-data">${formatResult(result)}</div>
            </div>
        `;

        resultsContainer.innerHTML = resultHtml;
    }

    function showError(error) {
        const errorHtml = `
            <div class="result-content">
                <div class="result-header">
                    <div class="result-status error">
                        <span class="codicon codicon-error"></span>
                        Error
                    </div>
                </div>
                <div class="error-message">${escapeHtml(error)}</div>
            </div>
        `;

        resultsContainer.innerHTML = errorHtml;
    }

    function showLoading() {
        const loadingHtml = `
            <div class="loading">
                <span class="codicon codicon-loading"></span>
                Evaluating expression...
            </div>
        `;

        resultsContainer.innerHTML = loadingHtml;
    }

    function showPlaceholder() {
        resultsContainer.innerHTML = `
            <div class="placeholder">
                Enter an expression and click Evaluate to see results
            </div>
        `;
    }

    function formatResult(result) {
        if (result === null || result === undefined) {
            return '<span class="json-null">null</span>';
        }

        if (typeof result === 'string') {
            return `<span class="json-string">"${escapeHtml(result)}"</span>`;
        }

        if (typeof result === 'number') {
            return `<span class="json-number">${result}</span>`;
        }

        if (typeof result === 'boolean') {
            return `<span class="json-boolean">${result}</span>`;
        }

        // For objects and arrays, format as JSON with syntax highlighting
        try {
            const jsonString = JSON.stringify(result, null, 2);
            return highlightJSON(jsonString);
        } catch (error) {
            return escapeHtml(String(result));
        }
    }

    function highlightJSON(jsonString) {
        return jsonString
            .replace(/(".*?")\s*:/g, '<span class="json-key">$1</span>:')
            .replace(/:\s*(".*?")/g, ': <span class="json-string">$1</span>')
            .replace(/:\s*(\d+\.?\d*)/g, ': <span class="json-number">$1</span>')
            .replace(/:\s*(true|false)/g, ': <span class="json-boolean">$1</span>')
            .replace(/:\s*(null)/g, ': <span class="json-null">$1</span>');
    }

    function validateJSON(jsonString) {
        if (!jsonString.trim()) {
            return;
        }

        try {
            JSON.parse(jsonString);
            contextInput.style.borderColor = '';
            contextInput.title = '';
        } catch (error) {
            contextInput.style.borderColor = 'var(--vscode-inputValidation-errorBorder)';
            contextInput.title = 'Invalid JSON: ' + error.message;
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Auto-resize textareas
    function autoResize(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }

    // Setup auto-resize for textareas
    document.addEventListener('DOMContentLoaded', function() {
        const textareas = document.querySelectorAll('textarea');
        textareas.forEach(textarea => {
            textarea.addEventListener('input', function() {
                autoResize(this);
            });

            // Initial resize
            autoResize(textarea);
        });
    });

    // Handle theme changes
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                // Theme changed, could update syntax highlighting colors if needed
            }
        });
    });

    observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['class']
    });

})();
