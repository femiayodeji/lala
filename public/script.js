class OnileraChat {
    constructor() {
        this.apiBase = '/api';
        this.currentFile = null;
        this.isStreaming = false;
        this.init();
    }

    init() {
        this.messages = document.getElementById('messages');
        this.input = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.fileInput = document.getElementById('fileInput');
        this.fileInfo = document.getElementById('fileInfo');
        this.error = document.getElementById('error');
        this.modelSelect = document.getElementById('modelSelect');

        this.attachEventListeners();
        this.loadModels();
    }

    attachEventListeners() {
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        this.fileInput.addEventListener('change', (e) => this.handleFile(e));
    }

    scrollToBottom() {
        this.messages.scrollTop = this.messages.scrollHeight;
    }
    async loadModels() {
        try {
            const response = await fetch(`${this.apiBase}/models`);
            const data = await response.json();
            
            if (data.success && data.models) {
                this.modelSelect.innerHTML = '';
                data.models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.name;
                    option.textContent = model.name;
                    this.modelSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Failed to load models:', error);
        }
    }

    handleFile(event) {
        const file = event.target.files[0];
        if (file) {
            this.currentFile = file;
            const size = (file.size / 1024 / 1024).toFixed(2);
            
            // Create preview for images
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.fileInfo.innerHTML = `
                        <div class="file-preview">
                            <span>Selected: ${file.name} (${size} MB)</span>
                            <img src="${e.target.result}" alt="Preview" style="max-width: 200px; max-height: 150px; border-radius: 8px; margin-top: 8px; display: block;">
                        </div>
                    `;
                };
                reader.readAsDataURL(file);
            } else {
                this.fileInfo.innerHTML = `Selected: ${file.name} (${size} MB)`;
            }
            
            this.fileInfo.style.display = 'block';
        } else {
            this.currentFile = null;
            this.fileInfo.style.display = 'none';
        }
    }

    showError(message) {
        this.error.textContent = message;
        this.error.style.display = 'block';
        setTimeout(() => this.error.style.display = 'none', 5000);
    }

    addMessage(content, isUser = false, fileData = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user' : ''}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.textContent = isUser ? 'ME' : 'AI';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'content';
        
        // Add file preview if present
        if (fileData && fileData.type.startsWith('image/')) {
            const filePreview = document.createElement('div');
            filePreview.className = 'file-attachment';
            
            const fileName = document.createElement('div');
            fileName.className = 'file-name';
            fileName.textContent = `📎 ${fileData.name}`;
            
            const img = document.createElement('img');
            img.src = fileData.url;
            img.alt = fileData.name;
            img.style.cssText = `
                max-width: 300px;
                max-height: 200px;
                border-radius: 8px;
                margin: 8px 0;
                display: block;
                cursor: pointer;
                transition: transform 0.2s;
            `;
            
            // Add click to expand functionality
            img.onclick = () => this.showImageModal(fileData.url, fileData.name);
            img.onmouseover = () => img.style.transform = 'scale(1.02)';
            img.onmouseout = () => img.style.transform = 'scale(1)';
            
            filePreview.appendChild(fileName);
            filePreview.appendChild(img);
            contentDiv.appendChild(filePreview);
        } else if (fileData) {
            // Non-image files
            const filePreview = document.createElement('div');
            filePreview.className = 'file-attachment';
            filePreview.innerHTML = `📎 ${fileData.name}`;
            contentDiv.appendChild(filePreview);
        }
        
        // Add text content
        if (content) {
            const textDiv = document.createElement('div');
            textDiv.className = 'message-text';
            
            if (isUser) {
                textDiv.textContent = content;
            } else {
                textDiv.innerHTML = this.parseMarkdown(content);
            }
            
            contentDiv.appendChild(textDiv);
        }
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(contentDiv);
        this.messages.appendChild(messageDiv);
        this.scrollToBottom();
        
        return contentDiv.querySelector('.message-text') || contentDiv;
    }

    addTypingIndicator() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        messageDiv.id = 'typing';
        
        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.textContent = 'AI';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'content';
        
        const typing = document.createElement('div');
        typing.className = 'typing';
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.className = 'typing-dot';
            typing.appendChild(dot);
        }
        
        contentDiv.appendChild(typing);
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(contentDiv);
        this.messages.appendChild(messageDiv);
        this.scrollToBottom();
        
        return messageDiv;
    }

    removeTypingIndicator() {
        const typing = document.getElementById('typing');
        if (typing) typing.remove();
    }

    showImageModal(imageUrl, imageName) {
        // Create modal overlay
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            cursor: pointer;
        `;
        
        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            max-width: 90%;
            max-height: 90%;
            position: relative;
        `;
        
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = imageName;
        img.style.cssText = `
            max-width: 100%;
            max-height: 100%;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        `;
        
        const closeButton = document.createElement('div');
        closeButton.textContent = '×';
        closeButton.style.cssText = `
            position: absolute;
            top: -15px;
            right: -15px;
            background: white;
            color: black;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 20px;
            font-weight: bold;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        `;
        
        modalContent.appendChild(img);
        modalContent.appendChild(closeButton);
        modal.appendChild(modalContent);
        
        // Event listeners
        modal.onclick = (e) => {
            if (e.target === modal || e.target === closeButton) {
                document.body.removeChild(modal);
            }
        };
        
        // Prevent event bubbling on modal content
        modalContent.onclick = (e) => e.stopPropagation();
        
        document.body.appendChild(modal);
    }

    parseMarkdown(text) {
        if (!text) return '';
        
        // Escape HTML first
        text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        // Headers (must come before other formatting)
        text = text.replace(/^### (.*$)/gm, '<h3>$1</h3>');
        text = text.replace(/^## (.*$)/gm, '<h2>$1</h2>');
        text = text.replace(/^# (.*$)/gm, '<h1>$1</h1>');
        
        // Bold and Italic
        text = text.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Code blocks (must come before inline code)
        text = text.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        
        // Inline code
        text = text.replace(/`(.*?)`/g, '<code>$1</code>');
        
        // Links
        text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
        
        // Lists - Unordered
        text = text.replace(/^\* (.*$)/gm, '<ul><li>$1</li></ul>');
        text = text.replace(/^- (.*$)/gm, '<ul><li>$1</li></ul>');
        
        // Lists - Ordered
        text = text.replace(/^\d+\. (.*$)/gm, '<ol><li>$1</li></ol>');
        
        // Fix consecutive list items
        text = text.replace(/<\/ul>\s*<ul>/g, '');
        text = text.replace(/<\/ol>\s*<ol>/g, '');
        
        // Blockquotes
        text = text.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>');
        text = text.replace(/<\/blockquote>\s*<blockquote>/g, '<br>');
        
        // Horizontal rules
        text = text.replace(/^---$/gm, '<hr>');
        text = text.replace(/^\*\*\*$/gm, '<hr>');
        
        // Paragraphs - split by double newlines
        const paragraphs = text.split(/\n\s*\n/);
        text = paragraphs.map(p => {
            p = p.trim();
            if (!p) return '';
            
            // Don't wrap if already wrapped in block elements
            if (p.match(/^<(h[1-6]|ul|ol|pre|blockquote|hr)/)) {
                return p;
            }
            
            // Convert single newlines to <br> within paragraphs
            p = p.replace(/\n/g, '<br>');
            return `<p>${p}</p>`;
        }).join('');
        
        return text;
    }

    async sendMessage() {
        const message = this.input.value.trim();
        if (!message || this.isStreaming) return;

        // Prepare file data for chat history
        let fileData = null;
        if (this.currentFile) {
            fileData = {
                name: this.currentFile.name,
                type: this.currentFile.type,
                url: URL.createObjectURL(this.currentFile)
            };
        }

        this.addMessage(message, true, fileData);
        this.input.value = '';

        this.addTypingIndicator();
        this.isStreaming = true;
        this.sendBtn.disabled = true;

        try {
            await this.streamResponse(message);
        } catch (error) {
            this.showError('Failed to send message');
        } finally {
            this.removeTypingIndicator();
            this.isStreaming = false;
            this.sendBtn.disabled = false;
            this.clearFileSelection();
        }
    }

    clearFileSelection() {
        if (this.currentFile) {
            this.currentFile = null;
            this.fileInput.value = '';
            this.fileInfo.style.display = 'none';
        }
    }

    async streamResponse(message) {
        if (this.currentFile) {
            return this.handleFileUpload(message);
        } else {
            return this.handleStreamingChat(message);
        }
    }

    async handleFileUpload(message) {
        const formData = new FormData();
        formData.append('message', message);
        formData.append('model', this.modelSelect.value);
        formData.append('file', this.currentFile);

        try {
            const response = await fetch(`${this.apiBase}/chat/file`, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            this.removeTypingIndicator();
            
            if (data.success) {
                this.addMessage(data.response);
            } else {
                this.showError('Request failed');
            }
        } catch (error) {
            this.showError('Request failed');
            throw error;
        }
    }

    async handleStreamingChat(message) {
        return new Promise((resolve, reject) => {
            let responseContent = '';
            let responseElement = null;

            fetch(`${this.apiBase}/chat/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message,
                    model: this.modelSelect.value
                })
            })
            .then(response => {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                const processStream = () => {
                    return reader.read().then(({ done, value }) => {
                        if (done) {
                            resolve();
                            return;
                        }

                        const chunk = decoder.decode(value);
                        const lines = chunk.split('\n');

                        lines.forEach(line => {
                            if (line.startsWith('data: ')) {
                                try {
                                    const data = JSON.parse(line.slice(6));
                                    
                                    if (data.type === 'token') {
                                        if (!responseElement) {
                                            this.removeTypingIndicator();
                                            responseElement = this.addMessage('');
                                        }
                                        responseContent += data.content;
                                        responseElement.innerHTML = this.parseMarkdown(responseContent);
                                        this.scrollToBottom();
                                    } else if (data.type === 'done') {
                                        resolve();
                                    } else if (data.type === 'error') {
                                        this.showError('Stream error');
                                        reject(new Error(data.message));
                                    }
                                } catch (parseError) {
                                    // Skip malformed JSON
                                }
                            }
                        });

                        return processStream();
                    });
                };

                return processStream();
            })
            .catch(error => {
                this.showError('Stream failed');
                reject(error);
            });
        });
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    new OnileraChat();
});