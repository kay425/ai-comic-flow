// scripts/utils/helpers.js

export const TypeColors = {
    text: '#238636',
    image: '#1f6feb',
    video: '#d29922',
    audio: '#bc8cff',
    effect: '#f0883e'
};

export const TypeIcons = {
    text: '📝',
    image: '🖼️',
    video: '🎬',
    audio: '🔊',
    effect: '✨'
};

export const TypeLabels = {
    text: '文本剧本',
    image: '批量图片',
    video: '视频片段',
    audio: '音频',
    effect: '特效'
};

export const DefaultSizes = {
    text: { width: 180, height: 160 },
    image: { width: 200, height: 200 },
    video: { width: 220, height: 180 },
    audio: { width: 200, height: 160 },
    effect: { width: 180, height: 140 }
};

export function getFileType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const map = {
        text: ['txt', 'md', 'doc', 'docx', 'srt', 'ass'],
        image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'],
        video: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v'],
        audio: ['mp3', 'wav', 'aac', 'flac', 'ogg', 'wma', 'm4a'],
        effect: ['json', 'xml', 'csv', 'xlsx']
    };
    for (const [type, exts] of Object.entries(map)) {
        if (exts.includes(ext)) return type;
    }
    return 'text';
}

export function getTypeColor(type) {
    return TypeColors[type] || '#8b949e';
}

export function getDefaultSize(type) {
    return DefaultSizes[type] || { width: 150, height: 80 };
}

export function generateId(prefix = 'id') {
    return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}