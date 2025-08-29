/**
 * NL2SQL Web Application
 * Client-side JavaScript for the NL2SQL interface
 */

// Configuration
const config = {
    apiEndpoint: localStorage.getItem('apiEndpoint') || 'http://localhost:3000',
    openaiApiKey: localStorage.getItem('openaiApiKey') || '',
    openaiModel: localStorage.getItem('openaiModel') || 'gpt-3.5-turbo',
    apiKeyValidated: false,
    currentSchema: null,
    queryHistory: JSON.parse(localStorage.getItem('queryHistory') || '[]'),
    currentSQL: null,
    currentResults: null
};

// DOM Elements
const elements = {
    // Schema
    schemaInput: document.getElementById('schemaInput'),
    schemaFormat: document.getElementById('schemaFormat'),
    uploadSchemaBtn: document.getElementById('uploadSchemaBtn'),
    loadSampleBtn: document.getElementById('loadSampleBtn'),
    schemaPreview: document.getElementById('schemaPreview'),
    schemaContent: document.getElementById('schemaContent'),
    
    // Query
    queryInput: document.getElementById('queryInput'),
    dialectSelect: document.getElementById('dialectSelect'),
    querySuggestions: document.getElementById('querySuggestions'),
    
    // Actions
    generateBtn: document.getElementById('generateBtn'),
    executeBtn: document.getElementById('executeBtn'),
    optimizeBtn: document.getElementById('optimizeBtn'),
    clearBtn: document.getElementById('clearBtn'),
    
    // Results
    sqlOutput: document.getElementById('sqlOutput'),
    confidenceBadge: document.getElementById('confidenceBadge'),
    confidenceValue: document.getElementById('confidenceValue'),
    copySqlBtn: document.getElementById('copySqlBtn'),
    alternativeQueries: document.getElementById('alternativeQueries'),
    alternativeList: document.getElementById('alternativeList'),
    
    explanationContent: document.getElementById('explanationContent'),
    warnings: document.getElementById('warnings'),
    warningsList: document.getElementById('warningsList'),
    
    resultsTable: document.getElementById('resultsTable'),
    executionStats: document.getElementById('executionStats'),
    rowCount: document.getElementById('rowCount'),
    execTime: document.getElementById('execTime'),
    exportBtn: document.getElementById('exportBtn'),
    
    optimizationContent: document.getElementById('optimizationContent'),
    
    // Modals
    apiKeyModal: document.getElementById('apiKeyModal'),
    historyModal: document.getElementById('historyModal'),
    apiKeyBtn: document.getElementById('apiKeyBtn'),
    historyBtn: document.getElementById('historyBtn'),
    helpBtn: document.getElementById('helpBtn'),
    
    openaiApiKey: document.getElementById('openaiApiKey'),
    openaiModel: document.getElementById('openaiModel'),
    apiEndpoint: document.getElementById('apiEndpoint'),
    validateApiKey: document.getElementById('validateApiKey'),
    saveApiKey: document.getElementById('saveApiKey'),
    apiKeyStatus: document.getElementById('apiKeyStatus'),
    
    historyList: document.getElementById('historyList'),
    clearHistory: document.getElementById('clearHistory'),
    
    // Loading
    loadingOverlay: document.getElementById('loadingOverlay'),
    loadingMessage: document.getElementById('loadingMessage'),
    
    // Toast
    toastContainer: document.getElementById('toastContainer')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadSavedConfiguration();
    checkAPIKeyStatus();
    renderQueryHistory();
    
    // Show API key modal if not configured
    if (!config.openaiApiKey) {
        setTimeout(() => {
            showModal('apiKeyModal');
            showToast('Please configure your OpenAI API key to get started', 'warning');
        }, 500);
    }
});

