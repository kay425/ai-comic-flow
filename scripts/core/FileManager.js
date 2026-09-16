// scripts/FlowEditor.js
export class FlowEditor {
    constructor(container) {
        this.container = container;
        this.svg = container.querySelector('#svgCanvas');
        this.nodesContainer = container.querySelector('#nodesContainer');
        
        this.selectedNodes = new Set();
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        
        this.nodes = new Map();
        this.connections = [];
        this.nextId = 1;
        
        // 拖拽状态
        this._isDragging = false;
        this._dragTargetId = null;
        this._dragStartX = 0;
        this._dragStartY = 0;
        this._dragOrigX = 0;
        this._dragOrigY = 0;
        
        // 缩放状态
        this._isResizing = false;
        this._resizeTargetId = null;
        this._resizeStartX = 0;
        this._resizeStartY = 0;
        this._resizeOrigWidth = 0;
        this._resizeOrigHeight = 0;
        
        // 框选状态
        this._isBoxSelecting = false;
        this._boxStartX = 0;
        this._boxStartY = 0;
        this._boxEl = null;
        
        this.isPanning = false;
        this.isConnecting = false;
        this.tempLine = null;
        this.connectionFromId = null;
        
        this._dragStarted = false;
        this._isDropProcessing = false;
        
        // 编辑状态
        this._editingNodeId = null;
        
        this.init();
    }
    
    init() {
        this.setupCanvasEvents();
        this.setupToolbarEvents();
        this.setupModalEvents();
        this.setupDragDrop();
        this.setupGlobalEvents();
        this.setupKeyboardShortcuts();
        this.render();
        this.updateStats();
    }
    
    // ==========================================
    // 画布事件
    // ==========================================
    
    applyTransform() {
        const t = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
        this.nodesContainer.style.transform = t;
    }
    
    clientToWorld(clientX, clientY) {
        const rect = this.container.getBoundingClientRect();
        return {
            x: (clientX - rect.left - this.panX) / this.zoom,
            y: (clientY - rect.top - this.panY) / this.zoom
        };
    }
    
    clientToCanvas(clientX, clientY) {
        const rect = this.container.getBoundingClientRect();
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }
    
    getPortCenter(nodeId, portType = 'output') {
        const el = this.nodesContainer.querySelector(`.node[data-id="${nodeId}"]`);
        if (!el) return null;
        const port = el.querySelector(portType === 'output' ? '.port-output' : '.port-input');
        if (!port) return null;
        const rect = this.container.getBoundingClientRect();
        const pr = port.getBoundingClientRect();
        return {
            x: pr.left + pr.width / 2 - rect.left,
            y: pr.top + pr.height / 2 - rect.top
        };
    }
    
