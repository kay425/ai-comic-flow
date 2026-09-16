// electron-main.js
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let currentProjectPath = null;
let projectData = null;

// 添加菜单模板
function createMenu() {
    const template = [
        {
            label: '文件',
            submenu: [
                {
                    label: '保存',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => {
                        mainWindow.webContents.send('menu-save');
                    }
                },
                {
                    label: '另存为',
                    accelerator: 'CmdOrCtrl+Shift+S',
                    click: () => {
                        mainWindow.webContents.send('menu-save-as');
                    }
                },
                {
                    label: '导入',
                    accelerator: 'CmdOrCtrl+O',
                    click: () => {
                        mainWindow.webContents.send('menu-import');
                    }
                },
                { type: 'separator' },
                {
                    label: '退出',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: '编辑',
            submenu: [
                { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
                { label: '重做', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
                { type: 'separator' },
                { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
                { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
                { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' },
                { type: 'separator' },
                { label: '全选', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
            ]
        },
        {
            label: '视图',
            submenu: [
                { label: '重置缩放', click: () => { mainWindow.webContents.send('reset-zoom'); } },
                { type: 'separator' },
                { label: '开发者工具', accelerator: 'F12', click: () => { mainWindow.webContents.openDevTools(); } }
            ]
        },
        {
            label: '帮助',
            submenu: [
                {
                    label: '关于',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            title: '关于 AI漫剧流程图',
                            message: 'AI漫剧流程图工具 v1.0.0',
                            detail: '一个基于流程图思想的AI漫剧创作工具\n\n功能：\n- 节点拖拽与连线\n- 文件管理\n- 拖拽导出到其他软件'
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        backgroundColor: '#0d1117',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'electron-preload.js')
        },
        icon: path.join(__dirname, 'assets', 'icon.png'),
        title: 'AI漫剧流程图'
    });

    mainWindow.loadFile('index.html');

    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }

    createMenu();

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// ==========================================
// IPC 处理器
// ==========================================

/**
 * 保存项目
 */
ipcMain.handle('save-project', async (event, data) => {
    try {
        let savePath = currentProjectPath;
        
        if (!savePath) {
            const result = await dialog.showSaveDialog(mainWindow, {
                title: '保存项目',
                defaultPath: '未命名项目.json',
                filters: [
                    { name: 'JSON 文件', extensions: ['json'] }
                ]
            });
            if (result.canceled) return { success: false, canceled: true };
            savePath = result.filePath;
        }
        
        fs.writeFileSync(savePath, JSON.stringify(data, null, 2), 'utf-8');
        currentProjectPath = savePath;
        projectData = data;
        
        mainWindow.setTitle(`AI漫剧流程图 - ${path.basename(savePath)}`);
        
        return { 
            success: true, 
            filePath: savePath,
            fileName: path.basename(savePath)
        };
    } catch (error) {
        console.error('保存失败:', error);
        return { success: false, error: error.message };
    }
});

/**
 * 另存为
 */
ipcMain.handle('save-project-as', async (event, data) => {
    try {
        const result = await dialog.showSaveDialog(mainWindow, {
            title: '另存为',
            defaultPath: '未命名项目.json',
            filters: [
                { name: 'JSON 文件', extensions: ['json'] }
            ]
        });
        if (result.canceled) return { success: false, canceled: true };
        
        const savePath = result.filePath;
        fs.writeFileSync(savePath, JSON.stringify(data, null, 2), 'utf-8');
        currentProjectPath = savePath;
        projectData = data;
        
        mainWindow.setTitle(`AI漫剧流程图 - ${path.basename(savePath)}`);
        
        return { 
            success: true, 
            filePath: savePath,
            fileName: path.basename(savePath)
        };
    } catch (error) {
        console.error('另存为失败:', error);
        return { success: false, error: error.message };
    }
});

/**
 * 导入项目
 */
ipcMain.handle('import-project', async () => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            title: '导入项目',
            filters: [
                { name: 'JSON 文件', extensions: ['json'] }
            ],
            properties: ['openFile']
        });
        if (result.canceled) return { success: false, canceled: true };
        
        const filePath = result.filePaths[0];
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        
        currentProjectPath = filePath;
        projectData = data;
        
        mainWindow.setTitle(`AI漫剧流程图 - ${path.basename(filePath)}`);
        
        return {
            success: true,
            filePath: filePath,
            fileName: path.basename(filePath),
            data: data
        };
    } catch (error) {
        console.error('导入失败:', error);
        return { success: false, error: error.message };
    }
});

/**
 * 打开文件所在位置并选中文件
 */
ipcMain.handle('open-file-location', async (event, filePath) => {
    try {
        if (!filePath) {
            return { success: false, error: '没有文件路径' };
        }
        
        console.log('📂 尝试打开文件位置:', filePath);
        
        const exists = fs.existsSync(filePath);
        if (!exists) {
            const dirPath = filePath.replace(/[^/\\]+$/, '');
            if (fs.existsSync(dirPath)) {
                shell.openPath(dirPath);
                return { success: true, message: '文件不存在，已打开所在目录' };
            }
            return { success: false, error: '文件不存在: ' + filePath };
        }
        
        shell.showItemInFolder(filePath);
        return { success: true };
    } catch (error) {
        console.error('打开文件位置失败:', error);
        return { success: false, error: error.message };
    }
});

/**
 * 获取当前项目路径
 */
ipcMain.handle('get-project-path', () => {
    return currentProjectPath;
});

/**
 * 获取文件信息
 */
ipcMain.handle('get-file-info', async (event, filePath) => {
    try {
        if (!filePath) return null;
        const exists = fs.existsSync(filePath);
        if (!exists) return null;
        const stats = fs.statSync(filePath);
        return {
            path: filePath,
            name: path.basename(filePath),
            size: stats.size,
            isFile: stats.isFile()
        };
    } catch (error) {
        return null;
    }
});

/**
 * 选择图片文件
 */
ipcMain.handle('select-image-files', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: '选择图片',
        filters: [
            { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'] }
        ],
        properties: ['openFile', 'multiSelections']
    });
    if (result.canceled) return [];
    return result.filePaths;
});

/**
 * 选择单个文件（视频/音频/特效/文本）
 */
ipcMain.handle('select-file', async (event, filters) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: '选择文件',
        filters: filters || [{ name: '所有文件', extensions: ['*'] }],
        properties: ['openFile']
    });
    if (result.canceled) return null;
    return result.filePaths[0];
});

/**
 * 显示通知
 */
ipcMain.handle('show-notification', async (event, title, message) => {
    dialog.showMessageBox(mainWindow, {
        title: title,
        message: message,
        buttons: ['确定']
    });
});