// Event Listeners
function initializeEventListeners() {
    // Schema
    elements.uploadSchemaBtn.addEventListener('click', uploadSchema);
    elements.loadSampleBtn.addEventListener('click', loadSampleSchema);
    elements.schemaInput.addEventListener('input', debounce(parseSchema, 500));
    
    // Query
    elements.generateBtn.addEventListener('click', generateSQL);
    elements.executeBtn.addEventListener('click', executeQuery);
    elements.optimizeBtn.addEventListener('click', optimizeQuery);
    elements.clearBtn.addEventListener('click', clearAll);
    
    // Copy SQL
    elements.copySqlBtn.addEventListener('click', copySQL);
    
    // Export results
    if (elements.exportBtn) {
        elements.exportBtn.addEventListener('click', exportResults);
    }
    
    // Modals
    elements.apiKeyBtn.addEventListener('click', () => showModal('apiKeyModal'));
    elements.historyBtn.addEventListener('click', () => showModal('historyModal'));
    elements.helpBtn.addEventListener('click', showHelp);
    
    elements.validateApiKey.addEventListener('click', validateOpenAIKey);
    elements.saveApiKey.addEventListener('click', saveConfiguration);
    elements.clearHistory.addEventListener('click', clearQueryHistory);
    
    // Enable/disable save button based on API key input
    elements.openaiApiKey.addEventListener('input', () => {
        const hasKey = elements.openaiApiKey.value.trim().startsWith('sk-');
        elements.validateApiKey.disabled = !hasKey;
    });
    
    // Close modals
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) {
                modal.classList.add('hidden');
            }
        });
    });
    
    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            switchTab(tabName);
        });
    });
    
    // Query suggestions
    elements.queryInput.addEventListener('focus', showQuerySuggestions);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Enter to generate SQL
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            generateSQL();
        }
        
        // Escape to close modals
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.classList.add('hidden');
            });
        }
    });
}

// API Functions
async function validateOpenAIKey() {
    const apiKey = elements.openaiApiKey.value.trim();
    const model = elements.openaiModel.value;
    
    if (!apiKey || !apiKey.startsWith('sk-')) {
        showAPIStatus('Please enter a valid OpenAI API key starting with "sk-"', 'error');
        return;
    }
    
    showAPIStatus('Validating API key...', 'validating');
    elements.validateApiKey.disabled = true;
    
    try {
        const response = await fetch(`${config.apiEndpoint}/api/validate-key`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ apiKey, model })
        });
        
        const data = await response.json();
        
        if (data.valid) {
            showAPIStatus('✓ API key is valid and working!', 'success');
            config.apiKeyValidated = true;
            elements.saveApiKey.disabled = false;
            
            // Update model options if available
            if (data.models && data.models.length > 0) {
                updateModelOptions(data.models);
            }
        } else {
            showAPIStatus(`✗ ${data.error || 'Invalid API key'}`, 'error');
            config.apiKeyValidated = false;
            elements.saveApiKey.disabled = true;
        }
    } catch (error) {
        showAPIStatus('Failed to validate API key. Check your connection.', 'error');
        config.apiKeyValidated = false;
        elements.saveApiKey.disabled = true;
    } finally {
        elements.validateApiKey.disabled = false;
    }
}

function showAPIStatus(message, type) {
    const statusDiv = elements.apiKeyStatus;
    const messageDiv = statusDiv.querySelector('.status-message');
    
    statusDiv.className = `api-status ${type}`;
    messageDiv.textContent = message;
    statusDiv.classList.remove('hidden');
}

function updateModelOptions(models) {
    const select = elements.openaiModel;
    const currentValue = select.value;
    
    // Clear existing options
    select.innerHTML = '';
    
    // Add available models
    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = getModelDisplayName(model);
        select.appendChild(option);
    });
    
    // Restore previous selection if available
    if (models.includes(currentValue)) {
        select.value = currentValue;
    }
}

function getModelDisplayName(model) {
    const displayNames = {
        'gpt-3.5-turbo': 'GPT-3.5 Turbo (Fast & Cheap)',
        'gpt-3.5-turbo-16k': 'GPT-3.5 Turbo 16K',
        'gpt-4': 'GPT-4 (Most Capable)',
        'gpt-4-turbo-preview': 'GPT-4 Turbo (Latest)',
        'gpt-4-32k': 'GPT-4 32K (Long Context)'
    };
    return displayNames[model] || model;
}

