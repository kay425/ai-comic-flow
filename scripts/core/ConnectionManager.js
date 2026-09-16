// scripts/core/FlowEditor.js

import { Renderer } from './Renderer.js';
import { NodeManager } from './NodeManager.js';
import { ConnectionManager } from './ConnectionManager.js';
import { FileManager } from './FileManager.js';
import { MediaManager } from './MediaManager.js';
import { NodeUI } from '../ui/NodeUI.js';
import { ConnectionUI } from '../ui/ConnectionUI.js';
import { getFileType, getTypeColor, getDefaultSize, generateId } from '../utils/helpers.js';

export class FlowEditor {
    constructor(container) {
        this.container = container;
        this.svg = container.querySelector('#svgCanvas');
        this.nodesContainer = container.querySelector('#nodesContainer');

        // 数据
        this.nodes = new Map();
        this.connections = [];
        this.selectedNodes = new Set();
        this.selectedConnections = new Set();
        this.nextId = 1;
        this.connectionIdCounter = 1;

        // 视图状态
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;

        // 交互状态
        this._editingNodeId = null;
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
        this._isDropProcessing = false;
        this._globalEventsBound = false;

        // 项目状态
        this._currentFilePath = null;
        this._isNewProject = true;
        this._projectName = '未命名项目';

        // 初始化子模块
        this.renderer = new Renderer(this);
        this.nodeManager = new NodeManager(this);
        this.connectionManager = new ConnectionManager(this);
        this.fileManager = new FileManager(this);
        this.mediaManager = new MediaManager(this);
        this.nodeUI = new NodeUI(this);
        this.connectionUI = new ConnectionUI(this);

        this.init();
    }

    init() {
        this._setupCanvasEvents();
        this._setupToolbarEvents();
        this._setupModalEvents();
        this._setupDragDrop();
        this._setupGlobalEvents();
        this._setupKeyboardShortcuts();
        this._setupFilePathDoubleClick();
        this._addAnimationStyles();
        
        this.renderer.render();
        this.renderer.updateStats();
        this.updateTitle();
        this.updateFilePathDisplay(null);
    }

    // ========== 生命周期 ==========

    hideHint() {
        document.getElementById('canvasHint')?.classList.add('hidden');
    }

    updateTitle() {
        const name = this._projectName || '未命名项目';
        const saved = this._currentFilePath ? '✅' : '📝';
        document.title = `${saved} ${name} - AI漫剧流程图`;
    }

    updateFilePathDisplay(filePath) {
        const display = document.getElementById('filePathDisplay');
        if (!display) return;
        
        if (filePath) {
            display.textContent = '📁 ' + filePath;
            display.style.color = '#58a6ff';
            display.title = filePath;
            this._currentFilePath = filePath;
            this._isNewProject = false;
            this._projectName = filePath.split(/[\\/]/).pop().replace('.json', '');
            this.updateTitle();
        } else {
            display.textContent = '📝 未命名项目';
            display.style.color = '#58a6ff';
            display.title = '双击打开文件所在位置';
            this._currentFilePath = null;
            this._isNewProject = true;
            this._projectName = '未命名项目';
            this.updateTitle();
        }
    }

    // ========== 通知 ==========

    _showNotification(title, message) {
        if (window.electronAPI?.showNotification) {
            window.electronAPI.showNotification(title, message);
            return;
        }
        
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; bottom: 30px; left: 50%;
            transform: translateX(-50%);
            background: #161b22; border: 1px solid #30363d;
            border-radius: 8px; padding: 12px 24px;
            color: #c9d1d9; font-size: 14px;
            z-index: 9999; box-shadow: 0 8px 40px rgba(0,0,0,0.6);
            max-width: 500px; text-align: center;
            animation: slideUp 0.3s ease-out;
        `;
        notification.innerHTML = `<strong>${title}</strong><br><span style="font-size:12px;color:#8b949e;">${message}</span>`;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideDown 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
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
                stroke: #f0883e !important;
                stroke-width: 4 !important;
                filter: drop-shadow(0 0 8px rgba(240, 136, 62, 0.5));
            }
            .node.drag-over {
                border-color: #58a6ff !important;
                box-shadow: 0 0 30px rgba(88, 166, 255, 0.3) !important;
            }
        `;
        document.head.appendChild(style);
    }

    // ========== 文件路径双击 ==========

