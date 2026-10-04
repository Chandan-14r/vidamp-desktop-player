const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vidampAPI', {
    // Native Dialogs
    openFileDialog: () => ipcRenderer.invoke('dialog:open-files'),
    openFolderDialog: () => ipcRenderer.invoke('dialog:open-folder'),
    openSubtitleDialog: () => ipcRenderer.invoke('dialog:open-subtitles'),
    findMatchingSubtitle: (videoPath) => ipcRenderer.invoke('subtitles:find-for-media', videoPath),
    saveScreenshot: (payload) => ipcRenderer.invoke('media:save-screenshot', payload),
    saveClip: (payload) => ipcRenderer.invoke('media:save-clip', payload),
    getInitialMedia: () => ipcRenderer.invoke('app:get-initial-media'),
    findNextInFolder: (videoPath) => ipcRenderer.invoke('media:find-next-in-folder', videoPath),

    // Window Management & Sizing
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    toggleFullscreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),
    setFullscreen: (flag) => ipcRenderer.send('window:set-fullscreen', flag),
    isFullScreen: () => ipcRenderer.invoke('window:is-fullscreen'),
    setAlwaysOnTop: (flag) => ipcRenderer.send('window:set-always-on-top', flag),
    scaleWindow: (scale, videoWidth, videoHeight) => ipcRenderer.send('window:scale', { scale, videoWidth, videoHeight }),

    // Pro Features (Subtitles, FFmpeg, Audio Tracks, Mini PiP, GPU)
    searchOnlineSubtitles: (query, lang) => ipcRenderer.invoke('subtitles:search-online', { query, lang }),
    downloadOnlineSubtitle: (payload) => ipcRenderer.invoke('subtitles:download-online', payload),
    getAudioTracks: (filePath) => ipcRenderer.invoke('media:get-audio-tracks', filePath),
    extractAudioTrack: (payload) => ipcRenderer.invoke('media:extract-audio-track', payload),
    exportClipFFmpeg: (params) => ipcRenderer.invoke('media:export-clip-ffmpeg', params),
    toggleMiniPip: () => ipcRenderer.invoke('window:toggle-mini-pip'),
    isMiniPip: () => ipcRenderer.invoke('window:is-mini-pip'),
    onMiniPipChanged: (cb) => {
        ipcRenderer.on('window:mini-pip-state-changed', (event, data) => cb(data));
    },
    getGpuDiagnostics: () => ipcRenderer.invoke('gpu:get-diagnostics'),
    showItemInFolder: (filePath) => ipcRenderer.send('shell:show-item-in-folder', filePath),

    // External and IPC Listeners
    onWindowStateChanged: (cb) => {
        ipcRenderer.on('window:state-changed', (event, data) => cb(data));
    },
    onFullscreenChanged: (cb) => {
        ipcRenderer.on('window:fullscreen-changed', (event, data) => cb(data));
    },
    onFileOpened: (cb) => {
        ipcRenderer.on('file:opened', (event, data) => cb(data));
    },
    onFilesBatchOpened: (cb) => {
        ipcRenderer.on('files:batch-opened', (event, data) => cb(data));
    },
    openExternal: (url) => ipcRenderer.send('shell:open-external', url),
    toggleDevTools: () => ipcRenderer.send('app:toggle-devtools')
});