async function checkAPIKeyStatus() {
    if (!config.openaiApiKey) return;
    
    try {
        const response = await fetch(`${config.apiEndpoint}/api/validate-key`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                apiKey: config.openaiApiKey,
                model: config.openaiModel 
            })
        });
        
        const data = await response.json();
        config.apiKeyValidated = data.valid;
        
        if (!data.valid) {
            showToast('API key validation failed. Please reconfigure.', 'error');
            setTimeout(() => showModal('apiKeyModal'), 1000);
        }
    } catch (error) {
        console.error('Failed to check API key status:', error);
    }
}

async function generateSQL() {
    // Check if API key is configured
    if (!config.openaiApiKey || !config.apiKeyValidated) {
        showModal('apiKeyModal');
        showToast('Please configure and validate your OpenAI API key first', 'error');
        return;
    }
    const query = elements.queryInput.value.trim();
    const schema = elements.schemaInput.value.trim();
    
    if (!query) {
        showToast('Please enter a natural language query', 'error');
        return;
    }
    
    if (!schema) {
        showToast('Please provide a database schema', 'error');
        return;
    }
    
    showLoading('Generating SQL query...');
    
    try {
        const response = await fetch(`${config.apiEndpoint}/api/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + config.openaiApiKey
            },
            body: JSON.stringify({
                query,
                schema,
                schemaFormat: elements.schemaFormat.value,
                dialect: elements.dialectSelect.value,
                execute: false,
                useCache: true
            })
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Update UI with results
        displaySQL(data.sql);
        displayExplanation(data.explanation);
        displayConfidence(data.confidence);
        displayWarnings(data.warnings);
        displayAlternatives(data.alternativeQueries);
        displayOptimizations(data.optimizationSuggestions);
        
        // Save to history
        saveToHistory(query, data.sql);
        
        // Enable execute and optimize buttons
        elements.executeBtn.disabled = false;
        elements.optimizeBtn.disabled = false;
        
        config.currentSQL = data.sql;
        
        showToast('SQL generated successfully', 'success');
    } catch (error) {
        console.error('Error generating SQL:', error);
        showToast(error.message || 'Failed to generate SQL', 'error');
    } finally {
        hideLoading();
    }
}

async function executeQuery() {
    if (!config.currentSQL) {
        showToast('Please generate a SQL query first', 'error');
        return;
    }
    
    showLoading('Executing query...');
    
    try {
        const response = await fetch(`${config.apiEndpoint}/api/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + config.openaiApiKey
            },
            body: JSON.stringify({
                query: elements.queryInput.value,
                schema: elements.schemaInput.value,
                schemaFormat: elements.schemaFormat.value,
                dialect: elements.dialectSelect.value,
                execute: true
            })
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.execution) {
            displayResults(data.execution);
            switchTab('results');
            showToast('Query executed successfully', 'success');
        } else {
            showToast('No execution results', 'warning');
        }
    } catch (error) {
        console.error('Error executing query:', error);
        showToast(error.message || 'Failed to execute query', 'error');
    } finally {
        hideLoading();
    }
}

async function optimizeQuery() {
    if (!config.currentSQL) {
        showToast('Please generate a SQL query first', 'error');
        return;
    }
    
    showLoading('Optimizing query...');
    
    try {
        const response = await fetch(`${config.apiEndpoint}/api/optimize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + config.openaiApiKey
            },
            body: JSON.stringify({
                sql: config.currentSQL,
                schema: elements.schemaInput.value
            })
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        displayOptimization(data);
        switchTab('optimization');
        showToast('Query optimized', 'success');
    } catch (error) {
        console.error('Error optimizing query:', error);
        showToast(error.message || 'Failed to optimize query', 'error');
    } finally {
        hideLoading();
    }
}

async function uploadSchema() {
    const schema = elements.schemaInput.value.trim();
    
    if (!schema) {
        showToast('Please enter a schema first', 'error');
        return;
    }
    
    showLoading('Uploading schema...');
    
    try {
        const response = await fetch(`${config.apiEndpoint}/api/schema`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + config.openaiApiKey
            },
            body: JSON.stringify({
                schema,
                format: elements.schemaFormat.value
            })
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        config.currentSchema = data.schema;
        displaySchemaPreview(data.schema);
        
        // Get query suggestions
        await getQuerySuggestions(data.schema);
        
        showToast('Schema uploaded successfully', 'success');
    } catch (error) {
        console.error('Error uploading schema:', error);
        showToast(error.message || 'Failed to upload schema', 'error');
    } finally {
        hideLoading();
    }
}

async function parseSchema() {
    const schema = elements.schemaInput.value.trim();
    if (!schema) return;
    
    try {
        // Simple client-side preview
        const format = elements.schemaFormat.value;
        let preview = null;
        
        if (format === 'json' || format === 'auto_detect') {
            try {
                preview = JSON.parse(schema);
            } catch {
                // Not JSON
            }
        }
        
        if (preview) {
            displaySchemaPreview(preview);
        }
    } catch (error) {
        console.error('Error parsing schema:', error);
    }
}

async function getQuerySuggestions(schema) {
    try {
        const response = await fetch(`${config.apiEndpoint}/api/suggest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + config.openaiApiKey
            },
            body: JSON.stringify({ schema })
        });
        
        if (response.ok) {
            const data = await response.json();
            displayQuerySuggestions(data.suggestions);
        }
    } catch (error) {
        console.error('Error getting suggestions:', error);
    }
}