    _setupFilePathDoubleClick() {
        const display = document.getElementById('filePathDisplay');
        if (!display) return;
        
        display.style.cursor = 'pointer';
        display.title = '双击打开文件所在位置';
        
        display.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            if (this._currentFilePath) {
                this.openProjectFileLocation(this._currentFilePath);
            } else {
                this._showNotification('📝 未保存的项目', '请先保存项目');
            }
        });
    }

    async openProjectFileLocation(filePath) {
        if (!filePath) {
            this._showNotification('⚠️ 没有文件', '项目尚未保存');
            return;
        }
        
        try {
            if (window.electronAPI?.openFileLocation) {
                const result = await window.electronAPI.openFileLocation(filePath);
                if (!result.success) {
                    const dirPath = filePath.replace(/[^/\\]+$/, '');
                    if (dirPath) {
                        await window.electronAPI.openFileLocation(dirPath);
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

    // ========== 打开节点文件位置 ==========

    async openNodeFileLocation(id) {
        const filePath = this.fileManager.getNodeFilePath(id);
        if (!filePath) {
            this._showNotification('⚠️ 没有关联文件', '该节点没有关联文件');
            return;
        }
        
        console.log('📂 尝试打开文件位置:', filePath);
        
        try {
            if (window.electronAPI?.openFileLocation) {
                const result = await window.electronAPI.openFileLocation(filePath);
                if (!result.success) {
                    const dirPath = filePath.replace(/[^/\\]+$/, '');
                    if (dirPath) {
                        await window.electronAPI.openFileLocation(dirPath);
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

    // ========== 拖拽导出支持 ==========

    _setupDragOutSupport(element, nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return;

        element.setAttribute('draggable', 'true');
        element.style.cursor = 'grab';

        element.removeEventListener('dragstart', element._dragStartHandler);
        element.removeEventListener('dragend', element._dragEndHandler);

        element._dragStartHandler = (e) => {
            e.stopPropagation();
            
            let filePath = this.fileManager.getNodeFilePath(nodeId);
            let fileName = this.fileManager.getNodeFileName(nodeId);
            
            if (!filePath) {
                e.preventDefault();
                return;
            }
            
            try {
                this.mediaManager.saveState(nodeId);
                
                e.dataTransfer.setData('text/plain', filePath);
                e.dataTransfer.setData('text/uri-list', 'file://' + encodeURI(filePath));
                e.dataTransfer.effectAllowed = 'copy';
                
                const dragIcon = document.createElement('div');
                const iconMap = { video: '🎬', audio: '🎵', image: '🖼️', effect: '✨', text: '📝' };
                dragIcon.textContent = (iconMap[node.type] || '📄') + ' ' + (fileName || '文件');
                dragIcon.style.cssText = `
                    padding: 8px 16px; background: #161b22; color: #c9d1d9;
                    border-radius: 8px; border: 1px solid #58a6ff;
                    font-size: 13px; position: fixed; pointer-events: none;
                    z-index: 9999; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                    font-weight: 500;
                `;
                document.body.appendChild(dragIcon);
                e.dataTransfer.setDragImage(dragIcon, 10, 10);
                setTimeout(() => dragIcon.remove(), 100);
                
                element.style.borderColor = '#58a6ff';
                element.style.background = '#1c2333';
            } catch (err) {
                console.warn('拖拽数据设置失败:', err);
            }
        };

        element._dragEndHandler = () => {
            element.style.borderColor = '';
            element.style.background = '';
            this.mediaManager.restoreState(nodeId);
        };

        element.addEventListener('dragstart', element._dragStartHandler);
        element.addEventListener('dragend', element._dragEndHandler);
        
        return element;
    }

    // ========== 删除节点 ==========

    deleteNode(id) {
        this.nodeManager.deleteNode(id);
    }

    // ========== 图片预览 ==========

    _previewImage(dataUrl) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.85); display: flex;
            justify-content: center; align-items: center;
            z-index: 9999; cursor: pointer; backdrop-filter: blur(4px);
        `;
        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.cssText = `
            max-width: 90%; max-height: 90%; object-fit: contain;
            border-radius: 8px; box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        `;
        overlay.appendChild(img);
        overlay.addEventListener('click', () => overlay.remove());
        document.body.appendChild(overlay);
    }

    // ========== 添加图片到节点 ==========

    _addImagesToNode(nodeId) {
        this.fileManager.selectFile((files) => {
            files.forEach(file => {
                this.fileManager.loadImageToNode(nodeId, file);
            });
        }, 'image/*', true);
    }

    // ========== 文件拖入节点 ==========

    _handleFileDropToNode(nodeId, file) {
        const node = this.nodes.get(nodeId);
        if (!node) return;

        if (node.type === 'image') {
            if (file.type.startsWith('image/')) {
                this.fileManager.loadImageToNode(nodeId, file);
                this._showNotification('✅ 图片已添加', file.name);
            } else {
                this._showNotification('⚠️ 请拖入图片文件', '支持: jpg, png, gif, webp等');
            }
        } else if (node.type === 'video') {
            if (file.type.startsWith('video/')) {
                this.fileManager.loadFileToNode(nodeId, file);
                this._showNotification('✅ 视频已更新', file.name);
            } else {
                this._showNotification('⚠️ 请拖入视频文件', '支持: mp4, mov, avi, mkv等');
            }
        } else if (node.type === 'audio') {
            if (file.type.startsWith('audio/')) {
                this.fileManager.loadFileToNode(nodeId, file);
                this._showNotification('✅ 音频已更新', file.name);
            } else {
                this._showNotification('⚠️ 请拖入音频文件', '支持: mp3, wav, flac, ogg等');
            }
        } else if (node.type === 'effect') {
            const validExts = ['.json', '.xml', '.csv', '.xlsx', '.txt'];
            const ext = '.' + file.name.split('.').pop().toLowerCase();
            if (validExts.includes(ext)) {
                this.fileManager.loadFileToNode(nodeId, file);
                this._showNotification('✅ 特效文件已更新', file.name);
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
                    this.renderer.render();
                    this._showNotification('✅ 文本已更新', file.name);
                };
                reader.readAsText(file);
            } else {
                this._showNotification('⚠️ 请拖入文本文件', '支持: txt, md, srt, ass等');
            }
        }
    }

    // ========== 文本编辑 ==========

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
        this.renderer.render();
        this._focusTextarea(id);
    }

    _focusTextarea(id) {
        requestAnimationFrame(() => {
            const ta = this.nodesContainer.querySelector(`.node[data-id="${id}"] .node-textarea`);
            if (ta) {
                ta.focus();
                ta.select();
            }
        });
    }

    _saveTextEditing(id, value) {
        const node = this.nodes.get(id);
        if (node) node.textContent = value;
        this._editingNodeId = null;
        this.renderer.render();
    }

    _cancelTextEditing(id) {
        this._editingNodeId = null;
        this.renderer.render();
    }

    // ========== 节点拖拽 ==========

    _startNodeDrag(id, e) {
        const node = this.nodes.get(id);
        if (!node) return;
        
        // 选择逻辑
        if (e.shiftKey) {
            if (this.selectedNodes.has(id)) {
                this.selectedNodes.delete(id);
            } else {
                this.selectedNodes.add(id);
            }
            this.selectedConnections.clear();
            this.renderer.render();
            return;
        }
        
        this.selectedNodes.clear();
        this.selectedConnections.clear();
        this.selectedNodes.add(id);
        this.renderer.render();
        
        // 开始拖拽
        this._isDragging = true;
        this._dragTargetId = id;
        this._dragStartX = e.clientX;
        this._dragStartY = e.clientY;
        this._dragOrigX = node.x;
        this._dragOrigY = node.y;
        
        // 保存媒体状态
        this.mediaManager.saveState(id);
        
        const el = this.nodesContainer.querySelector(`.node[data-id="${id}"]`);
        if (el) {
            el.classList.add('is-dragging');
            el.style.cursor = 'grabbing';
            el.style.zIndex = 10;
        }
        e.preventDefault();
    }

    // ========== 节点缩放 ==========

    _startResize(id, clientX, clientY, node) {
        this._isResizing = true;
        this._resizeTargetId = id;
        this._resizeStartX = clientX;
        this._resizeStartY = clientY;
        this._resizeOrigWidth = node.width || 150;
        this._resizeOrigHeight = node.height || 70;
    }

    // ========== 连线 ==========

    _startConnection(fromId, clientX, clientY) {
        if (!this.nodes.has(fromId)) return;
        this.isConnecting = true;
        this.connectionFromId = fromId;
        
        const start = this.renderer.getPortCenter(fromId, 'output') || 
                      this.renderer.clientToCanvas(clientX, clientY);
        const cursor = this.renderer.clientToCanvas(clientX, clientY);
        
        this.tempLine = this.connectionUI.createTempLine(start.x, start.y, cursor.x, cursor.y);
        this.svg.appendChild(this.tempLine);
    }

    // ========== 保存 ==========

    async saveProject() {
        const data = this._getProjectData();
        
        try {
            if (!window.electronAPI) {
                this._downloadSave();
                return;
            }
            
            const result = await window.electronAPI.saveProject(data);
            if (result.success) {
                this.updateFilePathDisplay(result.filePath);
                this._showNotification('✅ 项目已保存', `位置: ${result.filePath}`);
            } else if (!result.canceled) {
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
                this.updateFilePathDisplay(result.filePath);
                this._showNotification('✅ 另存为成功', `位置: ${result.filePath}`);
            } else if (!result.canceled) {
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
                this._loadProjectData(result.data);
                this.updateFilePathDisplay(result.filePath);
                this._showNotification('✅ 导入成功', `节点: ${this.nodes.size}, 连线: ${this.connections.length}`);
            } else if (!result.canceled) {
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
                    this._loadProjectData(data);
                    this._showNotification('✅ 导入成功', `共 ${this.nodes.size} 个节点`);
                } catch (err) {
                    this._showNotification('❌ 导入失败', err.message);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    _loadProjectData(data) {
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
        
        this.renderer.render();
        this.renderer.updateStats();
        if (this.nodes.size > 0) this.hideHint();
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
                { ...node, images: node.images || [], fileUrl: '' }
            ]),
            connections: this.connections
        };
    }

    // ========== 事件设置（精简版） ==========

    _setupCanvasEvents() {
        // 滚轮缩放/平移
        this.container.addEventListener('wheel', (e) => {
            const target = e.target;
            if (target.closest?.('.node-text-preview') || target.closest?.('.node-file-preview')) {
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
                this.renderer.applyTransform();
                this.renderer.renderConnections();
            } else {
                this.panX -= e.deltaX;
                this.panY -= e.deltaY;
                this.renderer.applyTransform();
                this.renderer.renderConnections();
            }
        }, { passive: false });

        // 点击空白区域
        this.container.addEventListener('pointerdown', (e) => {
            const target = e.target;
            
            if (target.closest?.('video') || target.closest?.('audio')) return;
            if (target.closest?.('.port') || target.closest?.('.node-delete-btn')) return;
            if (target.closest?.('.add-image-btn') || target.closest?.('.single-image')) return;
            if (target.closest?.('.node-resize-handle') || target.closest?.('.node-textarea')) return;
            if (target.closest?.('.node-file-info') || target.closest?.('.node-text-content')) return;
            if (target.closest?.('.img-delete-btn') || target.closest?.('.connection-line')) return;
            if (target.closest?.('.node-file-preview')) return;
            
            const nodeEl = target.closest?.('.node');
            if (nodeEl && e.button === 0) {
                const id = parseInt(nodeEl.dataset.id);
                if (!isNaN(id)) {
                    this._startNodeDrag(id, e);
                    e.preventDefault();
                    return;
                }
            }
            
            if (e.button === 0) {
                const onBlank = target === this.container || target === this.nodesContainer || 
                               target === this.svg || target.classList?.contains('canvas-svg');
                if (onBlank) {
                    if (!e.shiftKey) {
                        this._isBoxSelecting = true;
                        const world = this.renderer.clientToWorld(e.clientX, e.clientY);
                        this._boxStartX = world.x;
                        this._boxStartY = world.y;
                        this._createBoxEl();
                        this.selectedNodes.clear();
                        this.selectedConnections.clear();
                        this.renderer.render();
                    } else {
                        this.selectedNodes.clear();
                        this.selectedConnections.clear();
                        this.renderer.render();
                    }
                }
            }
        });

        // 框选移动
        window.addEventListener('pointermove', (e) => {
            if (this._isBoxSelecting && this._boxEl) {
                const world = this.renderer.clientToWorld(e.clientX, e.clientY);
                const x = Math.min(this._boxStartX, world.x);
                const y = Math.min(this._boxStartY, world.y);
                const w = Math.abs(world.x - this._boxStartX);
                const h = Math.abs(world.y - this._boxStartY);
                this._boxEl.style.cssText = `
                    position: absolute; left: ${x}px; top: ${y}px;
                    width: ${w}px; height: ${h}px;
                    border: 1.5px solid #58a6ff;
                    background: rgba(88, 166, 255, 0.1);
                    pointer-events: none; z-index: 50;
                    display: block;
                `;
                this._updateBoxSelection(x, y, w, h);
            }
        });

        window.addEventListener('pointerup', () => {
            if (this._isBoxSelecting) {
                this._isBoxSelecting = false;
                if (this._boxEl) this._boxEl.style.display = 'none';
                this.renderer.render();
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
            const nx = node.x, ny = node.y;
            const nw = node.width || 150, nh = node.height || 70;
            if (nx < x + w && nx + nw > x && ny < y + h && ny + nh > y) {
                this.selectedNodes.add(id);
            }
        });
        this.renderer.updateSelectionHighlight();
    }

    // ========== 全局事件 ==========

    _setupGlobalEvents() {
        if (this._globalEventsBound) return;
        this._globalEventsBound = true;

        window.addEventListener('pointermove', (e) => this._onMove(e.clientX, e.clientY));
        window.addEventListener('pointerup', (e) => this._onUp(e.clientX, e.clientY));
    }

    _onMove(cx, cy) {
        // 平移
        if (this.isPanning) {
            this.panX = cx - this._dragStartX;
            this.panY = cy - this._dragStartY;
            this.renderer.applyTransform();
            this.renderer.renderConnections();
            return;
        }

        // 缩放
        if (this._isResizing) {
            const node = this.nodes.get(this._resizeTargetId);
            if (!node) return;
            const dx = (cx - this._resizeStartX) / this.zoom;
            const dy = (cy - this._resizeStartY) / this.zoom;
            node.width = Math.max(120, this._resizeOrigWidth + dx);
            node.height = Math.max(80, this._resizeOrigHeight + dy);
            const el = this.nodesContainer.querySelector(`.node[data-id="${this._resizeTargetId}"]`);
            if (el) {
                el.style.width = node.width + 'px';
                el.style.height = node.height + 'px';
            }
            this.renderer.renderConnections();
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
            this.renderer.renderConnections();
            return;
        }

        // 临时连线
        if (this.isConnecting && this.tempLine) {
            const p = this.renderer.clientToCanvas(cx, cy);
            this.tempLine.setAttribute('x2', p.x);
            this.tempLine.setAttribute('y2', p.y);
        }
    }

    _onUp(cx, cy) {
        // 平移结束
        if (this.isPanning) {
            this.isPanning = false;
            this.container.classList.remove('dragging');
            this.container.style.cursor = 'grab';
            return;
        }

        // 缩放结束
        if (this._isResizing) {
            this._isResizing = false;
            this._resizeTargetId = null;
            this.renderer.renderConnections();
            return;
        }

        // 拖拽结束
        if (this._isDragging) {
            const targetId = this._dragTargetId;
            const el = this.nodesContainer.querySelector(`.node[data-id="${targetId}"]`);
            if (el) {
                el.classList.remove('is-dragging');
                el.style.cursor = 'pointer';
                el.style.zIndex = 2;
            }
            this.mediaManager.restoreState(targetId);
            this._isDragging = false;
            this._dragTargetId = null;
            this.renderer.renderConnections();
            return;
        }

        // 连线结束
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
                if (current.classList?.contains('port-input')) {
                    targetPort = current;
                    break;
                }
                current = current.parentElement;
            }
            
            if (targetPort && this.connectionFromId !== null) {
                const fromId = this.connectionFromId;
                const toId = parseInt(targetPort.dataset.id);
                if (toId !== fromId && this.nodes.has(toId)) {
                    this.connectionManager.addConnection(fromId, toId);
                }
            }
            this.connectionFromId = null;
        }
    }

    // ========== 键盘快捷键 ==========

    _setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+S / Ctrl+Shift+S
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
            const isInInput = activeEl && (
                activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' ||
                activeEl.tagName === 'SELECT' || activeEl.classList?.contains('node-textarea')
            );

            if (isInInput) {
                if (e.key === 'Escape' && this._editingNodeId !== null) {
                    this._cancelTextEditing(this._editingNodeId);
                    e.preventDefault();
                }
                return;
            }

            // 删除选中节点
            if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedNodes.size > 0) {
                e.preventDefault();
                const ids = Array.from(this.selectedNodes);
                ids.forEach(id => this.deleteNode(id));
                this.selectedNodes.clear();
                this.renderer.render();
                this.renderer.updateStats();
                return;
            }

            // 删除选中连线
            if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedConnections.size > 0) {
                e.preventDefault();
                const ids = Array.from(this.selectedConnections);
                ids.forEach(id => this.connectionManager.deleteConnection(id));
                this.selectedConnections.clear();
                return;
            }

            if (e.key === 'Escape') {
                this.selectedNodes.clear();
                this.selectedConnections.clear();
                this.renderer.render();
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                this.selectedNodes.clear();
                this.selectedConnections.clear();
                this.nodes.forEach((_, id) => this.selectedNodes.add(id));
                this.renderer.render();
            }
        });
    }

    // ========== 工具栏 ==========

    _setupToolbarEvents() {
        document.getElementById('saveBtn')?.addEventListener('click', () => this.saveProject());
        document.getElementById('saveAsBtn')?.addEventListener('click', () => this.saveProjectAs());
        document.getElementById('importBtn')?.addEventListener('click', () => this.importProject());
        document.getElementById('selectFileBtn')?.addEventListener('click', () => {
            this.fileManager.selectFile((files) => {
                document.getElementById('filePathInput').value = files.map(f => f.path || f.name).join(', ');
            });
        });
        
        document.getElementById('clearBtn')?.addEventListener('click', () => {
            if (confirm('确定要清空所有节点和连线吗？')) {
                this.nodes.clear();
                this.connections = [];
                this.selectedNodes.clear();
                this.selectedConnections.clear();
                this.renderer.render();
                this.renderer.updateStats();
                document.getElementById('canvasHint')?.classList.remove('hidden');
            }
        });
    }

    // ========== 模态框 ==========

    _setupModalEvents() {
        const modal = document.getElementById('editModal');
        if (!modal) return;
        
        const close = () => { modal.style.display = 'none'; };
        document.getElementById('modalClose')?.addEventListener('click', close);
        document.getElementById('modalCancel')?.addEventListener('click', close);
        document.getElementById('modalSave')?.addEventListener('click', () => {
            this._saveNodeFromModal();
            close();
        });
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    }

    _saveNodeFromModal() {
        const modal = document.getElementById('editModal');
        const data = {
            name: document.getElementById('nodeNameInput').value || '未命名节点',
            type: document.getElementById('nodeTypeSelect').value,
            filePath: document.getElementById('filePathInput').value,
            color: document.getElementById('nodeColorInput').value
        };
        const editId = modal.dataset.editId;
        if (editId && this.nodes.has(parseInt(editId))) {
            this.nodeManager.updateNode(parseInt(editId), data);
        } else {
            this.nodeManager.createNode(data);
        }
    }

    // ========== 拖拽创建 ==========

    _setupDragDrop() {
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
                    const world = this.renderer.clientToWorld(e.clientX, e.clientY);
                    const size = getDefaultSize(data.type || 'text');
                    this.nodeManager.createNode({
                        name: data.name || '新节点',
                        type: data.type || 'text',
                        x: world.x - 70,
                        y: world.y - 35,
                        color: getTypeColor(data.type),
                        width: size.width,
                        height: size.height
                    });
                    this.hideHint();
                } else if (e.dataTransfer.files.length > 0) {
                    const file = e.dataTransfer.files[0];
                    const world = this.renderer.clientToWorld(e.clientX, e.clientY);
                    this.fileManager.createNodeFromFile(file, world.x, world.y);
                    this.hideHint();
                }
            } catch (err) {
                console.error('拖拽创建失败:', err);
            }
            setTimeout(() => { this._isDropProcessing = false; }, 100);
        });

        // dropZone
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
                        const world = this.renderer.clientToWorld(
                            rect.left + rect.width / 2,
                            rect.top + rect.height / 2
                        );
                        this.fileManager.createNodeFromFile(file, world.x, world.y);
                        this.hideHint();
                    }
                } catch (err) {
                    console.error('文件拖入失败:', err);
                }
                setTimeout(() => { this._isDropProcessing = false; }, 100);
            });
        }
    }
}