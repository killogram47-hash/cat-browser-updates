const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let splashWindow;
let mainWindow;
let autoUpdater = null;
let updateCheckInterval = null;
let manualUpdateCheckRequested = false;
const userDataPath = path.join(os.homedir(), 'AppData', 'Local', 'CatBrowser');
const runtimeUpdateUrl = process.env.CAT_UPDATE_URL;

try {
    ({ autoUpdater } = require('electron-updater'));
} catch (error) {
    console.warn('Auto-updater disabled:', error.message);
}

if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
}

app.setPath('userData', userDataPath);

const handleSquirrelEvent = () => {
    if (process.argv[1] === 'squirrel-install') {
        app.quit();
        return true;
    }

    return false;
};

if (handleSquirrelEvent()) return;

function createWindow() {
    splashWindow = new BrowserWindow({
        width: 420,
        height: 320,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        transparent: false,
        center: true,
        show: false
    });

    splashWindow.loadFile(path.join(__dirname, 'splash.html'));
    splashWindow.once('ready-to-show', () => {
        splashWindow.show();
    });

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 600,
        minHeight: 400,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            sandbox: true,
            webviewTag: true
        },
        show: false
    });

    mainWindow.loadFile('index.html');

    mainWindow.once('ready-to-show', () => {
        if (splashWindow) {
            splashWindow.destroy();
            splashWindow = null;
        }
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function setupAutoUpdater() {
    if (!autoUpdater) return;

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    if (runtimeUpdateUrl) {
        autoUpdater.setFeedURL({
            provider: 'generic',
            url: runtimeUpdateUrl
        });
        console.log(`[Updater] Runtime feed URL: ${runtimeUpdateUrl}`);
    }

    autoUpdater.on('checking-for-update', () => {
        console.log('[Updater] Checking for updates...');
    });

    autoUpdater.on('update-not-available', () => {
        console.log('[Updater] No updates available.');
        if (manualUpdateCheckRequested) {
            manualUpdateCheckRequested = false;
            dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'No Updates',
                message: 'You are using the latest version of Cat Browser.',
                buttons: ['OK']
            });
        }
    });

    autoUpdater.on('download-progress', (progress) => {
        console.log(`[Updater] Download ${Math.round(progress.percent)}%`);
    });

    checkForUpdates(false);

    updateCheckInterval = setInterval(() => {
        checkForUpdates(false);
    }, 5 * 60 * 1000);
}

function checkForUpdates(manual = false) {
    if (!autoUpdater) return;

    if (manual) {
        manualUpdateCheckRequested = true;
    }

    autoUpdater.checkForUpdates().catch((error) => {
        manualUpdateCheckRequested = false;
        const message = error?.message || String(error);
        console.error('[Updater] Check failed:', message);

        if (manual && mainWindow) {
            dialog.showMessageBox(mainWindow, {
                type: 'error',
                title: 'Update Check Failed',
                message: 'Could not check updates right now.',
                detail: message,
                buttons: ['OK']
            });
        }
    });
}

app.on('ready', () => {
    createWindow();
    setupAutoUpdater();
});

app.on('window-all-closed', () => {
    if (updateCheckInterval) {
        clearInterval(updateCheckInterval);
        updateCheckInterval = null;
    }

    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

const template = [
    {
        label: 'File',
        submenu: [
            {
                label: 'New Window',
                accelerator: 'CmdOrCtrl+N',
                click: () => createWindow()
            },
            { type: 'separator' },
            {
                label: 'Exit',
                accelerator: 'CmdOrCtrl+Q',
                click: () => {
                    app.quit();
                }
            }
        ]
    },
    {
        label: 'Edit',
        submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' }
        ]
    },
    {
        label: 'View',
        submenu: [
            { role: 'reload' },
            { role: 'forceReload' },
            {
                label: 'Developer Tools',
                accelerator: 'F12',
                click: () => {
                    if (mainWindow) mainWindow.webContents.toggleDevTools();
                }
            },
            { type: 'separator' },
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' }
        ]
    },
    {
        label: 'Help',
        submenu: [
            autoUpdater ? {
                label: 'Check for Updates Now',
                click: () => checkForUpdates(true)
            } : {
                label: 'Check for Updates Now',
                enabled: false
            },
            { type: 'separator' },
            {
                label: 'About Cat Browser',
                click: () => {
                    dialog.showMessageBox(mainWindow, {
                        type: 'info',
                        title: 'About Cat Browser',
                        message: 'Cat Browser',
                        detail: `Version ${app.getVersion()}\n\nA Google-like desktop search application with custom search engine support.`,
                        buttons: ['OK']
                    });
                }
            }
        ]
    }
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);

if (autoUpdater) {
    autoUpdater.on('update-available', (info) => {
        const versionText = info?.version ? `Version: ${info.version}\n\n` : '';
        const notesRaw = Array.isArray(info?.releaseNotes)
            ? info.releaseNotes.map((x) => (typeof x === 'string' ? x : x?.note || '')).join('\n')
            : (typeof info?.releaseNotes === 'string' ? info.releaseNotes : '');
        const notes = notesRaw ? `What's new:\n${notesRaw}` : 'The update will download in background.';
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Update Available',
            message: 'A new version of Cat Browser is available!',
            detail: `${versionText}${notes}`,
            buttons: ['OK']
        });
    });

    autoUpdater.on('update-downloaded', (info) => {
        const versionText = info?.version ? `Version: ${info.version}\n\n` : '';
        const notesRaw = Array.isArray(info?.releaseNotes)
            ? info.releaseNotes.map((x) => (typeof x === 'string' ? x : x?.note || '')).join('\n')
            : (typeof info?.releaseNotes === 'string' ? info.releaseNotes : '');
        const notes = notesRaw ? `What's new:\n${notesRaw}\n\n` : '';
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Update Ready',
            message: 'Update downloaded successfully!',
            detail: `${versionText}${notes}The application will restart to apply the update.`,
            buttons: ['Restart Now', 'Later']
        }).then((result) => {
            if (result.response === 0) {
                autoUpdater.quitAndInstall();
            }
        });
    });

    autoUpdater.on('error', (error) => {
        console.error('Update error:', error);
        if (manualUpdateCheckRequested && mainWindow) {
            manualUpdateCheckRequested = false;
            dialog.showMessageBox(mainWindow, {
                type: 'error',
                title: 'Update Error',
                message: 'Updater encountered an error.',
                detail: error?.message || String(error),
                buttons: ['OK']
            });
        }
    });
}
