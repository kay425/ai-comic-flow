// scripts/core/NodeManager.js

import { getTypeColor, getDefaultSize } from '../utils/helpers.js';

export class NodeManager {
    constructor(editor) {
        this.editor = editor;
    }

    /**
     * 创建节点
     */
    createNode(data) {
        const id = this.editor.nextId++;
        const size = getDefaultSize(data.type || 'text');
        
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
            color: data.color || getTypeColor(data.type),
            width: data.width || size.width,
            height: data.height || size.height,
            content: data.content || '',
            images: data.images || [],
            textContent: data.textContent || ''
        };
        
        this.editor.nodes.set(id, node);
        this.editor.renderer.render();
        this.editor.renderer.updateStats();
        this.editor.hideHint();
        return id;
    }

    /**
     * 更新节点
     */
    updateNode(id, data) {
        const node = this.editor.nodes.get(id);
        if (node) {
            Object.assign(node, data);
            this.editor.renderer.render();
            this.editor.renderer.updateStats();
        }
    }

    /**
     * 删除节点
     */
    deleteNode(id) {
        if (!this.editor.nodes.has(id)) return;
        
        // 删除相关连线
        this.editor.connections = this.editor.connections.filter(c => c.from !== id && c.to !== id);
        
        // 释放URL
        const node = this.editor.nodes.get(id);
        if (node && node.fileUrl && node.fileUrl.startsWith('blob:')) {
            URL.revokeObjectURL(node.fileUrl);
        }
        
        // 清除媒体状态
        this.editor.mediaManager.clearState(id);
        
        this.editor.nodes.delete(id);
        this.editor.selectedNodes.delete(id);
        this.editor.renderer.render();
        this.editor.renderer.updateStats();
        
        if (this.editor.nodes.size === 0) {
            document.getElementById('canvasHint')?.classList.remove('hidden');
        }
    }

    /**
     * 复制节点
     */
    duplicateNode(id) {
        const node = this.editor.nodes.get(id);
        if (!node) return;
        
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

    /**
     * 获取节点
     */
    getNode(id) {
        return this.editor.nodes.get(id);
    }

    /**
     * 获取所有节点
     */
    getAllNodes() {
        return Array.from(this.editor.nodes.values());
    }

    /**
     * 按类型获取节点
     */
    getNodesByType(type) {
        return this.getAllNodes().filter(node => node.type === type);
    }

    /**
     * 获取节点数量
     */
    getCount() {
        return this.editor.nodes.size;
    }
}