// scripts/ui/NodeUI.js

import { TypeIcons, TypeLabels, getTypeColor, getDefaultSize } from '../utils/helpers.js';

export class NodeUI {
    constructor(editor) {
        this.editor = editor;
    }

    /**
     * 创建节点DOM元素
     */
    createNodeElement(node, id) {
        const el = document.createElement('div');
        el.className = 'node';
        if (this.editor.selectedNodes.has(id)) el.classList.add('selected');
        el.dataset.id = id;
        el.style.left = node.x + 'px';
        el.style.top = node.y + 'px';
        el.style.width = node.width + 'px';
        el.style.height = node.height + 'px';
        el.style.borderColor = node.color || getTypeColor(node.type);

        const contentHtml = this._buildContent(node, id);
        
        el.innerHTML = `
            <div class="node-header">
                <span class="node-type-icon">${TypeIcons[node.type] || '📄'}</span>
                <button class="node-delete-btn" data-delete="${id}">✕</button>
            </div>
            <div class="node-title">${node.name}</div>
            <div class="node-type-label">${TypeLabels[node.type] || '通用'}</div>
            ${contentHtml}
            <div class="port port-output" data-port="output" data-id="${id}"></div>
            <div class="port port-input" data-port="input" data-id="${id}"></div>
            <div class="node-resize-handle" data-resize="${id}"></div>
        `;

        this._bindEvents(el, node, id);
        return el;
    }

    /**
     * 构建节点内容
     */
    _buildContent(node, id) {
        if (node.type === 'text') {
            return this._buildTextContent(node, id);
        } else if (node.type === 'image') {
            return this._buildImageContent(node, id);
        } else if (node.type === 'video') {
            return this._buildVideoContent(node, id);
        } else if (node.type === 'audio') {
            return this._buildAudioContent(node, id);
        } else if (node.type === 'effect') {
            return this._buildEffectContent(node, id);
        }
        return `<div class="node-file-info" data-node-id="${id}">${node.filePath || '无文件关联'}</div>`;
    }

    _buildTextContent(node, id) {
        const isEditing = this.editor._editingNodeId === id;
        const previewText = node.textContent || '';
        return `
            <div class="node-text-content ${isEditing ? 'editing' : ''}" data-node-id="${id}">
                ${isEditing ? 
                    `<textarea class="node-textarea" data-node-id="${id}">${previewText}</textarea>` :
                    `<div class="node-text-preview">${previewText}</div>`
                }
            </div>
        `;
    }

    _buildImageContent(node, id) {
        const images = node.images || [];
        let gridHtml = images.length > 0 ? 
            `<div class="node-image-grid">${images.map((img, idx) => `
                <div class="single-image" data-img-idx="${idx}">
                    <img src="${img.dataUrl}" alt="${img.name}" loading="lazy" draggable="false">
                    <button class="img-delete-btn" data-img-idx="${idx}">✕</button>
                </div>
            `).join('')}</div>` :
            `<div class="node-image-grid" style="display:flex;align-items:center;justify-content:center;color:#484f58;font-size:11px;min-height:30px;">暂无图片</div>`;
        
        return `
            <div class="node-image-container">
                <button class="add-image-btn" data-node-id="${id}">＋ 添加图片</button>
                ${gridHtml}
            </div>
        `;
    }

    _buildVideoContent(node, id) {
        const hasFile = node.filePath || node.fileUrl;
        const displayName = node.fileName || (node.filePath ? node.filePath.split(/[\\/]/).pop() : '');
        return `
            <div class="node-file-info" data-node-id="${id}">
                ${hasFile ? `🎬 ${displayName}` : '📁 单击选择 | 双击拖拽'}
            </div>
            <div class="node-file-preview" data-node-id="${id}">
                ${node.fileUrl ? 
                    `<video controls style="width:100%;max-height:100%;" data-node-id="${id}" playsinline muted loop>
                        <source src="${node.fileUrl}">
                    </video>` :
                    `<div class="file-placeholder">🎬 视频预览</div>`
                }
            </div>
        `;
    }

    _buildAudioContent(node, id) {
        const hasFile = node.filePath || node.fileUrl;
        const displayName = node.fileName || (node.filePath ? node.filePath.split(/[\\/]/).pop() : '');
        return `
            <div class="node-file-info" data-node-id="${id}">
                ${hasFile ? `🎵 ${displayName}` : '📁 单击选择 | 双击拖拽'}
            </div>
            <div class="node-file-preview" data-node-id="${id}">
                ${node.fileUrl ? 
                    `<audio controls style="width:100%;" data-node-id="${id}" loop>
                        <source src="${node.fileUrl}">
                    </audio>` :
                    `<div class="file-placeholder">🎵 音频预览</div>`
                }
            </div>
        `;
    }

    _buildEffectContent(node, id) {
        const hasFile = node.filePath;
        const displayName = node.fileName || (node.filePath ? node.filePath.split(/[\\/]/).pop() : '');
        return `
            <div class="node-file-info" data-node-id="${id}">
                ${hasFile ? `✨ ${displayName}` : '📁 单击选择 | 双击拖拽'}
            </div>
            <div class="node-file-preview">
                <div class="file-placeholder">${hasFile ? '✅ 已关联文件' : '✨ 特效参数配置'}</div>
            </div>
        `;
    }

