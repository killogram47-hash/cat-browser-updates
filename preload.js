const { contextBridge } = require('electron');

// Expose a limited API to the renderer process
contextBridge.exposeInMainWorld('catBrowser', {
    version: '1.0.0'
});
