const { contextBridge } = require('electron');
const packageJson = require('./package.json');

// Expose a limited API to the renderer process
contextBridge.exposeInMainWorld('catBrowser', {
    version: packageJson.version || '0.0.0'
});