async function checkAPIConnection() {
    try {
        const response = await fetch(`${config.apiEndpoint}/health`);
        if (response.ok) {
            const data = await response.json();
            if (data.openai === 'connected') {
                showToast('API connected', 'success');
            } else {
                showToast('API connected but OpenAI not initialized', 'warning');
            }
        }
    } catch (error) {
        showToast('API connection failed. Please check settings.', 'error');
    }
}

// Display Functions
function displaySQL(sql) {
    elements.sqlOutput.innerHTML = `<code>${highlightSQL(sql)}</code>`;
}

function displayExplanation(explanation) {
    elements.explanationContent.innerHTML = `<p>${explanation}</p>`;
}

function displayConfidence(confidence) {
    const percentage = Math.round(confidence * 100);
    elements.confidenceValue.textContent = `${percentage}%`;
    
    // Update badge color based on confidence
    elements.confidenceBadge.className = 'confidence-badge';
    if (confidence >= 0.8) {
        elements.confidenceBadge.classList.add('high');
    } else if (confidence >= 0.6) {
        elements.confidenceBadge.classList.add('medium');
    } else {
        elements.confidenceBadge.classList.add('low');
    }
}

function displayWarnings(warnings) {
    if (!warnings || warnings.length === 0) {
        elements.warnings.classList.add('hidden');
        return;
    }
    
    elements.warnings.classList.remove('hidden');
    elements.warningsList.innerHTML = warnings.map(w => `<li>${w}</li>`).join('');
}

function displayAlternatives(alternatives) {
    if (!alternatives || alternatives.length === 0) {
        elements.alternativeQueries.classList.add('hidden');
        return;
    }
    
    elements.alternativeQueries.classList.remove('hidden');
    elements.alternativeList.innerHTML = alternatives.map(sql => 
        `<pre class="sql-output"><code>${highlightSQL(sql)}</code></pre>`
    ).join('');
}

function displayOptimizations(suggestions) {
    if (!suggestions || suggestions.length === 0) return;
    
    const html = `
        <h4>Optimization Suggestions</h4>
        <ul>${suggestions.map(s => `<li>${s}</li>`).join('')}</ul>
    `;
    
    const optimTab = document.getElementById('optimizationContent');
    if (optimTab) {
        optimTab.innerHTML = html;
    }
}

function displayOptimization(data) {
    const html = `
        <h4>Original Query</h4>
        <pre class="sql-output"><code>${highlightSQL(data.original)}</code></pre>
        
        <h4>Optimized Query</h4>
        <pre class="sql-output"><code>${highlightSQL(data.optimized)}</code></pre>
        
        <p>The optimized query should perform better with large datasets.</p>
    `;
    
    elements.optimizationContent.innerHTML = html;
}

