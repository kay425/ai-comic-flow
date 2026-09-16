// scripts/core/FlowEditor.js - 完整修复版

export class FlowEditor {
    constructor(container) {
        this.container = container;
        this.svg = container.querySelector('#svgCanvas');
        this.nodesContainer = container.querySelector('#nodesContainer');

        this.selectedNodes = new Set();
        this.selectedConnections = new Set();
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;

        this.nodes = new Map();
        this.connections = [];
        this.nextId = 1;
        this.connectionIdCounter = 1;

        // 修改标记
        this._hasUnsavedChanges = false;

        this._isDragging = false;
        this._dragTargetId = null;
        this._dragStartX = 0;
        this._dragStartY = 0;
        this._dragOrigX = 0;
        this._dragOrigY = 0;

        this._isResizing = false;
        this._resizeTargetId = null;
        this._resizeStartX = 0;
        this._resizeStartY = 0;
        this._resizeOrigWidth = 0;
        this._resizeOrigHeight = 0;

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
        this._editingNodeId = null;

        this._currentFilePath = null;
        this._isNewProject = true;
        this._projectName = '未命名项目';

        this.init();
    }

    init() {
        this.setupCanvasEvents();
        this.setupToolbarEvents();
        this.setupModalEvents();
        this.setupDragDrop();
        this.setupGlobalEvents();
        this.setupKeyboardShortcuts();
        this.setupFilePathRightClick();
        this.render();
        this.updateStats();
        this.updateTitle();
        this.updateFilePathDisplay(null);
        this._clearDirty();
        
        this._addAnimationStyles();
    }

    // ==========================================
    // 修改标记
    // ==========================================

    _markDirty() {
        if (!this._hasUnsavedChanges) {
            this._hasUnsavedChanges = true;
            this._updateDirtyIndicator();
        }
    }

    _clearDirty() {
        if (this._hasUnsavedChanges) {
            this._hasUnsavedChanges = false;
            this._updateDirtyIndicator();
        }
    }

    _updateDirtyIndicator() {
        const display = document.getElementById('filePathDisplay');
        if (display) {
            let text = display.textContent;
            const hasStar = text.includes(' *');
            if (this._hasUnsavedChanges) {
                if (!hasStar) {
                    display.textContent = text + ' *';
                }
            } else {
                if (hasStar) {
                    display.textContent = text.replace(' *', '');
                }
            }
        }
        this.updateTitle();
    }

    _addAnimationStyles() {
        if (document.getElementById('flow-editor-styles')) return;
        const style = document.createElement('style');
        style.id = 'flow-editor-styles';
        style.textContent = `
            @keyframes slideUp {
                from { opacity: 0; transform: translateX(-50%) translateY(20px); }
                to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
            @keyframes slideDown {
                from { opacity: 1; transform: translateX(-50%) translateY(0); }
                to { opacity: 0; transform: translateX(-50%) translateY(20px); }
            }
            
            .connection-line.selectable { cursor: pointer; }
            .connection-line.selectable:hover {
                stroke: #89c9ff !important;
                stroke-width: 4 !important;
            }
            .connection-line.selected {
                stroke: #f85149 !important;
                stroke-width: 4 !important;
                filter: drop-shadow(0 0 8px rgba(248, 81, 73, 0.5));
            }
            .connection-line.selected + .connection-arrow {
                fill: #f85149 !important;
            }
            
            .canvas-svg {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                overflow: visible;
                pointer-events: none;
                z-index: 1;
            }
            .connection-group {
                pointer-events: all !important;
                cursor: pointer !important;
            }
            .connection-group .connection-hit {
                pointer-events: all !important;
                cursor: pointer !important;
            }
            .connection-group .connection-visual {
                pointer-events: none !important;
            }
            
            .nodes-container {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                transform-origin: 0 0;
                pointer-events: none;
                z-index: 2;
            }
            .node {
                pointer-events: auto !important;
            }
            .port {
                pointer-events: all !important;
            }
            .file-action-btn {
                pointer-events: auto !important;
            }
            
            .node.drag-over {
                border-color: #58a6ff !important;
                box-shadow: 0 0 30px rgba(88, 166, 255, 0.3) !important;
            }
            
            .file-action-row {
                display: flex;
                gap: 4px;
                margin-top: 2px;
                flex-shrink: 0;
            }
            .file-action-btn {
                flex: 1;
                padding: 2px 4px;
                font-size: 10px;
                border-radius: 3px;
                border: 1px solid #30363d;
                background: #0d1117;
                color: #8b949e;
                cursor: pointer;
                text-align: center;
                transition: all 0.2s;
                user-select: none;
            }
            .file-action-btn:hover {
                border-color: #58a6ff;
                color: #c9d1d9;
                background: #1c2333;
            }
            .file-action-btn.drag-out {
                border-color: #d29922;
                color: #d29922;
            }
            .file-action-btn.drag-out:hover {
                border-color: #f0883e;
                color: #f0883e;
                background: #1c1a10;
            }
            .file-action-btn.drag-out:active {
                cursor: grabbing;
            }
            .file-action-btn .icon {
                font-size: 12px;
            }
            
            .node .node-file-info {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                max-width: 100%;
                display: block;
                font-size: 11px;
                padding: 3px 6px;
                flex-shrink: 0;
            }
            .node .node-file-preview {
                overflow: hidden;
                flex-shrink: 0;
            }
            
            .node[data-type="audio"] .node-file-preview {
                max-height: 70px;
                min-height: 40px;
            }
            .node[data-type="audio"] .node-file-preview audio {
                max-height: 50px;
                width: 100%;
            }
            .node[data-type="audio"] .file-placeholder {
                font-size: 11px;
                padding: 4px;
            }
            .node[data-type="audio"] {
                min-height: 180px;
            }
            
            .node[data-type="video"] .node-file-preview {
                max-height: 120px;
                min-height: 50px;
            }
            .node[data-type="video"] .node-file-preview video {
                max-height: 100px;
                width: 100%;
            }
            .node[data-type="video"] {
                min-height: 190px;
            }
            
            .node[data-type="text"] .node-text-content {
                flex: 1;
                min-height: 40px;
                max-height: 150px;
                overflow: auto;
            }
            
            .node[data-type="image"] .node-image-grid {
                max-height: 150px;
                overflow: auto;
            }
            
            .node[data-type="effect"] {
                min-height: 160px;
            }
        `;
        document.head.appendChild(style);
    }

    updateTitle() {
        const name = this._projectName || '未命名项目';
        const dirty = this._hasUnsavedChanges ? ' *' : '';
        const saved = this._currentFilePath ? '✅' : '📝';
        document.title = `${saved} ${name}${dirty} - AI漫剧流程图`;
    }

    updateFilePathDisplay(filePath) {
        const display = document.getElementById('filePathDisplay');
        if (display) {
            if (filePath) {
                display.textContent = '📁 ' + filePath;
                display.style.color = '#58a6ff';
                display.title = '右键点击打开文件所在位置';
                this._currentFilePath = filePath;
                this._isNewProject = false;
                const name = filePath.split(/[\\/]/).pop().replace('.json', '');
                this._projectName = name;
                this.updateTitle();
            } else {
                display.textContent = '📝 未命名项目';
                display.style.color = '#58a6ff';
                display.title = '右键点击打开文件所在位置';
                this._currentFilePath = null;
                this._isNewProject = true;
                this._projectName = '未命名项目';
                this.updateTitle();
            }
        }
        this._updateDirtyIndicator();
    }