    setupCanvasEvents() {
        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                const rect = this.container.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                const worldX = (mouseX - this.panX) / this.zoom;
                const worldY = (mouseY - this.panY) / this.zoom;
                let factor = Math.exp(-e.deltaY * 0.01);
                factor = Math.min(Math.max(factor, 0.85), 1.15);
                const newZoom = Math.min(Math.max(this.zoom * factor, 0.3), 2.5);
                this.panX = mouseX - worldX * newZoom;
                this.panY = mouseY - worldY * newZoom;
                this.zoom = newZoom;
                this.applyTransform();
                this.renderConnectionsOnly();
            } else {
                this.panX -= e.deltaX;
                this.panY -= e.deltaY;
                this.applyTransform();
                this.renderConnectionsOnly();
            }
        }, { passive: false });
        
        this.container.addEventListener('pointerdown', (e) => {
            const target = e.target;
            const isNode = target.closest && target.closest('.node');
            const isPort = target.closest && target.closest('.port');
            const isDeleteBtn = target.closest && target.closest('.node-delete-btn');
            const isImageGrid = target.closest && target.closest('.node-image-grid');
            const isAddImageBtn = target.closest && target.closest('.add-image-btn');
            const isSingleImage = target.closest && target.closest('.single-image');
            const isResizeHandle = target.closest && target.closest('.node-resize-handle');
            const isTextContent = target.closest && target.closest('.node-text-content');
            const isFileInfo = target.closest && target.closest('.node-file-info');
            const isTextarea = target.closest && target.closest('.node-textarea');
            
            if (isNode || isPort || isDeleteBtn || isImageGrid || isAddImageBtn || 
                isSingleImage || isResizeHandle || isTextContent || isFileInfo || isTextarea) {
                return;
            }
            
            if (e.button === 0) {
                const onBlank = target === this.container || 
                               target === this.nodesContainer || 
                               target === this.svg;
                if (onBlank) {
                    this._isBoxSelecting = true;
                    const world = this.clientToWorld(e.clientX, e.clientY);
                    this._boxStartX = world.x;
                    this._boxStartY = world.y;
                    this._createBoxEl();
                    this.selectedNodes.clear();
                    this.render();
                }
            }
        });
        
        window.addEventListener('pointermove', (e) => {
            if (this._isBoxSelecting && this._boxEl) {
                const world = this.clientToWorld(e.clientX, e.clientY);
                const x = Math.min(this._boxStartX, world.x);
                const y = Math.min(this._boxStartY, world.y);
                const w = Math.abs(world.x - this._boxStartX);
                const h = Math.abs(world.y - this._boxStartY);
                this._boxEl.style.left = x + 'px';
                this._boxEl.style.top = y + 'px';
                this._boxEl.style.width = w + 'px';
                this._boxEl.style.height = h + 'px';
                this._boxEl.style.display = 'block';
                this._updateBoxSelection(x, y, w, h);
            }
        });
        
        window.addEventListener('pointerup', (e) => {
            if (this._isBoxSelecting) {
                this._isBoxSelecting = false;
                if (this._boxEl) {
                    this._boxEl.style.display = 'none';
                }
                this.render();
            }
        });
    }
    
    _createBoxEl() {
        if (!this._boxEl) {
            this._boxEl = document.createElement('div');
            this._boxEl.className = 'box-select';
            this._boxEl.style.cssText = `
                position: absolute;
                border: 1.5px solid #58a6ff;
                background: rgba(88, 166, 255, 0.1);
                pointer-events: none;
                z-index: 50;
                display: none;
            `;
            this.container.appendChild(this._boxEl);
        }
    }
    
    _updateBoxSelection(x, y, w, h) {
        this.selectedNodes.clear();
        this.nodes.forEach((node, id) => {
            const nx = node.x;
            const ny = node.y;
            const nw = node.width || 150;
            const nh = node.height || 70;
            if (nx < x + w && nx + nw > x && ny < y + h && ny + nh > y) {
                this.selectedNodes.add(id);
            }
        });
        this._updateSelectionHighlight();
    }
    
    _updateSelectionHighlight() {
        this.nodesContainer.querySelectorAll('.node').forEach(el => {
            const id = parseInt(el.dataset.id);
            el.classList.toggle('selected', this.selectedNodes.has(id));
        });
    }
    
    // ==========================================
    // 全局事件
    // ==========================================
    
    setupGlobalEvents() {
        if (this._globalEventsBound) return;
        this._globalEventsBound = true;
        
        window.addEventListener('pointermove', (e) => {
            this._onMove(e.clientX, e.clientY);
        });
        
        window.addEventListener('pointerup', (e) => {
            this._onUp(e.clientX, e.clientY);
        });
    }
    
    _onMove(cx, cy) {
        // 平移画布
        if (this.isPanning) {
            this.panX = cx - this._dragStartX;
            this.panY = cy - this._dragStartY;
            this.applyTransform();
            this.renderConnectionsOnly();
            return;
        }
        
        // 缩放节点
        if (this._isResizing) {
            const node = this.nodes.get(this._resizeTargetId);
            if (!node) return;
            const dx = (cx - this._resizeStartX) / this.zoom;
            const dy = (cy - this._resizeStartY) / this.zoom;
            const newWidth = Math.max(120, this._resizeOrigWidth + dx);
            const newHeight = Math.max(80, this._resizeOrigHeight + dy);
            node.width = newWidth;
            node.height = newHeight;
            const el = this.nodesContainer.querySelector(`.node[data-id="${this._resizeTargetId}"]`);
            if (el) {
                el.style.width = newWidth + 'px';
                el.style.height = newHeight + 'px';
            }
            this.renderConnectionsOnly();
            return;
        }
        
        // 拖拽节点
        if (this._isDragging) {
            const node = this.nodes.get(this._dragTargetId);
            if (!node) return;
            const dx = (cx - this._dragStartX) / this.zoom;
            const dy = (cy - this._dragStartY) / this.zoom;
            node.x = this._dragOrigX + dx;
            node.y = this._dragOrigY + dy;
            const el = this.nodesContainer.querySelector(`.node[data-id="${this._dragTargetId}"]`);
            if (el) {
                el.style.left = node.x + 'px';
                el.style.top = node.y + 'px';
            }
            this.renderConnectionsOnly();
            return;
        }
        
        // 连线
        if (this.isConnecting && this.tempLine) {
            const p = this.clientToCanvas(cx, cy);
            this.tempLine.setAttribute('x2', p.x);
            this.tempLine.setAttribute('y2', p.y);
        }
    }
    
    _onUp(cx, cy) {
        if (this.isPanning) {
            this.isPanning = false;
            this.container.classList.remove('dragging');
            this.container.style.cursor = 'grab';
            return;
        }
        
        if (this._isResizing) {
            this._isResizing = false;
            this._resizeTargetId = null;
            this.renderConnectionsOnly();
            return;
        }
        
        if (this._isDragging) {
            const targetId = this._dragTargetId;
            const el = this.nodesContainer.querySelector(`.node[data-id="${targetId}"]`);
            if (el) {
                el.classList.remove('is-dragging');
                el.style.cursor = 'pointer';
                el.style.zIndex = 2;
            }
            this._isDragging = false;
            this._dragTargetId = null;
            this._dragStarted = false;
            this.renderConnectionsOnly();
            return;
        }
        
        if (this.isConnecting) {
            this.isConnecting = false;
            if (this.tempLine) {
                this.tempLine.remove();
                this.tempLine = null;
            }
            const target = document.elementFromPoint(cx, cy);
            let targetPort = null;
            let current = target;
            while (current && current !== document.body) {
                if (current.classList && current.classList.contains('port-input')) {
                    targetPort = current;
                    break;
                }
                current = current.parentElement;
            }
            if (targetPort && this.connectionFromId !== null) {
                const fromId = this.connectionFromId;
                const toId = parseInt(targetPort.dataset.id);
                if (toId !== fromId && this.nodes.has(toId)) {
                    const exists = this.connections.some(c => c.from === fromId && c.to === toId);
                    if (!exists) {
                        this.connections.push({ from: fromId, to: toId, id: 'conn_' + Date.now() });
                        this.render();
                        this.updateStats();
                    }
                }
            }
            this.connectionFromId = null;
        }
    }
    
    // ==========================================
    // 键盘快捷键 - 修复 Ctrl+A 在输入框中不触发全选
    // ==========================================
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // 检查焦点是否在输入框或文本域中
            const activeEl = document.activeElement;
            const isInInput = activeEl && (
                activeEl.tagName === 'INPUT' || 
                activeEl.tagName === 'TEXTAREA' || 
                activeEl.tagName === 'SELECT' ||
                activeEl.classList?.contains('node-textarea') ||
                activeEl.contentEditable === 'true'
            );
            
            // 如果焦点在输入框中，不处理快捷键，让浏览器原生行为生效
            if (isInInput) {
                // 但 Escape 仍然要处理，用于退出编辑
                if (e.key === 'Escape' && this._editingNodeId !== null) {
                    const textarea = activeEl;
                    if (textarea && textarea.classList.contains('node-textarea')) {
                        this._cancelTextEditing(this._editingNodeId);
                        e.preventDefault();
                    }
                }
                return;
            }
            
            // Delete / Backspace - 删除选中的节点
            if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedNodes.size > 0) {
                e.preventDefault();
                const ids = Array.from(this.selectedNodes);
                ids.forEach(id => this.deleteNode(id));
                this.selectedNodes.clear();
                this.render();
                this.updateStats();
            }
            
            // Escape - 取消选中
            if (e.key === 'Escape') {
                this.selectedNodes.clear();
                this.render();
            }
            
            // Ctrl+A - 全选节点（只有在非输入框时才触发）
            if (e.ctrlKey && e.key === 'a') {
                e.preventDefault();
                this.selectedNodes.clear();
                this.nodes.forEach((_, id) => this.selectedNodes.add(id));
                this.render();
            }
        });
    }
    
    // ==========================================
    // 工具栏
    // ==========================================
    
    setupToolbarEvents() {
        document.getElementById('clearBtn')?.addEventListener('click', () => {
            if (confirm('确定要清空所有节点和连线吗？')) {
                this.nodes.clear();
                this.connections = [];
                this.selectedNodes.clear();
                this.render();
                this.updateStats();
                document.getElementById('canvasHint')?.classList.remove('hidden');
            }
        });
        
        document.getElementById('exportBtn')?.addEventListener('click', () => this.exportProject());
        document.getElementById('importBtn')?.addEventListener('click', () => this.importProject());
        document.getElementById('selectFileBtn')?.addEventListener('click', () => {
            this.selectFile((path) => {
                document.getElementById('filePathInput').value = path;
            });
        });
    }
    
    // ==========================================
    // 模态框
    // ==========================================
    
    setupModalEvents() {
        const modal = document.getElementById('editModal');
        if (!modal) return;
        const close = () => { modal.style.display = 'none'; };
        document.getElementById('modalClose')?.addEventListener('click', close);
        document.getElementById('modalCancel')?.addEventListener('click', close);
        document.getElementById('modalSave')?.addEventListener('click', () => {
            this.saveNodeFromModal();
            close();
        });
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    }
    
    // ==========================================
    // 拖拽创建 + 文件拖入
    // ==========================================
    
    setupDragDrop() {
        document.querySelectorAll('.drag-item').forEach(item => {
            item.setAttribute('draggable', 'true');
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    type: item.dataset.type,
                    name: item.querySelector('.drag-label')?.textContent || '新节点'
                }));
                e.dataTransfer.effectAllowed = 'copy';
            });
        });
        
        this.container.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });
        
        this.container.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this._isDropProcessing) return;
            this._isDropProcessing = true;
            
            try {
                const rawData = e.dataTransfer.getData('text/plain');
                if (rawData) {
                    const data = JSON.parse(rawData);
                    const world = this.clientToWorld(e.clientX, e.clientY);
                    this.createNode({
                        name: data.name || '新节点',
                        type: data.type || 'text',
                        x: world.x - 70,
                        y: world.y - 35,
                        color: this.getTypeColor(data.type)
                    });
                    this.hideHint();
                } else if (e.dataTransfer.files.length > 0) {
                    const file = e.dataTransfer.files[0];
                    const world = this.clientToWorld(e.clientX, e.clientY);
                    const type = this.getFileType(file.name);
                    const nodeId = this.createNode({
                        name: file.name,
                        type: type,
                        filePath: file.path || file.name,
                        x: world.x - 70,
                        y: world.y - 35,
                        color: this.getTypeColor(type)
                    });
                    if (file.type.startsWith('image/')) {
                        this._loadImageToNode(nodeId, file);
                    }
                    if (file.type.startsWith('video/') || file.type.startsWith('audio/')) {
                        this._loadFileToNode(nodeId, file);
                    }
                    this.hideHint();
                }
            } catch (err) {
                console.error('拖拽创建失败:', err);
            }
            setTimeout(() => { this._isDropProcessing = false; }, 100);
        });
        
        const dropZone = document.getElementById('dropZone');
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('dragover');
                e.dataTransfer.dropEffect = 'copy';
            });
            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('dragover');
            });
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('dragover');
                if (this._isDropProcessing) return;
                this._isDropProcessing = true;
                
                try {
                    if (e.dataTransfer.files.length > 0) {
                        const rect = this.container.getBoundingClientRect();
                        const file = e.dataTransfer.files[0];
                        const world = this.clientToWorld(
                            rect.left + rect.width / 2,
                            rect.top + rect.height / 2
                        );
                        const type = this.getFileType(file.name);
                        const nodeId = this.createNode({
                            name: file.name,
                            type: type,
                            filePath: file.path || file.name,
                            x: world.x - 70,
                            y: world.y - 35,
                            color: this.getTypeColor(type)
                        });
                        if (file.type.startsWith('image/')) {
                            this._loadImageToNode(nodeId, file);
                        }
                        if (file.type.startsWith('video/') || file.type.startsWith('audio/')) {
                            this._loadFileToNode(nodeId, file);
                        }
                        this.hideHint();
                    }
                } catch (err) {
                    console.error('文件拖入失败:', err);
                }
                setTimeout(() => { this._isDropProcessing = false; }, 100);
            });
        }
        
        document.addEventListener('dragover', (e) => e.preventDefault());
        document.addEventListener('drop', (e) => e.preventDefault());
    }
    
    // ==========================================
    // 文件加载到节点
    // ==========================================
    
    _loadImageToNode(nodeId, file) {
        const node = this.nodes.get(nodeId);
        if (!node) return;
        if (!node.images) node.images = [];
        const reader = new FileReader();
        reader.onload = (e) => {
            node.images.push({
                id: 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                name: file.name,
                dataUrl: e.target.result,
                filePath: file.path || file.name
            });
            this.render();
        };
        reader.readAsDataURL(file);
    }
    
    _loadFileToNode(nodeId, file) {
        const node = this.nodes.get(nodeId);
        if (!node) return;
        node.filePath = file.path || file.name;
        node.fileName = file.name;
        node.fileType = file.type;
        if (file.type.startsWith('video/') || file.type.startsWith('audio/')) {
            node.fileUrl = URL.createObjectURL(file);
        }
        this.render();
    }
    
    // ==========================================
    // 节点操作
    // ==========================================
    
    createNode(data) {
        const id = this.nextId++;
        
        // 根据类型设置默认宽高
        let defaultWidth = 150;
        let defaultHeight = 70;
        
        switch (data.type) {
            case 'text':
                defaultWidth = 180;
                defaultHeight = 160; // 文本节点需要更大高度
                break;
            case 'image':
                defaultWidth = 200;
                defaultHeight = 200;
                break;
            case 'video':
                defaultWidth = 220;
                defaultHeight = 180;
                break;
            case 'audio':
                defaultWidth = 200;
                defaultHeight = 160;
                break;
            case 'effect':
                defaultWidth = 180;
                defaultHeight = 140;
                break;
        }
        
        const node = {
            id,
            x: data.x || 100 + Math.random() * 200,
            y: data.y || 100 + Math.random() * 200,
            name: data.name || `节点 ${id}`,
            type: data.type || 'text',
            filePath: data.filePath || '',
            fileName: data.fileName || '',
            fileType: data.fileType || '',
            fileUrl: data.fileUrl || '',
            color: data.color || this.getTypeColor(data.type),
            width: data.width || defaultWidth,
            height: data.height || defaultHeight,
            content: data.content || '',
            images: data.images || [],
            textContent: data.textContent || ''
        };
        this.nodes.set(id, node);
        this.render();
        this.updateStats();
        this.hideHint();
        return id;
    }
    
    updateNode(id, data) {
        const node = this.nodes.get(id);
        if (node) {
            Object.assign(node, data);
            this.render();
            this.updateStats();
        }
    }
    
    deleteNode(id) {
        if (this.nodes.has(id)) {
            this.connections = this.connections.filter(c => c.from !== id && c.to !== id);
            const node = this.nodes.get(id);
            if (node && node.fileUrl && node.fileUrl.startsWith('blob:')) {
                URL.revokeObjectURL(node.fileUrl);
            }
            this.nodes.delete(id);
            this.selectedNodes.delete(id);
            this.render();
            this.updateStats();
            if (this.nodes.size === 0) {
                document.getElementById('canvasHint')?.classList.remove('hidden');
            }
        }
    }
    
    duplicateNode(id) {
        const node = this.nodes.get(id);
        if (node) {
            this.createNode({
                x: node.x + 30,
                y: node.y + 30,
                name: node.name + ' (复制)',
                type: node.type,
                filePath: node.filePath,
                color: node.color,
                content: node.content,
                images: node.images ? [...node.images] : [],
                textContent: node.textContent,
                fileName: node.fileName,
                fileType: node.fileType
            });
        }
    }
    
    getTypeColor(type) {
        const colors = { text: '#238636', image: '#1f6feb', video: '#d29922', audio: '#bc8cff', effect: '#f0883e' };
        return colors[type] || '#8b949e';
    }
    
    getFileType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        if (['txt', 'md', 'doc', 'docx', 'srt', 'ass'].includes(ext)) return 'text';
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image';
        if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v'].includes(ext)) return 'video';
        if (['mp3', 'wav', 'aac', 'flac', 'ogg', 'wma', 'm4a'].includes(ext)) return 'audio';
        if (['json', 'xml', 'csv', 'xlsx', 'txt'].includes(ext)) return 'effect';
        return 'text';
    }
    
    hideHint() { document.getElementById('canvasHint')?.classList.add('hidden'); }
    
    // ==========================================
    // 文件选择
    // ==========================================
    
    selectFile(callback, accept = '*/*') {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = accept;
        input.style.display = 'none';
        document.body.appendChild(input);
        input.addEventListener('change', () => {
            const files = Array.from(input.files);
            if (files.length > 0) {
                callback(files.map(f => f.path || f.name).join(', '));
            }
            document.body.removeChild(input);
        });
        input.click();
    }
    
    selectFileForNode(nodeId, accept = '*/*') {
        const node = this.nodes.get(nodeId);
        if (!node) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.style.display = 'none';
        document.body.appendChild(input);
        input.addEventListener('change', () => {
            const file = input.files[0];
            if (file) {
                if (file.type.startsWith('image/')) {
                    this._loadImageToNode(nodeId, file);
                } else {
                    this._loadFileToNode(nodeId, file);
                }
                node.filePath = file.path || file.name;
                node.fileName = file.name;
                this.render();
            }
            document.body.removeChild(input);
        });
        input.click();
    }
    
    openNodeFileLocation(id) {
        const node = this.nodes.get(id);
        if (!node) return;
        
        const filePath = node.filePath || (node.images && node.images.length > 0 ? node.images[0].filePath : '');
        
        if (filePath) {
            try {
                window.open(filePath, '_blank');
            } catch (e) {
                alert('文件路径: ' + filePath + '\n（在桌面应用中会打开文件所在文件夹）');
            }
        } else {
            alert('该节点没有关联文件');
        }
    }
    
    // ==========================================
    // 导出到其他软件
    // ==========================================
    
    setupDragOutSupport(element, nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return;
        
        element.setAttribute('draggable', 'true');
        element.addEventListener('dragstart', (e) => {
            const filePath = node.filePath || (node.images && node.images.length > 0 ? node.images[0].filePath : '');
            if (filePath) {
                e.dataTransfer.setData('text/plain', filePath);
                e.dataTransfer.setData('text/uri-list', 'file://' + filePath);
                e.dataTransfer.effectAllowed = 'copy';
            }
        });
    }
    
    // ==========================================
    // 导入导出
    // ==========================================
    
    exportProject() {
        const data = {
            version: '1.0',
            exportTime: new Date().toISOString(),
            nodes: Array.from(this.nodes.entries()).map(([id, node]) => [
                id, 
                { 
                    ...node, 
                    images: node.images || [],
                    fileUrl: ''
                }
            ]),
            connections: this.connections
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `ai-comic-project-${Date.now()}.json`;
        a.click();
    }
    
    importProject() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = () => {
            const file = input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    this.nodes.clear();
                    data.nodes.forEach(([id, node]) => {
                        this.nodes.set(id, { 
                            ...node, 
                            images: node.images || [],
                            fileUrl: ''
                        });
                        if (id >= this.nextId) this.nextId = id + 1;
                    });
                    this.connections = data.connections || [];
                    this.selectedNodes.clear();
                    this.render();
                    this.updateStats();
                    if (this.nodes.size > 0) this.hideHint();
                    alert('✅ 导入成功！共 ' + this.nodes.size + ' 个节点');
                } catch (err) {
                    alert('❌ 导入失败: ' + err.message);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }
    
    // ==========================================
    // 模态框
    // ==========================================
    
    showModal(nodeId = null) {
        const modal = document.getElementById('editModal');
        if (!modal) return;
        const node = nodeId !== null ? this.nodes.get(nodeId) : null;
        document.getElementById('modalTitle').textContent = node ? '编辑节点' : '新建节点';
        document.getElementById('nodeNameInput').value = node ? node.name : '';
        document.getElementById('nodeTypeSelect').value = node ? node.type : 'text';
        document.getElementById('filePathInput').value = node ? node.filePath : '';
        document.getElementById('nodeColorInput').value = node ? node.color : '#4CAF50';
        modal.dataset.editId = nodeId || '';
        modal.style.display = 'flex';
    }
    
    saveNodeFromModal() {
        const modal = document.getElementById('editModal');
        const data = {
            name: document.getElementById('nodeNameInput').value || '未命名节点',
            type: document.getElementById('nodeTypeSelect').value,
            filePath: document.getElementById('filePathInput').value,
            color: document.getElementById('nodeColorInput').value
        };
        const editId = modal.dataset.editId;
        if (editId && this.nodes.has(parseInt(editId))) {
            this.updateNode(parseInt(editId), data);
        } else {
            this.createNode(data);
        }
    }
    
    // ==========================================
    // 统计
    // ==========================================
    
    updateStats() {
        document.getElementById('nodeCount').textContent = '节点: ' + this.nodes.size;
        document.getElementById('connectionCount').textContent = '连线: ' + this.connections.length;
    }
    
    // ==========================================
    // 渲染
    // ==========================================
    
    render() {
        this.nodesContainer.innerHTML = '';
        this.svg.innerHTML = '';
        
        this.nodes.forEach((node, id) => {
            this.nodesContainer.appendChild(this.createNodeElement(node, id));
        });
        
        this.applyTransform();
        this.renderConnectionsOnly();
    }
    
    renderConnectionsOnly() {
        this.svg.querySelectorAll('.connection-line, .connection-arrow, .temp-line').forEach(el => el.remove());
        this.connections.forEach(conn => {
            const fromNode = this.nodes.get(conn.from);
            const toNode = this.nodes.get(conn.to);
            if (fromNode && toNode) this.drawConnection(fromNode, toNode, false);
        });
    }
    
    drawConnection(fromNode, toNode, isTemp = false) {
        const fromPort = this.getPortCenter(fromNode.id, 'output');
        const toPort = this.getPortCenter(toNode.id, 'input');
        
        let x1, y1, x2, y2;
        if (fromPort && toPort) {
            x1 = fromPort.x;
            y1 = fromPort.y;
            x2 = toPort.x;
            y2 = toPort.y;
        } else {
            const fromEl = this.nodesContainer.querySelector(`.node[data-id="${fromNode.id}"]`);
            const toEl = this.nodesContainer.querySelector(`.node[data-id="${toNode.id}"]`);
            const fh = fromEl ? fromEl.offsetHeight : (fromNode.height || 70);
            const th = toEl ? toEl.offsetHeight : (toNode.height || 70);
            const fw = fromEl ? fromEl.offsetWidth : fromNode.width;
            x1 = (fromNode.x + fw) * this.zoom + this.panX;
            y1 = (fromNode.y + fh / 2) * this.zoom + this.panY;
            x2 = toNode.x * this.zoom + this.panX;
            y2 = (toNode.y + th / 2) * this.zoom + this.panY;
        }
        
        const dx = Math.abs(x2 - x1) / 2 + 20;
        const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('class', isTemp ? 'temp-line' : 'connection-line animated');
        path.setAttribute('stroke', '#58a6ff');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-dasharray', isTemp ? '6 4' : '8 6');
        this.svg.appendChild(path);
        
        if (!isTemp) {
            const angle = Math.atan2(y2 - y1, x2 - x1);
            const s = 10;
            const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            arrow.setAttribute('points', `${x2},${y2} ${x2 - s * Math.cos(angle - 0.4)},${y2 - s * Math.sin(angle - 0.4)} ${x2 - s * Math.cos(angle + 0.4)},${y2 - s * Math.sin(angle + 0.4)}`);
            arrow.setAttribute('fill', '#58a6ff');
            arrow.setAttribute('class', 'connection-arrow');
            this.svg.appendChild(arrow);
        }
    }
    
    // ==========================================
    // 创建节点元素
    // ==========================================
    
    createNodeElement(node, id) {
        const el = document.createElement('div');
        el.className = 'node';
        if (this.selectedNodes.has(id)) el.classList.add('selected');
        el.dataset.id = id;
        el.style.left = node.x + 'px';
        el.style.top = node.y + 'px';
        el.style.width = node.width + 'px';
        el.style.height = node.height + 'px';
        el.style.borderColor = node.color;
        
        const icons = { text: '📝', image: '🖼️', video: '🎬', audio: '🔊', effect: '✨' };
        const labels = { text: '文本剧本', image: '批量图片', video: '视频片段', audio: '音频', effect: '特效' };
        
        let contentHtml = '';
        
        if (node.type === 'text') {
            const isEditing = this._editingNodeId === id;
            const previewText = node.textContent || '';
            contentHtml = `
                <div class="node-text-content ${isEditing ? 'editing' : ''}" data-node-id="${id}" style="flex:1;min-height:40px;">
                    ${isEditing ? 
                        `<textarea class="node-textarea" data-node-id="${id}" style="min-height:60px;">${previewText}</textarea>` :
                        `<div class="node-text-preview">${previewText}</div>`
                    }
                </div>
            `;
        } else if (node.type === 'image') {
            const images = node.images || [];
            let gridHtml = '';
            if (images.length > 0) {
                gridHtml = `<div class="node-image-grid">`;
                images.forEach((img, idx) => {
                    gridHtml += `
                        <div class="single-image" data-img-idx="${idx}">
                            <img src="${img.dataUrl}" alt="${img.name}" loading="lazy">
                            <button class="img-delete-btn" data-img-idx="${idx}">✕</button>
                        </div>
                    `;
                });
                gridHtml += `</div>`;
            }
            contentHtml = `
                <div class="node-image-container" style="flex:1;">
                    ${gridHtml}
                    <button class="add-image-btn" data-node-id="${id}">+ 添加图片</button>
                </div>
            `;
        } else if (node.type === 'video') {
            const hasFile = node.filePath || node.fileUrl;
            contentHtml = `
                <div class="node-file-info" data-node-id="${id}" style="cursor:pointer;">
                    ${hasFile ? `🎬 ${node.fileName || node.filePath.split('/').pop()}` : '📁 点击选择视频或拖入文件'}
                </div>
                <div class="node-file-preview" style="flex:1;min-height:50px;">
                    ${node.fileUrl ? 
                        `<video controls style="max-height:100px;width:100%;"><source src="${node.fileUrl}"></video>` :
                        `<div class="file-placeholder" style="color:#484f58;font-size:11px;text-align:center;padding:8px;">🎬 视频预览</div>`
                    }
                </div>
            `;
        } else if (node.type === 'audio') {
            const hasFile = node.filePath || node.fileUrl;
            contentHtml = `
                <div class="node-file-info" data-node-id="${id}" style="cursor:pointer;">
                    ${hasFile ? `🎵 ${node.fileName || node.filePath.split('/').pop()}` : '📁 点击选择音频或拖入文件'}
                </div>
                <div class="node-file-preview" style="flex:1;min-height:50px;">
                    ${node.fileUrl ? 
                        `<audio controls style="width:100%;"><source src="${node.fileUrl}"></audio>` :
                        `<div class="file-placeholder" style="color:#484f58;font-size:11px;text-align:center;padding:8px;">🎵 音频预览</div>`
                    }
                </div>
            `;
        } else if (node.type === 'effect') {
            const hasFile = node.filePath;
            contentHtml = `
                <div class="node-file-info" data-node-id="${id}" style="cursor:pointer;">
                    ${hasFile ? `✨ ${node.fileName || node.filePath.split('/').pop()}` : '📁 点击选择特效文件或拖入文件'}
                </div>
                <div class="node-file-preview" style="flex:1;min-height:40px;">
                    <div class="file-placeholder" style="color:#484f58;font-size:11px;text-align:center;padding:8px;">
                        ${hasFile ? '✅ 已关联文件' : '✨ 点击选择特效文件'}
                    </div>
                </div>
            `;
        } else {
            contentHtml = `
                <div class="node-file-info" data-node-id="${id}">
                    ${node.filePath ? `📎 ${node.filePath.split('/').pop()}` : '无文件关联'}
                </div>
            `;
        }
        
        el.innerHTML = `
            <div class="node-header">
                <span class="node-type-icon">${icons[node.type] || '📄'}</span>
                <button class="node-delete-btn" data-delete="${id}">✕</button>
            </div>
            <div class="node-title">${node.name}</div>
            <div class="node-type-label">${labels[node.type] || '通用'}</div>
            ${contentHtml}
            <div class="port port-output" data-port="output" data-id="${id}"></div>
            <div class="port port-input" data-port="input" data-id="${id}"></div>
            <div class="node-resize-handle" data-resize="${id}"></div>
        `;
        
        // ===== 缩放把手 =====
        const resizeHandle = el.querySelector('.node-resize-handle');
        if (resizeHandle) {
            resizeHandle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this._isResizing = true;
                this._resizeTargetId = id;
                this._resizeStartX = e.clientX;
                this._resizeStartY = e.clientY;
                this._resizeOrigWidth = node.width || 150;
                this._resizeOrigHeight = node.height || 70;
            });
        }
        
        // ===== 文本节点：点击即可编辑 =====
        const textContent = el.querySelector('.node-text-content');
        if (textContent && node.type === 'text') {
            textContent.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this._editingNodeId !== id) {
                    this._startTextEditing(id);
                }
            });
        }
        
        // ===== 文件信息点击：选择文件（视频/音频/特效） =====
        const fileInfo = el.querySelector('.node-file-info');
        if (fileInfo && ['video', 'audio', 'effect'].includes(node.type)) {
            fileInfo.addEventListener('click', (e) => {
                e.stopPropagation();
                let accept = '*/*';
                if (node.type === 'video') accept = 'video/*';
                else if (node.type === 'audio') accept = 'audio/*';
                else if (node.type === 'effect') accept = '.json,.xml,.csv,.xlsx,.txt';
                this.selectFileForNode(id, accept);
            });
            
            fileInfo.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                fileInfo.classList.add('dragover');
            });
            fileInfo.addEventListener('dragleave', (e) => {
                fileInfo.classList.remove('dragover');
            });
            fileInfo.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                fileInfo.classList.remove('dragover');
                if (e.dataTransfer.files.length > 0) {
                    const file = e.dataTransfer.files[0];
                    if (node.type === 'video' && !file.type.startsWith('video/')) {
                        alert('请拖入视频文件');
                        return;
                    }
                    if (node.type === 'audio' && !file.type.startsWith('audio/')) {
                        alert('请拖入音频文件');
                        return;
                    }
                    this._loadFileToNode(id, file);
                    node.filePath = file.path || file.name;
                    node.fileName = file.name;
                    this.render();
                }
            });
            
            this.setupDragOutSupport(fileInfo, id);
        }
        
        // ===== 图片节点拖出支持 =====
        if (node.type === 'image') {
            const imgContainer = el.querySelector('.node-image-container');
            if (imgContainer) {
                this.setupDragOutSupport(imgContainer, id);
            }
        }
        
        // ===== 节点拖拽 =====
        el.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            if (e.target.closest('.node-delete-btn')) return;
            if (e.target.closest('.port')) return;
            if (e.target.closest('.add-image-btn')) return;
            if (e.target.closest('.single-image')) return;
            if (e.target.closest('.node-textarea')) return;
            if (e.target.closest('.node-resize-handle')) return;
            if (e.target.closest('.node-text-content')) return;
            if (e.target.closest('.node-file-info')) return;
            if (this._editingNodeId !== null) return;
            
            if (e.shiftKey) {
                if (this.selectedNodes.has(id)) {
                    this.selectedNodes.delete(id);
                } else {
                    this.selectedNodes.add(id);
                }
                this.render();
                return;
            }
            
            if (!e.shiftKey) {
                this.selectedNodes.clear();
                this.selectedNodes.add(id);
                this.render();
            }
            
            this._dragStarted = true;
            this._isDragging = true;
            this._dragTargetId = id;
            this._dragStartX = e.clientX;
            this._dragStartY = e.clientY;
            this._dragOrigX = node.x;
            this._dragOrigY = node.y;
            el.classList.add('is-dragging');
            el.style.cursor = 'grabbing';
            el.style.zIndex = 10;
            e.preventDefault();
        });
        
        // ===== 双击编辑文本 =====
        el.addEventListener('dblclick', (e) => {
            if (e.target.closest('.node-delete-btn')) return;
            if (e.target.closest('.port')) return;
            if (e.target.closest('.add-image-btn')) return;
            if (e.target.closest('.single-image')) return;
            if (e.target.closest('.node-text-content')) return;
            if (e.target.closest('.node-file-info')) return;
            
            if (node.type === 'text') {
                this._startTextEditing(id);
            }
        });
        
        // ===== 双指点击 -> 打开文件目录 =====
        el.addEventListener('auxclick', (e) => {
            if (e.button === 1) {
                e.preventDefault();
                this.openNodeFileLocation(id);
            }
        });
        
        // ===== 删除按钮 =====
        el.querySelector('.node-delete-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteNode(id);
            this.selectedNodes.delete(id);
        });
        
        // ===== 端口连线 =====
        const outputPort = el.querySelector('.port-output');
        if (outputPort) {
            outputPort.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.startConnection(id, e.clientX, e.clientY);
            });
        }
        
        // ===== 图片节点事件 =====
        if (node.type === 'image') {
            const addBtn = el.querySelector('.add-image-btn');
            if (addBtn) {
                addBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._addImagesToNode(id);
                });
            }
            
            el.querySelectorAll('.img-delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = parseInt(btn.dataset.imgIdx);
                    if (node.images && node.images[idx]) {
                        node.images.splice(idx, 1);
                        this.render();
                    }
                });
            });
            
            el.querySelectorAll('.single-image img').forEach(img => {
                img.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = parseInt(img.closest('.single-image').dataset.imgIdx);
                    if (node.images && node.images[idx]) {
                        this._previewImage(node.images[idx].dataUrl);
                    }
                });
            });
            
            el.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                el.style.borderColor = '#58a6ff';
                el.style.boxShadow = '0 0 30px rgba(88,166,255,0.3)';
            });
            
            el.addEventListener('dragleave', (e) => {
                el.style.borderColor = node.color;
                el.style.boxShadow = '';
            });
            
            el.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                el.style.borderColor = node.color;
                el.style.boxShadow = '';
                if (e.dataTransfer.files.length > 0) {
                    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                    files.forEach(file => {
                        this._loadImageToNode(id, file);
                    });
                }
            });
        }
        
        // ===== 文本节点编辑事件 =====
        if (node.type === 'text' && this._editingNodeId === id) {
            const textarea = el.querySelector('.node-textarea');
            if (textarea) {
                textarea.focus();
                textarea.select();
                
                textarea.addEventListener('blur', () => {
                    this._saveTextEditing(id, textarea.value);
                });
                
                textarea.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') {
                        this._cancelTextEditing(id);
                    }
                    if (e.key === 'Enter' && e.shiftKey) {
                        return;
                    }
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this._saveTextEditing(id, textarea.value);
                    }
                });
                
                const saveHandler = (e) => {
                    if (!el.contains(e.target)) {
                        this._saveTextEditing(id, textarea.value);
                        document.removeEventListener('click', saveHandler);
                    }
                };
                setTimeout(() => {
                    document.addEventListener('click', saveHandler);
                }, 10);
            }
        }
        
        return el;
    }
    
    // ==========================================
    // 文本编辑
    // ==========================================
    
    _startTextEditing(id) {
        const node = this.nodes.get(id);
        if (!node) return;
        if (this._editingNodeId !== null && this._editingNodeId !== id) {
            const oldEl = this.nodesContainer.querySelector(`.node[data-id="${this._editingNodeId}"]`);
            const oldTextarea = oldEl?.querySelector('.node-textarea');
            if (oldTextarea) {
                this._saveTextEditing(this._editingNodeId, oldTextarea.value);
            }
        }
        this._editingNodeId = id;
        this.render();
    }
    
    _saveTextEditing(id, value) {
        const node = this.nodes.get(id);
        if (node) {
            node.textContent = value;
        }
        this._editingNodeId = null;
        this.render();
    }
    
    _cancelTextEditing(id) {
        this._editingNodeId = null;
        this.render();
    }
    
    // ==========================================
    // 图片操作
    // ==========================================
    
    _addImagesToNode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'image/*';
        input.style.display = 'none';
        document.body.appendChild(input);
        input.addEventListener('change', () => {
            const files = Array.from(input.files);
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (!node.images) node.images = [];
                    node.images.push({
                        id: 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                        name: file.name,
                        dataUrl: e.target.result,
                        filePath: file.path || file.name
                    });
                    this.render();
                };
                reader.readAsDataURL(file);
            });
            document.body.removeChild(input);
        });
        input.click();
    }
    
    _previewImage(dataUrl) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.85);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            cursor: pointer;
        `;
        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.cssText = `
            max-width: 90%;
            max-height: 90%;
            object-fit: contain;
            border-radius: 8px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        `;
        overlay.appendChild(img);
        overlay.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });
        document.body.appendChild(overlay);
    }
    
    // ==========================================
    // 连线
    // ==========================================
    
    startConnection(fromId, clientX, clientY) {
        const fromNode = this.nodes.get(fromId);
        if (!fromNode) return;
        this.isConnecting = true;
        this.connectionFromId = fromId;
        const start = this.getPortCenter(fromId, 'output') || this.clientToCanvas(clientX, clientY);
        const cursor = this.clientToCanvas(clientX, clientY);
        this.tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        this.tempLine.setAttribute('class', 'temp-line');
        this.tempLine.setAttribute('stroke', '#58a6ff');
        this.tempLine.setAttribute('stroke-width', '2');
        this.tempLine.setAttribute('stroke-dasharray', '6 4');
        this.tempLine.setAttribute('x1', start.x);
        this.tempLine.setAttribute('y1', start.y);
        this.tempLine.setAttribute('x2', cursor.x);
        this.tempLine.setAttribute('y2', cursor.y);
        this.svg.appendChild(this.tempLine);
    }
}