function displayResults(execution) {
    if (execution.error) {
        elements.resultsTable.innerHTML = `<p class="error">Error: ${execution.error}</p>`;
        return;
    }
    
    const { rows, columns, rowCount, executionTime } = execution;
    
    // Update stats
    elements.rowCount.textContent = rowCount;
    elements.execTime.textContent = `${executionTime}ms`;
    elements.executionStats.classList.remove('hidden');
    
    // Build table
    if (rows.length === 0) {
        elements.resultsTable.innerHTML = '<p>No results found</p>';
        return;
    }
    
    const headers = columns.map(col => `<th>${col.name}</th>`).join('');
    const tbody = rows.map(row => {
        const cells = columns.map(col => `<td>${row[col.name] ?? ''}</td>`).join('');
        return `<tr>${cells}</tr>`;
    }).join('');
    
    elements.resultsTable.innerHTML = `
        <table class="results-table">
            <thead><tr>${headers}</tr></thead>
            <tbody>${tbody}</tbody>
        </table>
    `;
    
    config.currentResults = { rows, columns };
}

function displaySchemaPreview(schema) {
    if (!schema || !schema.tables) return;
    
    const html = schema.tables.map(table => `
        <div class="table-item">
            <div class="table-name">${table.name}</div>
            <div class="column-list">
                ${table.columns.map(col => 
                    `<span class="column-badge">${col.name} (${col.type})</span>`
                ).join('')}
            </div>
        </div>
    `).join('');
    
    elements.schemaContent.innerHTML = html;
    elements.schemaPreview.classList.remove('hidden');
}

function displayQuerySuggestions(suggestions) {
    if (!suggestions || suggestions.length === 0) return;
    
    const html = suggestions.map(s => 
        `<div class="suggestion-chip" onclick="useQuerySuggestion('${s.replace(/'/g, "\\'")}')">${s}</div>`
    ).join('');
    
    elements.querySuggestions.innerHTML = html;
}

function showQuerySuggestions() {
    // Show suggestions if available
    if (elements.querySuggestions.children.length > 0) {
        elements.querySuggestions.style.display = 'flex';
    }
}

// Utility Functions
function highlightSQL(sql) {
    const keywords = [
        'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
        'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'ALL',
        'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TABLE',
        'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'AS',
        'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'DISTINCT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'
    ];
    
    let highlighted = sql;
    keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        highlighted = highlighted.replace(regex, `<span style="color: #3182ce; font-weight: bold;">${keyword}</span>`);
    });
    
    // Highlight strings
    highlighted = highlighted.replace(/'[^']*'/g, match => 
        `<span style="color: #16a34a;">${match}</span>`
    );
    
    // Highlight numbers
    highlighted = highlighted.replace(/\b\d+\b/g, match => 
        `<span style="color: #dc2626;">${match}</span>`
    );
    
    return highlighted;
}

function copySQL() {
    if (!config.currentSQL) return;
    
    navigator.clipboard.writeText(config.currentSQL).then(() => {
        showToast('SQL copied to clipboard', 'success');
    }).catch(err => {
        showToast('Failed to copy SQL', 'error');
    });
}

function exportResults() {
    if (!config.currentResults) {
        showToast('No results to export', 'error');
        return;
    }
    
    const { rows, columns } = config.currentResults;
    
    // Convert to CSV
    const headers = columns.map(col => col.name).join(',');
    const csvRows = rows.map(row => 
        columns.map(col => JSON.stringify(row[col.name] ?? '')).join(',')
    );
    
    const csv = [headers, ...csvRows].join('\n');
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query-results-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('Results exported', 'success');
}

function loadSampleSchema() {
    const sampleSchema = `CREATE TABLE customers (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    country VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2),
    category VARCHAR(100),
    stock INTEGER DEFAULT 0
);

CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10,2),
    status VARCHAR(50)
);

CREATE TABLE order_items (
    order_id INTEGER REFERENCES orders(id),
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2),
    PRIMARY KEY (order_id, product_id)
);`;
    
    elements.schemaInput.value = sampleSchema;
    elements.schemaFormat.value = 'sql_ddl';
    parseSchema();
    showToast('Sample schema loaded', 'success');
}

function clearAll() {
    elements.queryInput.value = '';
    elements.sqlOutput.innerHTML = '<code>-- Your generated SQL will appear here</code>';
    elements.explanationContent.innerHTML = '<p>Generate a query to see the explanation...</p>';
    elements.resultsTable.innerHTML = '<p>Execute a query to see results...</p>';
    elements.optimizationContent.innerHTML = '<p>Click "Optimize" to see optimization suggestions...</p>';
    elements.executeBtn.disabled = true;
    elements.optimizeBtn.disabled = true;
    config.currentSQL = null;
    config.currentResults = null;
    showToast('Cleared', 'success');
}

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.tab === tabName) {
            tab.classList.add('active');
        }
    });
    
    // Update tab content
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    
    const targetPane = document.getElementById(`${tabName}Tab`);
    if (targetPane) {
        targetPane.classList.add('active');
    }
}