    _showNotification(title, message) {
        if (window.electronAPI && window.electronAPI.showNotification) {
            window.electronAPI.showNotification(title, message);
        } else {
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                bottom: 30px;
                left: 50%;
                transform: translateX(-50%);
                background: #161b22;
                border: 1px solid #30363d;
                border-radius: 8px;
                padding: 12px 24px;
                color: #c9d1d9;
                font-size: 14px;
                z-index: 9999;
                box-shadow: 0 8px 40px rgba(0,0,0,0.6);
                max-width: 500px;
                text-align: center;
                animation: slideUp 0.3s ease-out;
            `;
            notification.innerHTML = `<strong>${title}</strong><br><span style="font-size:12px;color:#8b949e;">${message}</span>`;
            document.body.appendChild(notification);
            setTimeout(() => {
                notification.style.animation = 'slideDown 0.3s ease-in';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, 3000);
        }
    }

    // ==========================================
    // 文件路径右键打开目录
    // ==========================================

    setupFilePathRightClick() {
        const display = document.getElementById('filePathDisplay');
        if (display) {
            display.style.cursor = 'context-menu';
            display.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this._currentFilePath) {
                    this.openProjectFileLocation(this._currentFilePath);
                } else {
                    this._showNotification('📝 未保存的项目', '请先保存项目');
                }
            });
        }
    }

    // ==========================================
    // 打开文件位置（通用，用于图片节点双击/右键）
    // ==========================================

    async _openFileLocation(filePath) {
        // 直接使用传入的参数，不要读取任何其他数据
        const targetPath = filePath;
        
        console.log('🔥🔥🔥 [_openFileLocation] 入口参数:', targetPath);
        
        if (!targetPath) {
            this._showNotification('⚠️ 没有文件路径', '');
            return;
        }

        // 检查是否是示例文件（只有文件名，没有路径分隔符）
        const isExampleFile = !targetPath.includes('/') && !targetPath.includes('\\');
        
        if (isExampleFile || targetPath === '') {
            this._showNotification('⚠️ 示例图片', '请使用"添加图片"按钮上传真实图片文件后，再双击打开');
            return;
        }

        if (!window.electronAPI) {
            try {
                await navigator.clipboard.writeText(targetPath);
                this._showNotification('📋 路径已复制到剪贴板', targetPath);
            } catch (clipError) {
                this._showNotification('📂 文件路径', targetPath);
            }
            return;
        }

        try {
            console.log('📂 调用 electronAPI.openFileLocation, 参数:', targetPath);
            const result = await window.electronAPI.openFileLocation(targetPath);
            console.log('📂 返回结果:', result);
            
            if (result && result.success) {
                this._showNotification('✅ 已打开位置', targetPath);
            } else {
                const errorMsg = result?.error || '未知错误';
                this._showNotification('❌ 打开失败', errorMsg);
            }
        } catch (error) {
            console.error('❌ 打开文件位置异常:', error);
            this._showNotification('❌ 打开失败', error.message || '无法打开文件位置');
        }
    }

    // ==========================================
    // 打开文件位置（节点右键触发 - 用于非图片节点）
    // ==========================================

    async openNodeFileLocation(id) {
        const node = this.nodes.get(id);
        if (!node) return;

        // 对于图片节点，此方法不再使用（图片节点使用 _openFileLocation）
        // 但对于非图片节点（视频/音频/特效），仍然使用此方法
        let filePath = node.filePath;
        
        if (!filePath) {
            this._showNotification('⚠️ 没有关联文件', '该节点没有关联文件，请先选择文件');
            return;
        }

        // 检查是否是示例文件
        const isExampleFile = !filePath.includes('/') && !filePath.includes('\\');
        
        if (isExampleFile) {
            this._showNotification('⚠️ 示例文件', '请使用"选择文件"上传真实文件后，再打开位置');
            return;
        }

        console.log('📂 尝试打开文件位置:', filePath);

        try {
            if (window.electronAPI && window.electronAPI.openFileLocation) {
                const result = await window.electronAPI.openFileLocation(filePath);
                if (result.success) {
                    this._showNotification('✅ 已打开位置', filePath);
                } else {
                    const dirPath = filePath.replace(/[^/\\]+$/, '');
                    if (dirPath) {
                        const dirResult = await window.electronAPI.openFileLocation(dirPath);
                        if (!dirResult.success) {
                            this._showNotification('❌ 打开失败', result.error || '无法打开文件位置');
                        }
                    } else {
                        this._showNotification('❌ 打开失败', result.error || '无法打开文件位置');
                    }
                }
            } else {
                try {
                    window.open('file://' + filePath, '_blank');
                } catch (e) {
                    await navigator.clipboard.writeText(filePath);
                    this._showNotification('📋 路径已复制', filePath);
                }
            }
        } catch (error) {
            console.error('打开文件位置失败:', error);
            await navigator.clipboard.writeText(filePath);
            this._showNotification('📋 路径已复制', filePath);
        }
    }

    // ==========================================
    // 打开项目文件位置（顶部路径右键触发）
    // ==========================================

    async openProjectFileLocation(filePath) {
        if (!filePath) {
            this._showNotification('⚠️ 没有文件', '项目尚未保存');
            return;
        }
        
        // 检查是否是示例文件
        const isExampleFile = !filePath.includes('/') && !filePath.includes('\\');
        if (isExampleFile) {
            this._showNotification('⚠️ 示例文件', '请先保存项目为真实文件后再打开');
            return;
        }
        
        try {
            if (window.electronAPI && window.electronAPI.openFileLocation) {
                const result = await window.electronAPI.openFileLocation(filePath);
                if (result.success) {
                    this._showNotification('✅ 已打开位置', filePath);
                } else {
                    const dirPath = filePath.replace(/[^/\\]+$/, '');
                    if (dirPath) {
                        const dirResult = await window.electronAPI.openFileLocation(dirPath);
                        if (!dirResult.success) {
                            this._showNotification('❌ 打开失败', result.error || '无法打开文件位置');
                        }
                    } else {
                        this._showNotification('❌ 打开失败', result.error || '无法打开文件位置');
                    }
                }
            } else {
                try {
                    window.open('file://' + filePath, '_blank');
                } catch (e) {
                    navigator.clipboard.writeText(filePath).then(() => {
                        this._showNotification('📋 路径已复制', filePath);
                    }).catch(() => {
                        this._showNotification('📂 文件路径', filePath);
                    });
                }
            }
        } catch (error) {
            console.error('打开文件位置失败:', error);
            navigator.clipboard.writeText(filePath).then(() => {
                this._showNotification('📋 路径已复制', filePath);
            }).catch(() => {
                this._showNotification('📂 文件路径', filePath);
            });
        }
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
            const target = e.target;
            const isInScrollable = !!(target.closest && (
                target.closest('.node-text-preview') ||
                target.closest('.node-file-preview')
            ));

            if (isInScrollable) {
                return;
            }

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

        // 使用事件委托处理所有点击
        this.container.addEventListener('pointerdown', (e) => {
            const target = e.target;
            
            // 1. 检测连线点击
            const connectionGroup = target.closest && target.closest('.connection-group');
            if (connectionGroup && e.button === 0) {
                const connId = connectionGroup.dataset.connId;
                if (connId) {
                    e.stopPropagation();
                    e.preventDefault();
                    if (e.shiftKey) {
                        if (this.selectedConnections.has(connId)) {
                            this.selectedConnections.delete(connId);
                        } else {
                            this.selectedConnections.add(connId);
                        }
                    } else {
                        this.selectedConnections.clear();
                        this.selectedConnections.add(connId);
                        this.selectedNodes.clear();
                    }
                    this.renderConnectionsOnly();
                    return;
                }
            }
            
            // 2. 检测视频/音频
            if (target.closest && (target.closest('video') || target.closest('audio'))) {
                return;
            }
            
            // 3. 检测节点交互元素
            const isPort = target.closest && target.closest('.port');
            const isDeleteBtn = target.closest && target.closest('.node-delete-btn');
            const isAddImageBtn = target.closest && target.closest('.add-image-btn');
            const isSingleImage = target.closest && target.closest('.single-image');
            const isResizeHandle = target.closest && target.closest('.node-resize-handle');
            const isTextarea = target.closest && target.closest('.node-textarea');
            const isFileInfo = target.closest && target.closest('.node-file-info');
            const isTextContent = target.closest && target.closest('.node-text-content');
            const isImgDeleteBtn = target.closest && target.closest('.img-delete-btn');
            const isFilePreview = target.closest && target.closest('.node-file-preview');
            const isFileActionBtn = target.closest && target.closest('.file-action-btn');

            if (isPort || isDeleteBtn || isAddImageBtn || isSingleImage || 
                isResizeHandle || isTextarea || isTextContent || isImgDeleteBtn || 
                isFilePreview || isFileActionBtn) {
                return;
            }

            // 4. 检测节点点击
            const nodeEl = target.closest && target.closest('.node');
            if (nodeEl && e.button === 0 && !isFileInfo) {
                const id = parseInt(nodeEl.dataset.id);
                if (!isNaN(id)) {
                    if (e.shiftKey) {
                        if (this.selectedNodes.has(id)) {
                            this.selectedNodes.delete(id);
                        } else {
                            this.selectedNodes.add(id);
                        }
                        this.selectedConnections.clear();
                    } else {
                        this.selectedNodes.clear();
                        this.selectedConnections.clear();
                        this.selectedNodes.add(id);
                    }
                    this.render();
                    
                    const node = this.nodes.get(id);
                    if (node) {
                        this._dragStarted = true;
                        this._isDragging = false;
                        this._dragTargetId = id;
                        this._dragStartX = e.clientX;
                        this._dragStartY = e.clientY;
                        this._dragOrigX = node.x;
                        this._dragOrigY = node.y;
                        nodeEl.classList.add('is-dragging');
                        nodeEl.style.cursor = 'grabbing';
                        nodeEl.style.zIndex = 10;
                    }
                    e.preventDefault();
                    return;
                }
            }

            // 5. 点击空白区域
            if (e.button === 0) {
                const onBlank = target === this.container ||
                    target === this.nodesContainer ||
                    target === this.svg ||
                    target.classList?.contains('canvas-svg');
                if (onBlank) {
                    if (!e.shiftKey) {
                        this._isBoxSelecting = true;
                        const world = this.clientToWorld(e.clientX, e.clientY);
                        this._boxStartX = world.x;
                        this._boxStartY = world.y;
                        this._createBoxEl();
                        this.selectedNodes.clear();
                        this.selectedConnections.clear();
                        this.render();
                    } else {
                        this.selectedNodes.clear();
                        this.selectedConnections.clear();
                        this.render();
                    }
                }
            }
        });

        window.addEventListener('pointermove', (e) => {
            if (this._dragStarted && !this._isDragging) {
                const dx = e.clientX - this._dragStartX;
                const dy = e.clientY - this._dragStartY;
                if (Math.sqrt(dx * dx + dy * dy) > 5) {
                    this._isDragging = true;
                }
            }
            
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

        window.addEventListener('pointerup', () => {
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
            this.container.appendChild(this._boxEl);
        }
    }

    _updateBoxSelection(x, y, w, h) {
        this.selectedNodes.clear();
        this.selectedConnections.clear();
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
        if (this.isPanning) {
            this.panX = cx - this._dragStartX;
            this.panY = cy - this._dragStartY;
            this.applyTransform();
            this.renderConnectionsOnly();
            return;
        }

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
            this._markDirty();
            this.renderConnectionsOnly();
            return;
        }

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
            this._markDirty();
            this.renderConnectionsOnly();
            return;
        }

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

        if (this._dragStarted) {
            const targetId = this._dragTargetId;
            const el = this.nodesContainer.querySelector(`.node[data-id="${targetId}"]`);
            if (el) {
                el.classList.remove('is-dragging');
                el.style.cursor = 'pointer';
                el.style.zIndex = 2;
            }
            this._dragStarted = false;
            this._dragTargetId = null;
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
                        this.connections.push({ 
                            from: fromId, 
                            to: toId, 
                            id: 'conn_' + (this.connectionIdCounter++) 
                        });
                        this._markDirty();
                        this.render();
                        this.updateStats();
                    }
                }
            }
            this.connectionFromId = null;
        }
    }

    // ==========================================
    // 键盘快捷键
    // ==========================================

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                e.preventDefault();
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (e.shiftKey) {
                    this.saveProjectAs();
                } else {
                    this.saveProject();
                }
                return;
            }

            const activeEl = document.activeElement;
            const isEditingText = this._editingNodeId !== null;
            const isInInput = !!(activeEl && (
                activeEl.tagName === 'INPUT' ||
                activeEl.tagName === 'TEXTAREA' ||
                activeEl.tagName === 'SELECT' ||
                activeEl.isContentEditable ||
                activeEl.closest?.('.node-textarea') ||
                activeEl.classList?.contains('node-textarea')
            ));

            if (isInInput || isEditingText) {
                if (e.key === 'Escape' && isEditingText) {
                    this._cancelTextEditing(this._editingNodeId);
                    e.preventDefault();
                }
                return;
            }

            // 删除选中的节点（同时删除关联连线）
            if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedNodes.size > 0) {
                e.preventDefault();
                const ids = Array.from(this.selectedNodes);
                ids.forEach(id => this.deleteNode(id));
                this.selectedNodes.clear();
                this.render();
                this.updateStats();
                return;
            }

            // 删除选中的连线
            if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedConnections.size > 0) {
                e.preventDefault();
                const ids = Array.from(this.selectedConnections);
                ids.forEach(id => {
                    const idx = this.connections.findIndex(c => c.id === id);
                    if (idx !== -1) {
                        this.connections.splice(idx, 1);
                    }
                });
                this.selectedConnections.clear();
                this._markDirty();
                this.render();
                this.updateStats();
                return;
            }

            if (e.key === 'Escape') {
                this.selectedNodes.clear();
                this.selectedConnections.clear();
                this.render();
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                this.selectedNodes.clear();
                this.selectedConnections.clear();
                this.nodes.forEach((_, id) => this.selectedNodes.add(id));
                this.render();
            }
        });
    }

    // ==========================================
    // 保存逻辑
    // ==========================================

    async saveProject() {
        const data = this._getProjectData();
        
        try {
            if (!window.electronAPI) {
                this._downloadSave();
                return;
            }
            
            const result = await window.electronAPI.saveProject(data);
            if (result.success) {
                this._currentFilePath = result.filePath;
                this._isNewProject = false;
                this._projectName = result.fileName.replace('.json', '');
                this.updateTitle();
                this.updateFilePathDisplay(result.filePath);
                this._clearDirty();
                this._showNotification('✅ 项目已保存', `位置: ${result.filePath}`);
            } else if (result.canceled) {
            } else {
                this._showNotification('❌ 保存失败', result.error);
            }
        } catch (error) {
            console.error('保存失败:', error);
            this._showNotification('❌ 保存失败', error.message);
        }
    }

    async saveProjectAs() {
        const data = this._getProjectData();
        
        try {
            if (!window.electronAPI) {
                this._downloadSave();
                return;
            }
            
            const result = await window.electronAPI.saveProjectAs(data);
            if (result.success) {
                this._currentFilePath = result.filePath;
                this._isNewProject = false;
                this._projectName = result.fileName.replace('.json', '');
                this.updateTitle();
                this.updateFilePathDisplay(result.filePath);
                this._clearDirty();
                this._showNotification('✅ 另存为成功', `位置: ${result.filePath}`);
            } else if (result.canceled) {
            } else {
                this._showNotification('❌ 另存为失败', result.error);
            }
        } catch (error) {
            console.error('另存为失败:', error);
            this._showNotification('❌ 另存为失败', error.message);
        }
    }

    _downloadSave() {
        const data = this._getProjectData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `${this._projectName}-${timestamp}.json`;
        a.download = fileName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        this.updateFilePathDisplay('下载/' + fileName);
        this._clearDirty();
        this._showNotification('💾 项目已下载', `文件名: ${fileName}`);
    }

    async importProject() {
        try {
            if (!window.electronAPI) {
                this._browserImportProject();
                return;
            }
            
            const result = await window.electronAPI.importProject();
            if (result.success) {
                this.nodes.clear();
                this.connections = [];
                this.selectedNodes.clear();
                this.selectedConnections.clear();
                this.nextId = 1;
                this.connectionIdCounter = 1;
                
                const data = result.data;
                data.nodes.forEach(([id, node]) => {
                    this.nodes.set(id, {
                        ...node,
                        images: node.images || [],
                        fileUrl: ''
                    });
                    if (id >= this.nextId) this.nextId = id + 1;
                });
                this.connections = data.connections || [];
                this.connections.forEach(c => {
                    const num = parseInt(c.id.replace('conn_', ''));
                    if (num >= this.connectionIdCounter) this.connectionIdCounter = num + 1;
                });
                
                this._currentFilePath = result.filePath;
                this._isNewProject = false;
                this._projectName = result.fileName.replace('.json', '');
                this.updateTitle();
                this.updateFilePathDisplay(result.filePath);
                this._clearDirty();
                
                this.render();
                this.updateStats();
                if (this.nodes.size > 0) this.hideHint();
                
                this._showNotification('✅ 导入成功', `节点: ${this.nodes.size}, 连线: ${this.connections.length}`);
            } else if (result.canceled) {
            } else {
                this._showNotification('❌ 导入失败', result.error);
            }
        } catch (error) {
            console.error('导入失败:', error);
            this._showNotification('❌ 导入失败', error.message);
        }
    }

    _browserImportProject() {
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
                    this.connections = [];
                    this.selectedNodes.clear();
                    this.selectedConnections.clear();
                    this.nextId = 1;
                    this.connectionIdCounter = 1;
                    
                    data.nodes.forEach(([id, node]) => {
                        this.nodes.set(id, {
                            ...node,
                            images: node.images || [],
                            fileUrl: ''
                        });
                        if (id >= this.nextId) this.nextId = id + 1;
                    });
                    this.connections = data.connections || [];
                    this.connections.forEach(c => {
                        const num = parseInt(c.id.replace('conn_', ''));
                        if (num >= this.connectionIdCounter) this.connectionIdCounter = num + 1;
                    });
                    
                    this.render();
                    this.updateStats();
                    if (this.nodes.size > 0) this.hideHint();
                    this._clearDirty();
                    this._showNotification('✅ 导入成功', `共 ${this.nodes.size} 个节点`);
                } catch (err) {
                    this._showNotification('❌ 导入失败', err.message);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    _getProjectData() {
        return {
            version: '1.0',
            exportTime: new Date().toISOString(),
            projectName: this._projectName,
            nodeCount: this.nodes.size,
            connectionCount: this.connections.length,
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
                this.selectedConnections.clear();
                this._markDirty();
                this.render();
                this.updateStats();
                document.getElementById('canvasHint')?.classList.remove('hidden');
            }
        });

        document.getElementById('saveBtn')?.addEventListener('click', () => {
            this.saveProject();
        });

        document.getElementById('saveAsBtn')?.addEventListener('click', () => {
            this.saveProjectAs();
        });

        document.getElementById('importBtn')?.addEventListener('click', () => {
            this.importProject();
        });

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
    // 默认宽高
    // ==========================================

    getDefaultWidth(type) {
        const widths = {
            text: 180,
            image: 200,
            video: 220,
            audio: 200,
            effect: 180
        };
        return widths[type] || 150;
    }

    getDefaultHeight(type) {
        const heights = {
            text: 180,
            image: 220,
            video: 220,
            audio: 230,
            effect: 180
        };
        return heights[type] || 100;
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
                        color: this.getTypeColor(data.type),
                        width: this.getDefaultWidth(data.type),
                        height: this.getDefaultHeight(data.type)
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
                        color: this.getTypeColor(type),
                        width: this.getDefaultWidth(type),
                        height: this.getDefaultHeight(type)
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
                            color: this.getTypeColor(type),
                            width: this.getDefaultWidth(type),
                            height: this.getDefaultHeight(type)
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
        
        let filePath = file.path || file.name;
        const isFullPath = filePath.includes('/') || filePath.includes('\\');
        
        const reader = new FileReader();
        reader.onload = (e) => {
            node.images.push({
                id: 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                name: file.name,
                dataUrl: e.target.result,
                filePath: isFullPath ? filePath : ''
            });
            if (isFullPath) {
                node.filePath = filePath;
                node.fileName = file.name;
            }
            this._markDirty();
            this.render();
            if (!isFullPath) {
                this._showNotification('⚠️ 路径不完整', '请使用"添加图片"按钮选择图片');
            } else {
                this._showNotification('✅ 图片已添加', file.name);
            }
        };
        reader.readAsDataURL(file);
    }

    _loadFileToNode(nodeId, file) {
        const node = this.nodes.get(nodeId);
        if (!node) return;
        
        let filePath = file.path || file.name;
        const isFullPath = filePath.includes('/') || filePath.includes('\\');
        
        if (!isFullPath) {
            this._showNotification('⚠️ 路径不完整', '请使用"选择文件"按钮选择文件，拖拽可能无法获取完整路径');
            node.filePath = '';
            node.fileName = file.name;
            node.fileType = file.type;
            if (file.type.startsWith('video/') || file.type.startsWith('audio/')) {
                if (node.fileUrl && node.fileUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(node.fileUrl);
                }
                node.fileUrl = URL.createObjectURL(file);
            }
            this._markDirty();
            this.render();
            this._showNotification('⚠️ 路径不完整，请使用"选择文件"按钮', file.name);
            return;
        }
        
        node.filePath = filePath;
        node.fileName = file.name;
        node.fileType = file.type;
        
        if (file.type.startsWith('video/') || file.type.startsWith('audio/')) {
            if (node.fileUrl && node.fileUrl.startsWith('blob:')) {
                URL.revokeObjectURL(node.fileUrl);
            }
            node.fileUrl = 'file://' + filePath;
        }
        this._markDirty();
        this.render();
        this._showNotification('✅ 文件已加载', file.name);
    }

    // ==========================================
    // 添加图片到节点（使用 Electron dialog）
    // ==========================================

    async _addImagesToNode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return;
        
        try {
            if (!window.electronAPI || !window.electronAPI.selectImageFiles) {
                this._showNotification('❌ 仅支持 Electron 环境', '请使用桌面应用');
                return;
            }
            
            const filePaths = await window.electronAPI.selectImageFiles();
            
            if (filePaths && filePaths.length > 0) {
                for (const filePath of filePaths) {
                    const fileName = filePath.split(/[\\/]/).pop();
                    
                    try {
                        const response = await fetch('file://' + filePath);
                        const blob = await response.blob();
                        const reader = new FileReader();
                        
                        reader.onload = (e) => {
                            if (!node.images) node.images = [];
                            node.images.push({
                                id: 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                                name: fileName,
                                dataUrl: e.target.result,
                                filePath: filePath
                            });
                            node.filePath = filePath;
                            node.fileName = fileName;
                            this._markDirty();
                            this.render();
                        };
                        reader.readAsDataURL(blob);
                    } catch (fetchError) {
                        console.error('读取文件失败:', fetchError);
                        this._showNotification('⚠️ 读取文件失败', fileName);
                    }
                }
                this._showNotification('✅ 已添加 ' + filePaths.length + ' 张图片', '');
            }
        } catch (error) {
            console.error('添加图片失败:', error);
            this._showNotification('❌ 添加图片失败', error.message);
        }
    }

    // ==========================================
    // 为节点选择文件（使用 Electron dialog 获取完整路径）
    // ==========================================

    async selectFileForNode(nodeId, accept = '*/*') {
        const node = this.nodes.get(nodeId);
        if (!node) return;
        
        try {
            if (!window.electronAPI || !window.electronAPI.selectFile) {
                this._showNotification('❌ 仅支持 Electron 环境', '请使用桌面应用');
                return;
            }
            
            let filters = [{ name: '所有文件', extensions: ['*'] }];
            if (accept === 'image/*') {
                filters = [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'] }];
            } else if (accept === 'video/*') {
                filters = [{ name: '视频', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v'] }];
            } else if (accept === 'audio/*') {
                filters = [{ name: '音频', extensions: ['mp3', 'wav', 'aac', 'flac', 'ogg', 'wma', 'm4a'] }];
            } else if (accept.includes('txt') || accept.includes('md') || accept.includes('srt')) {
                filters = [{ name: '文本', extensions: ['txt', 'md', 'srt', 'ass'] }];
            } else if (accept.includes('json') || accept.includes('xml') || accept.includes('csv')) {
                filters = [{ name: '数据文件', extensions: ['json', 'xml', 'csv', 'xlsx'] }];
            }
            
            const filePath = await window.electronAPI.selectFile(filters);
            
            if (filePath) {
                const fileName = filePath.split(/[\\/]/).pop();
                const ext = fileName.split('.').pop().toLowerCase();
                const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
                const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v'];
                const audioExts = ['mp3', 'wav', 'aac', 'flac', 'ogg', 'wma', 'm4a'];
                
                if (imageExts.includes(ext)) {
                    const response = await fetch('file://' + filePath);
                    const blob = await response.blob();
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        if (!node.images) node.images = [];
                        node.images.push({
                            id: 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                            name: fileName,
                            dataUrl: e.target.result,
                            filePath: filePath
                        });
                        node.filePath = filePath;
                        node.fileName = fileName;
                        this._markDirty();
                        this.render();
                        this._showNotification('✅ 文件已选择', fileName);
                    };
                    reader.readAsDataURL(blob);
                } else {
                    node.filePath = filePath;
                    node.fileName = fileName;
                    
                    if (videoExts.includes(ext)) {
                        node.fileType = 'video';
                        if (node.fileUrl && node.fileUrl.startsWith('blob:')) {
                            URL.revokeObjectURL(node.fileUrl);
                        }
                        node.fileUrl = 'file://' + filePath;
                    } else if (audioExts.includes(ext)) {
                        node.fileType = 'audio';
                        if (node.fileUrl && node.fileUrl.startsWith('blob:')) {
                            URL.revokeObjectURL(node.fileUrl);
                        }
                        node.fileUrl = 'file://' + filePath;
                    }
                    
                    this._markDirty();
                    this.render();
                    this._showNotification('✅ 文件已选择', fileName);
                }
            }
        } catch (error) {
            console.error('选择文件失败:', error);
            this._showNotification('❌ 选择文件失败', error.message);
        }
    }

    // ==========================================
    // 节点操作
    // ==========================================

    createNode(data) {
        const id = this.nextId++;

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
            width: data.width || this.getDefaultWidth(data.type),
            height: data.height || this.getDefaultHeight(data.type),
            content: data.content || '',
            images: data.images || [],
            textContent: data.textContent || ''
        };
        this.nodes.set(id, node);
        this._markDirty();
        this.render();
        this.updateStats();
        this.hideHint();
        return id;
    }

    updateNode(id, data) {
        const node = this.nodes.get(id);
        if (node) {
            Object.assign(node, data);
            this._markDirty();
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
            this._markDirty();
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
                fileType: node.fileType,
                width: node.width,
                height: node.height
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
    // 文件选择（通用）
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
        const toRemove = this.svg.querySelectorAll('.connection-group, .temp-line, .connection-line, .connection-arrow');
        toRemove.forEach(el => el.remove());
        
        this.connections.forEach(conn => {
            const fromNode = this.nodes.get(conn.from);
            const toNode = this.nodes.get(conn.to);
            if (fromNode && toNode) {
                this.drawConnection(fromNode, toNode, conn.id);
            }
        });
    }

    drawConnection(fromNode, toNode, connId) {
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

        const isSelected = this.selectedConnections.has(connId);
        
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('data-conn-id', connId);
        g.setAttribute('class', 'connection-group');
        g.style.cursor = 'pointer';
        g.style.pointerEvents = 'all';
        
        const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hitPath.setAttribute('d', d);
        hitPath.setAttribute('stroke', 'transparent');
        hitPath.setAttribute('stroke-width', '20');
        hitPath.setAttribute('fill', 'none');
        hitPath.setAttribute('data-conn-id', connId);
        hitPath.setAttribute('class', 'connection-hit');
        hitPath.style.pointerEvents = 'all';
        hitPath.style.cursor = 'pointer';
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('class', `connection-line animated ${isSelected ? 'selected' : ''}`);
        path.setAttribute('stroke', isSelected ? '#f85149' : '#6aafff');
        path.setAttribute('stroke-width', isSelected ? '4' : '2.5');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-dasharray', '10 8');
        path.setAttribute('data-conn-id', connId);
        path.setAttribute('class', 'connection-visual');
        path.style.pointerEvents = 'none';
        
        g.appendChild(hitPath);
        g.appendChild(path);

        const angle = Math.atan2(y2 - y1, x2 - x1);
        const s = 12;
        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        arrow.setAttribute('points', 
            `${x2},${y2} ${x2 - s * Math.cos(angle - 0.5)},${y2 - s * Math.sin(angle - 0.5)} ${x2 - s * Math.cos(angle + 0.5)},${y2 - s * Math.sin(angle + 0.5)}`
        );
        arrow.setAttribute('fill', isSelected ? '#f85149' : '#6aafff');
        arrow.setAttribute('class', 'connection-arrow');
        arrow.setAttribute('data-conn-id', connId);
        g.appendChild(arrow);
        
        g.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (e.shiftKey) {
                if (this.selectedConnections.has(connId)) {
                    this.selectedConnections.delete(connId);
                } else {
                    this.selectedConnections.add(connId);
                }
            } else {
                this.selectedConnections.clear();
                this.selectedNodes.clear();
                this.selectedConnections.add(connId);
            }
            this.renderConnectionsOnly();
        });
        
        g.addEventListener('mouseenter', () => {
            if (!isSelected) {
                path.setAttribute('stroke', '#89c9ff');
                path.setAttribute('stroke-width', '3.5');
            }
        });
        g.addEventListener('mouseleave', () => {
            if (!isSelected) {
                path.setAttribute('stroke', '#6aafff');
                path.setAttribute('stroke-width', '2.5');
            }
        });
        
        this.svg.appendChild(g);
    }

    // ==========================================
    // 创建节点元素
    // ==========================================

    createNodeElement(node, id) {
        const el = document.createElement('div');
        el.className = 'node';
        if (this.selectedNodes.has(id)) el.classList.add('selected');
        el.dataset.id = id;
        el.dataset.type = node.type;
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
                <div class="node-text-content ${isEditing ? 'editing' : ''}" data-node-id="${id}">
                    ${isEditing ? 
                        `<textarea class="node-textarea" data-node-id="${id}">${previewText}</textarea>` :
                        `<div class="node-text-preview">${previewText}</div>`
                    }
                </div>
            `;
        } else if (node.type === 'image') {
            const images = node.images || [];
            let gridHtml = '';

            if (images.length > 0) {
                gridHtml = `<div class="node-image-grid" style="grid-template-columns: repeat(4, 1fr);overflow:visible;">`;
                images.forEach((img, idx) => {
                    gridHtml += `
                        <div class="single-image" data-img-idx="${idx}" data-img-id="${img.id}">
                            <img src="${img.dataUrl}" alt="${img.name}" loading="lazy" draggable="true">
                            <button class="img-delete-btn" data-img-idx="${idx}" data-img-id="${img.id}">✕</button>
                        </div>
                    `;
                });
                gridHtml += `</div>`;
            } else {
                gridHtml = `<div class="node-image-grid" style="display:flex;align-items:center;justify-content:center;color:#484f58;font-size:11px;min-height:30px;overflow:visible;">暂无图片</div>`;
            }

            contentHtml = `
                <div class="node-image-container">
                    <button class="add-image-btn" data-node-id="${id}">＋ 添加图片</button>
                    ${gridHtml}
                </div>
            `;
        } else if (node.type === 'video') {
            const hasFile = node.filePath || node.fileUrl;
            const displayName = node.fileName || (node.filePath ? node.filePath.split(/[\\/]/).pop() : '');
            contentHtml = `
                <div class="file-action-row">
                    <button class="file-action-btn" data-action="select" data-node-id="${id}">
                        <span class="icon">📁</span> 选择文件
                    </button>
                    <button class="file-action-btn drag-out" data-action="drag" data-node-id="${id}">
                        <span class="icon">↗️</span> 拖拽到软件
                    </button>
                </div>
                <div class="node-file-info" data-node-id="${id}" title="${hasFile ? displayName : '未选择文件'}">
                    ${hasFile ? `🎬 ${displayName}` : '未选择文件'}
                </div>
                <div class="node-file-preview" data-node-id="${id}">
                    ${node.fileUrl ? 
                        `<video controls style="width:100%;max-height:100px;" data-node-id="${id}" playsinline>
                            <source src="${node.fileUrl}">
                        </video>` :
                        `<div class="file-placeholder">🎬 视频预览</div>`
                    }
                </div>
            `;
        } else if (node.type === 'audio') {
            const hasFile = node.filePath || node.fileUrl;
            const displayName = node.fileName || (node.filePath ? node.filePath.split(/[\\/]/).pop() : '');
            contentHtml = `
                <div class="file-action-row">
                    <button class="file-action-btn" data-action="select" data-node-id="${id}">
                        <span class="icon">📁</span> 选择文件
                    </button>
                    <button class="file-action-btn drag-out" data-action="drag" data-node-id="${id}">
                        <span class="icon">↗️</span> 拖拽到软件
                    </button>
                </div>
                <div class="node-file-info" data-node-id="${id}" title="${hasFile ? displayName : '未选择文件'}">
                    ${hasFile ? `🎵 ${displayName}` : '未选择文件'}
                </div>
                <div class="node-file-preview" data-node-id="${id}">
                    ${node.fileUrl ? 
                        `<audio controls style="width:100%;max-height:50px;" data-node-id="${id}">
                            <source src="${node.fileUrl}">
                        </audio>` :
                        `<div class="file-placeholder">🎵 音频预览</div>`
                    }
                </div>
            `;
        } else if (node.type === 'effect') {
            const hasFile = node.filePath;
            const displayName = node.fileName || (node.filePath ? node.filePath.split(/[\\/]/).pop() : '');
            contentHtml = `
                <div class="file-action-row">
                    <button class="file-action-btn" data-action="select" data-node-id="${id}">
                        <span class="icon">📁</span> 选择文件
                    </button>
                    <button class="file-action-btn drag-out" data-action="drag" data-node-id="${id}">
                        <span class="icon">↗️</span> 拖拽到软件
                    </button>
                </div>
                <div class="node-file-info" data-node-id="${id}" title="${hasFile ? displayName : '未选择文件'}">
                    ${hasFile ? `✨ ${displayName}` : '未选择文件'}
                </div>
                <div class="node-file-preview">
                    <div class="file-placeholder">${hasFile ? '✅ 已关联文件' : '✨ 特效参数配置'}</div>
                </div>
            `;
        } else {
            contentHtml = `
                <div class="node-file-info" data-node-id="${id}">
                    ${node.filePath ? `📎 ${node.filePath.split(/[\\/]/).pop()}` : '无文件关联'}
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

        // ===== 视频/音频元素 =====
        const videoEl = el.querySelector('video');
        if (videoEl) {
            videoEl.addEventListener('mousedown', (e) => { e.stopPropagation(); });
            videoEl.addEventListener('click', (e) => { e.stopPropagation(); });
            videoEl.style.pointerEvents = 'auto';
            videoEl.setAttribute('playsinline', '');
        }

        const audioEl = el.querySelector('audio');
        if (audioEl) {
            audioEl.addEventListener('mousedown', (e) => { e.stopPropagation(); });
            audioEl.addEventListener('click', (e) => { e.stopPropagation(); });
            audioEl.style.pointerEvents = 'auto';
        }

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

        // ===== 文本节点点击编辑 =====
        const textContent = el.querySelector('.node-text-content');
        if (textContent && node.type === 'text') {
            textContent.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this._editingNodeId !== id) {
                    this._startTextEditing(id);
                }
            });
        }

        // ===== 文件操作按钮（视频/音频/特效） =====
        const actionBtns = el.querySelectorAll('.file-action-btn');
        actionBtns.forEach(btn => {
            btn.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });
            
            if (btn.dataset.action === 'select') {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    let accept = '*/*';
                    if (node.type === 'video') accept = 'video/*';
                    else if (node.type === 'audio') accept = 'audio/*';
                    else if (node.type === 'effect') accept = '.json,.xml,.csv,.xlsx,.txt';
                    else if (node.type === 'text') accept = '.txt,.md,.srt,.ass';
                    else if (node.type === 'image') accept = 'image/*';
                    await this.selectFileForNode(id, accept);
                });
            }
            
            if (btn.dataset.action === 'drag') {
                this.setupDragOutSupport(btn, id);
                btn.title = '拖拽此按钮到其他软件（如剪映、微信）';
            }
        });

        // ===== 文件信息区域 - 右键打开文件位置（非图片节点） =====
        const fileInfo = el.querySelector('.node-file-info');
        if (fileInfo && node.type !== 'image') {
            fileInfo.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });
            
            fileInfo.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.openNodeFileLocation(id);
            });
            
            fileInfo.style.cursor = 'context-menu';
            fileInfo.title = '右键打开文件所在位置';
        }

        // ==========================================
        // 图片节点事件 - 使用 imgId 查找
        // ==========================================
        if (node.type === 'image') {
            const addBtn = el.querySelector('.add-image-btn');
            if (addBtn) {
                addBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await this._addImagesToNode(id);
                });
            }

            // 删除图片 - 使用 imgId
            el.querySelectorAll('.img-delete-btn').forEach(btn => {
                const imgId = btn.dataset.imgId;
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const imgIndex = node.images.findIndex(img => img.id === imgId);
                    if (imgIndex !== -1) {
                        node.images.splice(imgIndex, 1);
                        this._markDirty();
                        this.render();
                    }
                });
            });

            // 图片点击：预览 - 使用 imgId
            el.querySelectorAll('.single-image img').forEach(img => {
                const container = img.closest('.single-image');
                const imgId = container.dataset.imgId;
                img.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const imgData = node.images.find(img => img.id === imgId);
                    if (imgData) {
                        this._previewImage(imgData.dataUrl);
                    }
                });
            });

            // ============================================================
            // 图片双击：打开文件所在位置 - 使用 imgId
            // ============================================================
            el.querySelectorAll('.single-image').forEach(container => {
                const imgId = container.dataset.imgId;
                
                container.addEventListener('dblclick', async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    
                    const imgData = node.images.find(img => img.id === imgId);
                    
                    if (imgData) {
                        const filePath = imgData.filePath || '';
                        console.log(`🖱️ [双击] imgId: ${imgId}, 路径:`, filePath);
                        
                        if (filePath) {
                            await this._openFileLocation(filePath);
                        } else {
                            this._showNotification('⚠️ 没有文件路径', '该图片没有关联文件路径');
                        }
                    } else {
                        console.warn(`⚠️ [双击] 未找到图片, imgId: ${imgId}`);
                        this._showNotification('⚠️ 图片数据错误', '未找到对应图片');
                    }
                });
                
                // ============================================================
                // 图片右键：打开文件所在位置 - 使用 imgId（触控板双击也是右键）
                // ============================================================
                container.addEventListener('contextmenu', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const imgData = node.images.find(img => img.id === imgId);
                    
                    if (imgData) {
                        const filePath = imgData.filePath || '';
                        console.log(`🖱️ [右键] imgId: ${imgId}, 路径:`, filePath);
                        
                        if (filePath) {
                            await this._openFileLocation(filePath);
                        } else {
                            this._showNotification('⚠️ 没有文件路径', '该图片没有关联文件路径');
                        }
                    } else {
                        console.warn(`⚠️ [右键] 未找到图片, imgId: ${imgId}`);
                        this._showNotification('⚠️ 图片数据错误', '未找到对应图片');
                    }
                });
            });

            // ============================================================
            // 图片拖拽：拖出图片文件 - 使用 imgId
            // ============================================================
            el.querySelectorAll('.single-image img').forEach(img => {
                const container = img.closest('.single-image');
                const imgId = container.dataset.imgId;
                
                img.setAttribute('draggable', 'true');
                
                img.addEventListener('dragstart', (e) => {
                    e.stopPropagation();
                    const imgData = node.images.find(img => img.id === imgId);
                    
                    if (imgData) {
                        const filePath = imgData.filePath || '';
                        const fileName = imgData.name || 'image.png';
                        
                        if (filePath) {
                            try {
                                e.dataTransfer.setData('text/plain', filePath);
                                e.dataTransfer.setData('text/uri-list', 'file://' + encodeURI(filePath));
                                e.dataTransfer.effectAllowed = 'copy';
                                
                                const dragIcon = document.createElement('div');
                                dragIcon.textContent = '🖼️ ' + fileName;
                                dragIcon.style.cssText = `
                                    padding: 8px 16px;
                                    background: #161b22;
                                    color: #c9d1d9;
                                    border-radius: 8px;
                                    border: 1px solid #1f6feb;
                                    font-size: 13px;
                                    position: fixed;
                                    pointer-events: none;
                                    z-index: 9999;
                                    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                                    font-weight: 500;
                                `;
                                document.body.appendChild(dragIcon);
                                e.dataTransfer.setDragImage(dragIcon, 10, 10);
                                
                                setTimeout(() => {
                                    if (dragIcon.parentNode) {
                                        document.body.removeChild(dragIcon);
                                    }
                                }, 100);
                                
                                container.style.borderColor = '#1f6feb';
                                container.style.background = '#1c2333';
                            } catch (err) {
                                console.warn('拖拽失败:', err);
                            }
                        } else {
                            e.preventDefault();
                            this._showNotification('⚠️ 没有文件可拖出', '该图片没有关联文件路径');
                        }
                    } else {
                        e.preventDefault();
                    }
                });
                
                img.addEventListener('dragend', (e) => {
                    container.style.borderColor = '';
                    container.style.background = '';
                });
            });

            // 整个图片节点支持拖入文件
            el.addEventListener('dragover', (e) => {
                if (e.dataTransfer.types.includes('Files')) {
                    e.preventDefault();
                    e.stopPropagation();
                    el.classList.add('drag-over');
                }
            });

            el.addEventListener('dragleave', (e) => {
                el.classList.remove('drag-over');
            });

            el.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                el.classList.remove('drag-over');
                if (e.dataTransfer.files.length > 0) {
                    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                    if (files.length === 0) {
                        this._showNotification('⚠️ 请拖入图片文件', '支持: jpg, png, gif, webp等');
                        return;
                    }
                    files.forEach(file => {
                        this._loadImageToNode(id, file);
                    });
                    this._showNotification('✅ 已添加 ' + files.length + ' 张图片', '');
                }
            });
        }

        // ===== 整个节点支持从文件资源管理器拖入文件（视频/音频/特效/文本） =====
        if (node.type !== 'image') {
            el.addEventListener('dragover', (e) => {
                if (e.dataTransfer.types.includes('Files')) {
                    e.preventDefault();
                    e.stopPropagation();
                    el.classList.add('drag-over');
                }
            });

            el.addEventListener('dragleave', (e) => {
                el.classList.remove('drag-over');
            });

            el.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                el.classList.remove('drag-over');
                if (e.dataTransfer.files.length > 0) {
                    const file = e.dataTransfer.files[0];
                    this._handleFileDropToNode(id, file);
                }
            });
        }

        // ===== 右键打开文件目录（整个节点 - 非图片节点） =====
        if (node.type !== 'image') {
            el.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this._editingNodeId === id) return;
                this.openNodeFileLocation(id);
            });
        }

        // ===== 双击编辑文本 =====
        el.addEventListener('dblclick', (e) => {
            if (e.target.closest('.node-delete-btn')) return;
            if (e.target.closest('.port')) return;
            if (e.target.closest('.add-image-btn')) return;
            if (e.target.closest('.single-image')) return;
            if (e.target.closest('.node-text-content')) return;
            if (e.target.closest('.node-file-info')) return;
            if (e.target.closest('.file-action-btn')) return;
            if (e.target.closest('video') || e.target.closest('audio')) return;
            
            if (node.type === 'text') {
                this._startTextEditing(id);
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

        // ===== 文本节点编辑 =====
        if (node.type === 'text' && this._editingNodeId === id) {
            const textarea = el.querySelector('.node-textarea');
            if (textarea) {
                textarea.addEventListener('keydown', (e) => {
                    e.stopPropagation();
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        this._cancelTextEditing(id);
                        return;
                    }
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        this._saveTextEditing(id, textarea.value);
                    }
                });

                textarea.addEventListener('blur', () => {
                    setTimeout(() => {
                        if (this._editingNodeId !== id) return;
                        if (document.activeElement === textarea) return;
                        this._saveTextEditing(id, textarea.value);
                    }, 0);
                });

                const saveHandler = (e) => {
                    if (!el.contains(e.target)) {
                        this._saveTextEditing(id, textarea.value);
                        document.removeEventListener('mousedown', saveHandler);
                    }
                };
                setTimeout(() => {
                    document.addEventListener('mousedown', saveHandler);
                }, 10);
                
                setTimeout(() => {
                    textarea.focus();
                    textarea.select();
                }, 50);
            }
        }

        return el;
    }

    // ==========================================
    // 文件拖入处理
    // ==========================================

    _handleFileDropToNode(nodeId, file) {
        const node = this.nodes.get(nodeId);
        if (!node) return;

        if (node.type === 'image') {
            if (file.type.startsWith('image/')) {
                this._loadImageToNode(nodeId, file);
            } else {
                this._showNotification('⚠️ 请拖入图片文件', '支持: jpg, png, gif, webp等');
            }
        } else if (node.type === 'video') {
            if (file.type.startsWith('video/')) {
                this._loadFileToNode(nodeId, file);
            } else {
                this._showNotification('⚠️ 请拖入视频文件', '支持: mp4, mov, avi, mkv等');
            }
        } else if (node.type === 'audio') {
            if (file.type.startsWith('audio/')) {
                this._loadFileToNode(nodeId, file);
            } else {
                this._showNotification('⚠️ 请拖入音频文件', '支持: mp3, wav, flac, ogg等');
            }
        } else if (node.type === 'effect') {
            const validExts = ['.json', '.xml', '.csv', '.xlsx', '.txt'];
            const ext = '.' + file.name.split('.').pop().toLowerCase();
            if (validExts.includes(ext)) {
                this._loadFileToNode(nodeId, file);
            } else {
                this._showNotification('⚠️ 请拖入特效文件', '支持: json, xml, csv, xlsx, txt');
            }
        } else if (node.type === 'text') {
            if (file.type.startsWith('text/') || ['.txt', '.md', '.srt', '.ass'].some(ext => file.name.endsWith(ext))) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    node.textContent = e.target.result;
                    node.filePath = file.path || file.name;
                    node.fileName = file.name;
                    this._markDirty();
                    this.render();
                    this._showNotification('✅ 文本已更新', file.name);
                };
                reader.readAsText(file);
            } else {
                this._showNotification('⚠️ 请拖入文本文件', '支持: txt, md, srt, ass等');
            }
        }
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
            this._markDirty();
        }
        this._editingNodeId = null;
        this.render();
    }

    _cancelTextEditing(id) {
        this._editingNodeId = null;
        this.render();
    }

    // ==========================================
    // 图片预览
    // ==========================================

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
            backdrop-filter: blur(4px);
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
    // 拖拽导出到其他软件（视频/音频/特效）
    // ==========================================

    setupDragOutSupport(element, nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return;

        element.setAttribute('draggable', 'true');
        element.style.cursor = 'grab';

        element.removeEventListener('dragstart', element._dragStartHandler);
        element.removeEventListener('dragend', element._dragEndHandler);

        element._dragStartHandler = (e) => {
            e.stopPropagation();
            
            let filePath = '';
            let fileName = '';

            if (node.filePath) {
                filePath = node.filePath;
                fileName = node.fileName || node.filePath.split(/[\\/]/).pop();
            } else if (node.images && node.images.length > 0) {
                filePath = node.images[0].filePath;
                fileName = node.images[0].name;
            }

            if (filePath) {
                try {
                    e.dataTransfer.setData('text/plain', filePath);
                    e.dataTransfer.setData('text/uri-list', 'file://' + encodeURI(filePath));
                    e.dataTransfer.effectAllowed = 'copy';
                    
                    const dragIcon = document.createElement('div');
                    const iconEmoji = node.type === 'video' ? '🎬' : 
                                     node.type === 'audio' ? '🎵' : 
                                     node.type === 'image' ? '🖼️' : '📄';
                    dragIcon.textContent = iconEmoji + ' ' + (fileName || '文件');
                    dragIcon.style.cssText = `
                        padding: 8px 16px;
                        background: #161b22;
                        color: #c9d1d9;
                        border-radius: 8px;
                        border: 1px solid #d29922;
                        font-size: 13px;
                        position: fixed;
                        pointer-events: none;
                        z-index: 9999;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                        font-weight: 500;
                    `;
                    document.body.appendChild(dragIcon);
                    e.dataTransfer.setDragImage(dragIcon, 10, 10);
                    
                    setTimeout(() => {
                        if (dragIcon.parentNode) {
                            document.body.removeChild(dragIcon);
                        }
                    }, 100);
                    
                    element.style.borderColor = '#d29922';
                    element.style.background = '#1c1a10';
                } catch (err) {
                    console.warn('拖拽数据设置失败:', err);
                }
            } else {
                e.preventDefault();
                console.warn('⚠️ 没有文件可拖出');
            }
        };

        element._dragEndHandler = () => {
            element.style.borderColor = '';
            element.style.background = '';
        };

        element.addEventListener('dragstart', element._dragStartHandler);
        element.addEventListener('dragend', element._dragEndHandler);
        
        return element;
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