// scripts/core/MediaManager.js

export class MediaManager {
    constructor(editor) {
        this.editor = editor;
        this._mediaStates = new Map();
        this._isDragging = false;
    }

    /**
     * 获取节点的媒体元素
     */
    getMediaElement(nodeId) {
        const el = this.editor.container.querySelector(`.node[data-id="${nodeId}"]`);
        if (!el) return null;
        return el.querySelector('video') || el.querySelector('audio');
    }

    /**
     * 保存媒体状态（拖拽前调用）
     */
    saveState(nodeId) {
        const media = this.getMediaElement(nodeId);
        if (!media) return null;
        
        const state = {
            paused: media.paused,
            currentTime: media.currentTime,
            muted: media.muted,
            volume: media.volume
        };
        this._mediaStates.set(nodeId, state);
        
        // 暂停播放以减少资源占用
        if (!media.paused) {
            media.pause();
        }
        
        return state;
    }

    /**
     * 恢复媒体状态（拖拽结束后调用）
     */
    restoreState(nodeId) {
        const state = this._mediaStates.get(nodeId);
        if (!state) return;
        
        const media = this.getMediaElement(nodeId);
        if (!media) {
            this._mediaStates.delete(nodeId);
            return;
        }
        
        media.currentTime = state.currentTime;
        media.muted = state.muted;
        media.volume = state.volume;
        
        if (!state.paused) {
            media.play().catch(() => {});
        }
        
        this._mediaStates.delete(nodeId);
    }

    /**
     * 清除媒体状态
     */
    clearState(nodeId) {
        this._mediaStates.delete(nodeId);
    }

    /**
     * 暂停所有媒体
     */
    pauseAll() {
        this.editor.nodes.forEach((_, id) => {
            const media = this.getMediaElement(id);
            if (media && !media.paused) {
                media.pause();
            }
        });
    }

    /**
     * 设置拖拽状态
     */
    setDragging(isDragging) {
        this._isDragging = isDragging;
    }

    /**
     * 为媒体元素绑定事件
     */
    bindMediaEvents(mediaEl, nodeId) {
        if (!mediaEl) return;
        
        // 阻止事件冒泡到节点
        mediaEl.addEventListener('mousedown', (e) => e.stopPropagation());
        mediaEl.addEventListener('click', (e) => e.stopPropagation());
        mediaEl.addEventListener('dblclick', (e) => e.stopPropagation());
        
        // 媒体加载完成后自动播放
        mediaEl.addEventListener('loadedmetadata', () => {
            // 只有在用户交互后才自动播放
            mediaEl.play().catch(() => {});
        }, { once: true });
    }
}