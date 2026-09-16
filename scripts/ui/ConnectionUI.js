// scripts/ui/ConnectionUI.js

export class ConnectionUI {
    constructor(editor) {
        this.editor = editor;
    }

    /**
     * 绘制连线
     */
    drawConnection(fromNode, toNode, connId) {
        const svg = this.editor.svg;
        const fromPort = this.editor.renderer.getPortCenter(fromNode.id, 'output');
        const toPort = this.editor.renderer.getPortCenter(toNode.id, 'input');

        let x1, y1, x2, y2;
        if (fromPort && toPort) {
            x1 = fromPort.x;
            y1 = fromPort.y;
            x2 = toPort.x;
            y2 = toPort.y;
        } else {
            const fromEl = this.editor.nodesContainer.querySelector(`.node[data-id="${fromNode.id}"]`);
            const toEl = this.editor.nodesContainer.querySelector(`.node[data-id="${toNode.id}"]`);
            const fh = fromEl ? fromEl.offsetHeight : (fromNode.height || 70);
            const th = toEl ? toEl.offsetHeight : (toNode.height || 70);
            const fw = fromEl ? fromEl.offsetWidth : fromNode.width;
            x1 = (fromNode.x + fw) * this.editor.zoom + this.editor.panX;
            y1 = (fromNode.y + fh / 2) * this.editor.zoom + this.editor.panY;
            x2 = toNode.x * this.editor.zoom + this.editor.panX;
            y2 = (toNode.y + th / 2) * this.editor.zoom + this.editor.panY;
        }

        const dx = Math.abs(x2 - x1) / 2 + 20;
        const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

        const isSelected = this.editor.selectedConnections.has(connId);
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('class', `connection-line animated selectable ${isSelected ? 'selected' : ''}`);
        path.setAttribute('stroke', isSelected ? '#f0883e' : '#6aafff');
        path.setAttribute('stroke-width', isSelected ? '4' : '2.5');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-dasharray', '10 8');
        path.setAttribute('data-conn-id', connId);
        path.style.cursor = 'pointer';
        
        path.addEventListener('click', (e) => {
            e.stopPropagation();
            if (e.shiftKey) {
                if (this.editor.selectedConnections.has(connId)) {
                    this.editor.selectedConnections.delete(connId);
                } else {
                    this.editor.selectedConnections.add(connId);
                }
            } else {
                this.editor.selectedConnections.clear();
                this.editor.selectedNodes.clear();
                this.editor.selectedConnections.add(connId);
            }
            this.editor.renderer.renderConnections();
        });
        
        svg.appendChild(path);

        // 箭头
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const s = 12;
        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        arrow.setAttribute('points', 
            `${x2},${y2} ${x2 - s * Math.cos(angle - 0.5)},${y2 - s * Math.sin(angle - 0.5)} ${x2 - s * Math.cos(angle + 0.5)},${y2 - s * Math.sin(angle + 0.5)}`
        );
        arrow.setAttribute('fill', isSelected ? '#f0883e' : '#6aafff');
        arrow.setAttribute('class', 'connection-arrow');
        arrow.setAttribute('data-conn-id', connId);
        svg.appendChild(arrow);
    }

    /**
     * 创建临时连线
     */
    createTempLine(startX, startY, endX, endY) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', 'temp-line');
        line.setAttribute('stroke', '#58a6ff');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('stroke-dasharray', '6 4');
        line.setAttribute('x1', startX);
        line.setAttribute('y1', startY);
        line.setAttribute('x2', endX);
        line.setAttribute('y2', endY);
        return line;
    }
}