function useQuerySuggestion(suggestion) {
    elements.queryInput.value = suggestion;
    elements.querySuggestions.style.display = 'none';
}

// Configuration Functions
function loadSavedConfiguration() {
    // OpenAI API key is already handled by elements.openaiApiKey
    elements.apiEndpoint.value = config.apiEndpoint;
}

function saveConfiguration() {
    // OpenAI API key is already handled in config.openaiApiKey
    config.apiEndpoint = elements.apiEndpoint.value || 'http://localhost:3000';
    
    // OpenAI API key is already saved as 'openaiApiKey'
    localStorage.setItem('apiEndpoint', config.apiEndpoint);
    
    elements.apiKeyModal.classList.add('hidden');
    showToast('Configuration saved', 'success');
    
    checkAPIConnection();
}

// History Functions
function saveToHistory(query, sql) {
    const entry = {
        query,
        sql,
        timestamp: new Date().toISOString(),
        dialect: elements.dialectSelect.value
    };
    
    config.queryHistory.unshift(entry);
    
    // Keep only last 50 entries
    if (config.queryHistory.length > 50) {
        config.queryHistory = config.queryHistory.slice(0, 50);
    }
    
    localStorage.setItem('queryHistory', JSON.stringify(config.queryHistory));
    renderQueryHistory();
}

function renderQueryHistory() {
    if (config.queryHistory.length === 0) {
        elements.historyList.innerHTML = '<p>No query history yet</p>';
        return;
    }
    
    const html = config.queryHistory.map((entry, index) => `
        <div class="history-item" style="padding: 1rem; border-bottom: 1px solid var(--border-color);">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <strong>${entry.query}</strong>
                <small>${new Date(entry.timestamp).toLocaleString()}</small>
            </div>
            <pre style="background: var(--code-bg); color: var(--code-text); padding: 0.5rem; border-radius: 4px; font-size: 0.75rem;">${entry.sql}</pre>
            <button class="btn btn-secondary" style="margin-top: 0.5rem;" onclick="useHistoryEntry(${index})">Use This Query</button>
        </div>
    `).join('');
    
    elements.historyList.innerHTML = html;
}

function useHistoryEntry(index) {
    const entry = config.queryHistory[index];
    if (entry) {
        elements.queryInput.value = entry.query;
        elements.dialectSelect.value = entry.dialect;
        elements.historyModal.classList.add('hidden');
        showToast('Query loaded from history', 'success');
    }
}

function clearQueryHistory() {
    if (confirm('Are you sure you want to clear all query history?')) {
        config.queryHistory = [];
        localStorage.removeItem('queryHistory');
        renderQueryHistory();
        showToast('History cleared', 'success');
    }
}

// UI Helper Functions
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function showHelp() {
    const helpText = `
NL2SQL Help

1. Enter your database schema in SQL DDL, JSON, CSV, or natural language format
2. Type your question in plain English
3. Click "Generate SQL" to convert to SQL
4. Click "Execute Query" to run the query (requires backend setup)
5. Use "Optimize" to get performance improvements

Tips:
- Be specific in your queries
- Mention table and column names when possible
- Use natural language like "show me", "find", "calculate", etc.

Keyboard Shortcuts:
- Ctrl/Cmd + Enter: Generate SQL
- Escape: Close modals
    `;
    
    alert(helpText);
}

function showLoading(message = 'Loading...') {
    elements.loadingMessage.textContent = message;
    elements.loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    elements.loadingOverlay.classList.add('hidden');
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${type === 'success' ? '<polyline points="20 6 9 17 4 12"/>' : 
              type === 'error' ? '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>' :
              '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'}
        </svg>
        <span>${message}</span>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Make functions available globally for inline onclick handlers
window.useQuerySuggestion = useQuerySuggestion;
window.useHistoryEntry = useHistoryEntry;