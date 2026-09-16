// electron-preload.js
const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
    // 保存项目
    saveProject: (data) => ipcRenderer.invoke('save-project', data),
    
    // 另存为
    saveProjectAs: (data) => ipcRenderer.invoke('save-project-as', data),
    
    // 导入项目
    importProject: () => ipcRenderer.invoke('import-project'),
    
    // 打开文件所在位置
    openFileLocation: (filePath) => ipcRenderer.invoke('open-file-location', filePath),
    
    // 获取当前项目路径
    getProjectPath: () => ipcRenderer.invoke('get-project-path'),
    
    // 获取文件信息
    getFileInfo: (filePath) => ipcRenderer.invoke('get-file-info', filePath),
    
    // 选择图片文件
    selectImageFiles: () => ipcRenderer.invoke('select-image-files'),
    
    // 选择单个文件（视频/音频/特效）
    selectFile: (filters) => ipcRenderer.invoke('select-file', filters),
    
    // 监听文件路径变化
    onProjectPathChanged: (callback) => {
        ipcRenderer.on('project-path-changed', (event, path) => callback(path));
    }
});