    /**
     * 绑定节点事件
     */
    _bindEvents(el, node, id) {
        this._bindResizeHandle(el, node, id);
        this._bindTextContent(el, node, id);
        this._bindFileInfo(el, node, id);
        this._bindNodeDrag(el, node, id);
        this._bindDeleteButton(el, id);
        this._bindPorts(el, id);
        this._bindImageEvents(el, node, id);
        this._bindMediaEvents(el, id);
        this._bindContextMenu(el, id);
        this._bindDoubleClick(el, id);
        this._bindDropTarget(el, node, id);
    }

    _bindResizeHandle(el, node, id) {
        const handle = el.querySelector('.node-resize-handle');
        if (!handle) return;
        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.editor._startResize(id, e.clientX, e.clientY, node);
        });
    }

    _bindTextContent(el, node, id) {
        const content = el.querySelector('.node-text-content');
        if (!content || node.type !== 'text') return;
        content.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.editor._editingNodeId !== id) {
                this.editor._startTextEditing(id);
            }
        });
    }

    _bindFileInfo(el, node, id) {
        const fileInfo = el.querySelector('.node-file-info');
        if (!fileInfo) return;

        // 阻止事件冒泡
        fileInfo.addEventListener('mousedown', (e) => e.stopPropagation());
        
        // 单击：选择文件
        let clickTimer = null;
        let isDragging = false;
        
        fileInfo.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (isDragging) { isDragging = false; return; }
            if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
            
            clickTimer = setTimeout(() => {
                this._openFileSelector(node, id);
                clickTimer = null;
            }, 200);
        });
        
        // 双击：打开文件位置
        fileInfo.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
            this.editor.openNodeFileLocation(id);
        });

        // 拖拽导出
        this.editor._setupDragOutSupport(fileInfo, id);
        
        fileInfo.addEventListener('dragstart', () => {
            isDragging = true;
            setTimeout(() => { isDragging = false; }, 500);
        });
    }

    _openFileSelector(node, id) {
        const types = {
            video: 'video/*',
            audio: 'audio/*',
            effect: '.json,.xml,.csv,.xlsx,.txt',
            text: '.txt,.md,.srt,.ass',
            image: 'image/*'
        };
        const accept = types[node.type] || '*/*';
        this.editor.fileManager.selectFileForNode(id, accept);
    }

    _bindNodeDrag(el, node, id) {
        // 节点拖拽由 FlowEditor 统一处理
        // 这里只做样式标记
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
            if (e.target.closest('video') || e.target.closest('audio')) return;
            if (this.editor._editingNodeId !== null) return;
            
            this.editor._startNodeDrag(id, e);
        });
    }

    _bindDeleteButton(el, id) {
        el.querySelector('.node-delete-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.editor.deleteNode(id);
            this.editor.selectedNodes.delete(id);
        });
    }

    _bindPorts(el, id) {
        const outputPort = el.querySelector('.port-output');
        if (outputPort) {
            outputPort.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.editor._startConnection(id, e.clientX, e.clientY);
            });
        }
    }

    _bindImageEvents(el, node, id) {
        if (node.type !== 'image') return;

        // 添加图片按钮
        el.querySelector('.add-image-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.editor._addImagesToNode(id);
        });

        // 删除图片
        el.querySelectorAll('.img-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.imgIdx);
                if (node.images && node.images[idx]) {
                    node.images.splice(idx, 1);
                    this.editor.renderer.render();
                }
            });
        });

        // 预览图片
        el.querySelectorAll('.single-image img').forEach(img => {
            img.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(img.closest('.single-image').dataset.imgIdx);
                if (node.images && node.images[idx]) {
                    this.editor._previewImage(node.images[idx].dataUrl);
                }
            });
        });
    }

    _bindMediaEvents(el, id) {
        const media = el.querySelector('video') || el.querySelector('audio');
        if (!media) return;
        
        media.addEventListener('mousedown', (e) => e.stopPropagation());
        media.addEventListener('click', (e) => e.stopPropagation());
        media.addEventListener('dblclick', (e) => e.stopPropagation());
        media.style.pointerEvents = 'auto';
        
        if (media.tagName === 'VIDEO') {
            media.setAttribute('playsinline', '');
        }
        
        // 媒体加载完成后自动播放
        media.addEventListener('loadedmetadata', () => {
            media.play().catch(() => {});
        }, { once: true });
    }

    _bindContextMenu(el, id) {
        el.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.editor._editingNodeId === id) return;
            this.editor.openNodeFileLocation(id);
        });
    }

    _bindDoubleClick(el, id) {
        el.addEventListener('dblclick', (e) => {
            if (e.target.closest('.node-delete-btn')) return;
            if (e.target.closest('.port')) return;
            if (e.target.closest('.add-image-btn')) return;
            if (e.target.closest('.single-image')) return;
            if (e.target.closest('.node-text-content')) return;
            if (e.target.closest('.node-file-info')) return;
            if (e.target.closest('video') || e.target.closest('audio')) return;
            
            this.editor.openNodeFileLocation(id);
        });
    }

    _bindDropTarget(el, node, id) {
        el.addEventListener('dragover', (e) => {
            if (e.dataTransfer.types.includes('Files')) {
                e.preventDefault();
                e.stopPropagation();
                el.classList.add('drag-over');
            }
        });

        el.addEventListener('dragleave', () => {
            el.classList.remove('drag-over');
        });

        el.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            el.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                this.editor._handleFileDropToNode(id, e.dataTransfer.files[0]);
            }
        });
    }
}