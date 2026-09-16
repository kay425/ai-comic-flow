// scripts/main.js - 入口文件
import { FlowEditor } from './core/FlowEditor.js';

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('canvasContainer');
    if (!container) {
        console.error('❌ 找不到 canvasContainer');
        return;
    }
    
    const editor = new FlowEditor(container);
    
    // 检测 Electron 环境
    const isElectron = !!(window.electronAPI);
    console.log('🔌 Electron 环境:', isElectron ? '✅' : '❌');
    
    if (isElectron) {
        // 获取当前项目路径
        window.electronAPI.getProjectPath().then(path => {
            if (path) {
                editor.updateFilePathDisplay(path);
            }
        });
        
        // 监听项目路径变化
        window.electronAPI.onProjectPathChanged((path) => {
            editor.updateFilePathDisplay(path);
        });
    }
    
    // ==========================================
    // 创建示例节点
    // ==========================================
    
    // 第1行：文本 -> 图片 -> 视频
    const node1 = editor.createNode({
        name: '开场剧本',
        type: 'text',
        x: 40,
        y: 30,
        color: '#238636',
        width: 200,
        height: 180,
        textContent: '在很久很久以前，\n有一个勇敢的少年...\n\n点击这里编辑文本内容。'
    });
    
    const node2 = editor.createNode({
        name: '主角图片集',
        type: 'image',
        x: 290,
        y: 20,
        color: '#1f6feb',
        width: 220,
        height: 200
    });
    
    const node3 = editor.createNode({
        name: '场景视频',
        type: 'video',
        x: 560,
        y: 30,
        color: '#d29922',
        width: 220,
        height: 180
    });
    
    // 第2行：音频 -> 特效
    const node4 = editor.createNode({
        name: '背景音乐',
        type: 'audio',
        x: 40,
        y: 280,
        color: '#bc8cff',
        width: 200,
        height: 150
    });
    
    const node5 = editor.createNode({
        name: '转场特效',
        type: 'effect',
        x: 290,
        y: 280,
        color: '#f0883e',
        width: 200,
        height: 150
    });
    
    // ==========================================
    // 添加示例图片到图片节点
    // ==========================================
    
    const placeholderImages = [
        { name: '主角-正面', bg: '#1f6feb', emoji: '🧑' },
        { name: '主角-侧面', bg: '#2ea043', emoji: '🧑‍🦰' },
        { name: '主角-战斗', bg: '#d29922', emoji: '⚔️' },
        { name: '主角-微笑', bg: '#bc8cff', emoji: '😊' }
    ];
    
    placeholderImages.forEach((p, i) => {
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 120, 120);
        grad.addColorStop(0, p.bg);
        grad.addColorStop(1, p.bg + '88');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 120, 120);
        ctx.fillStyle = '#ffffff';
        ctx.font = '48px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.emoji, 60, 55);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = '14px sans-serif';
        ctx.fillText(p.name, 60, 100);
        
        const node = editor.nodes.get(node2);
        if (node && node.images) {
            node.images.push({
                id: 'img_' + Date.now() + '_' + i,
                name: p.name + '.png',
                dataUrl: canvas.toDataURL('image/png'),
                filePath: p.name + '.png'
            });
        }
    });
    
    // ==========================================
    // 创建示例连线
    // ==========================================
    
    editor.connections.push(
        { from: node1, to: node2, id: 'conn1' },
        { from: node2, to: node3, id: 'conn2' },
        { from: node1, to: node4, id: 'conn3' },
        { from: node3, to: node5, id: 'conn4' },
        { from: node4, to: node5, id: 'conn5' }
    );
    
    // ==========================================
    // 渲染
    // ==========================================
    
    editor.render();
    editor.updateStats();
    editor.hideHint();
    
    // 暴露到全局用于调试
    window.editor = editor;
    
    // ==========================================
    // 控制台提示
    // ==========================================
    
    console.log('🎬 AI漫剧流程图工具已启动！');
    console.log('📋 操作提示:');
    console.log('  🖱️ 从左侧拖拽节点到画布');
    console.log('  🔗 从节点右侧圆点拖出连线');
    console.log('  📝 文本节点：点击文本区域直接编辑');
    console.log('  📁 视频/音频/特效：点击"选择文件"按钮选择文件');
    console.log('  ↗️ 点击"拖拽到软件"按钮可拖拽到剪映、微信等');
    console.log('  📐 右下角拖拽缩放节点');
    console.log('  🔲 框选或 Shift+点击 多选');
    console.log('  🗑️ Delete 删除选中的节点或连线');
    console.log('  📂 双击节点或文件路径打开文件所在位置');
    console.log('  💾 Ctrl+S 保存 | Ctrl+Shift+S 另存为');
});