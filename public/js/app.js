// Advanced NL2SQL Application
function nl2sqlApp() {
    return {
        // State
        sessionId: null,
        loading: false,
        uploadedFiles: [],
        selectedFiles: [],
        query: '',
        dialect: 'postgresql',
        executeQuery: true,
        useCache: true,
        result: null,
        queriesExecuted: 0,
        showSettings: false,
        
        // UI State
        alert: {
            show: false,
            type: 'info',
            message: ''
        },
        
        uploadProgress: {
            show: false,
            percent: 0,
            message: ''
        },
        
        settings: {
            apiKey: '',
            model: 'gpt-3.5-turbo'
        },

        // Initialize
        async init() {
            try {
                await this.initSession();
                await this.loadUploadedFiles();
                await this.loadSettings();
                console.log('Advanced NL2SQL initialized');
            } catch (error) {
                console.error('Initialization error:', error);
                this.showAlert('Failed to initialize application', 'error');
            }
        },

        // Session Management
        async initSession() {
            try {
                const response = await fetch('/api/session', {
                    headers: this.getHeaders()
                });
                
                if (response.ok) {
                    const data = await response.json();
                    this.sessionId = data.sessionId;
                    this.queriesExecuted = data.queriesExecuted || 0;
                } else {
                    this.sessionId = this.generateSessionId();
                }
            } catch (error) {
                console.warn('Session initialization failed, generating client-side session:', error);
                this.sessionId = this.generateSessionId();
            }
        },

        generateSessionId() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        },

        getHeaders() {
            const headers = {
                'Content-Type': 'application/json'
            };
            
            if (this.sessionId) {
                headers['X-Session-ID'] = this.sessionId;
            }
            
            return headers;
        },

        // File Management
        async loadUploadedFiles() {
            try {
                const response = await fetch('/api/files', {
                    headers: this.getHeaders()
                });
                
                if (response.ok) {
                    const data = await response.json();
                    this.uploadedFiles = data.files || [];
                    
                    if (this.selectedFiles.length === 0 && this.uploadedFiles.length > 0) {
                        this.selectedFiles = this.uploadedFiles.map(f => f.id);
                    }
                }
            } catch (error) {
                console.error('Failed to load uploaded files:', error);
            }
        },

        handleFileSelect(event) {
            const files = Array.from(event.target.files);
            if (files.length > 0) {
                this.uploadFiles(files);
            }
        },

        handleFileDrop(event) {
            event.currentTarget.classList.remove('file-drag-over');
            const files = Array.from(event.dataTransfer.files);
            if (files.length > 0) {
                this.uploadFiles(files);
            }
        },

        async uploadFiles(files) {
            const maxFiles = 4;
            const maxTotal = 30 * 1024 * 1024; // 30MB
            const totalSize = files.reduce((s,f)=>s+f.size,0);
            if (files.length > maxFiles) { this.showAlert(`Maximum ${maxFiles} files allowed per upload`, 'error'); return; }
            if (totalSize > maxTotal) { this.showAlert('Total file size exceeds 30MB limit', 'error'); return; }

            this.uploadProgress.show = true;
            this.uploadProgress.percent = 0;
            this.uploadProgress.message = 'Uploading files...';
            
            try {
                const formData = new FormData();
                files.forEach(file => {
                    formData.append('files', file);
                });

                const response = await fetch('/api/upload', {
                    method: 'POST',
                    headers: {
                        'X-Session-ID': this.sessionId
                    },
                    body: formData
                });

                if (!response.ok) {
                    const error = await response.json().catch(() => ({ error: 'Upload failed' }));
                    throw new Error(error.error || `Upload failed (${response.status})`);
                }

                const result = await response.json();
                this.uploadProgress.percent = 100;
                this.uploadProgress.message = 'Processing complete!';
                
                await this.loadUploadedFiles();
                this.showAlert(`Successfully uploaded ${result.results.success.length} file(s)`, 'success');
                
                if (result.results.errors.length > 0) {
                    console.warn('Upload errors:', result.results.errors);
                    this.showAlert(`${result.results.errors.length} files failed to process`, 'warning');
                }
                
            } catch (error) {
                console.error('Upload error:', error);
                this.showAlert('Upload failed: ' + error.message, 'error');
            } finally {
                setTimeout(()=>{ this.uploadProgress.show = false; }, 800);
            }
        },

        toggleFileSelection(fileId) {
            const index = this.selectedFiles.indexOf(fileId);
            if (index > -1) {
                this.selectedFiles.splice(index, 1);
            } else {
                this.selectedFiles.push(fileId);
            }
        },

        async deleteFile(fileId) {
            if (!confirm('Are you sure you want to delete this file?')) {
                return;
            }

            try {
                const response = await fetch(`/api/files/${fileId}`, {
                    method: 'DELETE',
                    headers: this.getHeaders()
                });

                if (response.ok) {
                    this.showAlert('File deleted successfully', 'success');
                    await this.loadUploadedFiles();
                    
                    const index = this.selectedFiles.indexOf(fileId);
                    if (index > -1) {
                        this.selectedFiles.splice(index, 1);
                    }
                } else {
                    const error = await response.json();
                    this.showAlert(error.message || 'Failed to delete file', 'error');
                }
            } catch (error) {
                console.error('Delete error:', error);
                this.showAlert('Failed to delete file', 'error');
            }
        },

        // Query Generation
        async generateSQL() {
            if (!this.query.trim()) {
                this.showAlert('Please enter a query description', 'error');
                return;
            }

            this.loading = true;
            this.result = null;

            try {
                const requestBody = {
                    query: this.query.trim(),
                    dialect: this.dialect,
                    execute: this.executeQuery,
                    useCache: this.useCache,
                    fileIds: this.selectedFiles
                };

                const response = await fetch('/api/query', {
                    method: 'POST',
                    headers: this.getHeaders(),
                    body: JSON.stringify(requestBody)
                });

                if (response.ok) {
                    this.result = await response.json();
                    this.queriesExecuted++;
                    
                    if (this.result.fromCache) {
                        this.showAlert('Result retrieved from cache', 'info');
                    } else {
                        this.showAlert('SQL generated successfully', 'success');
                    }

                    setTimeout(() => {
                        const resultsElement = document.querySelector('[x-show="result"]');
                        if (resultsElement) {
                            resultsElement.scrollIntoView({ behavior: 'smooth' });
                        }
                    }, 100);
                } else {
                    const error = await response.json();
                    this.showAlert(error.message || 'Failed to generate SQL', 'error');
                }
            } catch (error) {
                console.error('Query error:', error);
                this.showAlert('Failed to generate SQL: ' + error.message, 'error');
            } finally {
                this.loading = false;
            }
        },

        // Utility Functions
        formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },

        async copyToClipboard(text) {
            try {
                await navigator.clipboard.writeText(text);
                this.showAlert('Copied to clipboard', 'success');
            } catch (error) {
                console.error('Copy failed:', error);
                
                const textarea = document.createElement('textarea');
                textarea.value = text;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                
                this.showAlert('Copied to clipboard', 'success');
            }
        },

        exportResults(format) {
            if (!this.result?.execution?.rows?.length) {
                this.showAlert('No data to export', 'error');
                return;
            }

            const data = this.result.execution.rows;
            
            if (format === 'csv') {
                this.exportCsv(data);
            } else if (format === 'json') {
                this.exportJson(data);
            }
        },

        exportCsv(data) {
            const headers = Object.keys(data[0]);
            const csvContent = [
                headers.join(','),
                ...data.map(row => 
                    headers.map(header => {
                        const value = row[header];
                        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                            return `"${value.replace(/"/g, '""')}"`;
                        }
                        return value;
                    }).join(',')
                )
            ].join('\n');

            this.downloadFile(csvContent, 'query-results.csv', 'text/csv');
        },

        exportJson(data) {
            const jsonContent = JSON.stringify(data, null, 2);
            this.downloadFile(jsonContent, 'query-results.json', 'application/json');
        },

        downloadFile(content, filename, mimeType) {
            const blob = new Blob([content], { type: mimeType });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            this.showAlert(`Downloaded ${filename}`, 'success');
        },

        // Settings Management
        loadSettings() {
            const saved = localStorage.getItem('nl2sql-settings');
            if (saved) {
                try {
                    this.settings = { ...this.settings, ...JSON.parse(saved) };
                } catch (error) {
                    console.warn('Failed to load settings:', error);
                }
            }
        },

        async saveSettings() {
            try {
                if (this.settings.apiKey) {
                    const response = await fetch('/api/validate-key', {
                        method: 'POST',
                        headers: this.getHeaders(),
                        body: JSON.stringify({
                            apiKey: this.settings.apiKey,
                            model: this.settings.model
                        })
                    });

                    if (response.ok) {
                        const result = await response.json();
                        if (result.valid) {
                            localStorage.setItem('nl2sql-settings', JSON.stringify(this.settings));
                            this.showAlert('Settings saved and API key validated', 'success');
                        } else {
                            this.showAlert(result.error || 'Invalid API key', 'error');
                            return;
                        }
                    } else {
                        const error = await response.json();
                        this.showAlert(error.message || 'Failed to validate API key', 'error');
                        return;
                    }
                } else {
                    localStorage.setItem('nl2sql-settings', JSON.stringify(this.settings));
                    this.showAlert('Settings saved', 'success');
                }

                this.showSettings = false;
            } catch (error) {
                console.error('Save settings error:', error);
                this.showAlert('Failed to save settings', 'error');
            }
        },

        showAlert(message, type = 'info') {
            this.alert = {
                show: true,
                type,
                message
            };

            if (type === 'success') {
                setTimeout(() => {
                    this.alert.show = false;
                }, 3000);
            }
        }
    };
}
