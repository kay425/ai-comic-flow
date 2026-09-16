// scripts/core/Renderer.js

export class Renderer {
    constructor(editor) {
        this.editor = editor;
        this.svg = editor.svg;
        this.nodesContainer = editor.nodesContainer;
    }

    /**
     * 应用变换
     */
    applyTransform() {
        const t = `translate(${this.editor.panX}px, ${this.editor.panY}px) scale(${this.editor.zoom})`;
        this.nodesContainer.style.transform = t;
    }

    /**
     * 世界坐标转画布坐标
     */
    clientToWorld(clientX, clientY) {
        const rect = this.editor.container.getBoundingClientRect();
        return {
            x: (clientX - rect.left - this.editor.panX) / this.editor.zoom,
            y: (clientY - rect.top - this.editor.panY) / this.editor.zoom
        };
    }

    /**
     * 客户端坐标转画布坐标
     */
    clientToCanvas(clientX, clientY) {
        const rect = this.editor.container.getBoundingClientRect();
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    /**
     * 获取端口中心位置
     */
    getPortCenter(nodeId, portType = 'output') {
        const el = this.nodesContainer.querySelector(`.node[data-id="${nodeId}"]`);
        if (!el) return null;
        const port = el.querySelector(portType === 'output' ? '.port-output' : '.port-input');
        if (!port) return null;
        const rect = this.editor.container.getBoundingClientRect();
        const pr = port.getBoundingClientRect();
        return {
            x: pr.left + pr.width / 2 - rect.left,
            y: pr.top + pr.height / 2 - rect.top
        };
    }

    /**
     * 渲染所有
     */
    render() {
        this.nodesContainer.innerHTML = '';
        this.svg.innerHTML = '';
        
        this.editor.nodes.forEach((node, id) => {
            const el = this.editor.nodeUI.createNodeElement(node, id);
            this.nodesContainer.appendChild(el);
        });
        
        this.applyTransform();
        this.renderConnections();
    }

    /**
     * 只渲染连线
     */
    renderConnections() {
        this.svg.querySelectorAll('.connection-line, .connection-arrow, .temp-line').forEach(el => el.remove());
        
        this.editor.connections.forEach(conn => {
            const fromNode = this.editor.nodes.get(conn.from);
            const toNode = this.editor.nodes.get(conn.to);
            if (fromNode && toNode) {
                this.editor.connectionUI.drawConnection(fromNode, toNode, conn.id);
            }
        });
    }

    /**
     * 更新选中高亮
     */
    updateSelectionHighlight() {
        this.nodesContainer.querySelectorAll('.node').forEach(el => {
            const id = parseInt(el.dataset.id);
            el.classList.toggle('selected', this.editor.selectedNodes.has(id));
        });
    }

    /**
     * 更新统计数据
     */
    updateStats() {
        document.getElementById('nodeCount').textContent = '节点: ' + this.editor.nodes.size;
        document.getElementById('connectionCount').textContent = '连线: ' + this.editor.connections.length;
    }
}