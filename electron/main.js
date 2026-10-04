const { app, BrowserWindow, ipcMain, dialog, shell, protocol, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const url = require('url');
const https = require('https');
const zlib = require('zlib');
const { execFile, spawn } = require('child_process');

// Hardware Acceleration & Chromium Power Features
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-accelerated-video-decode');
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,AudioTrackList,PlatformHEVCDecoderSupport');
app.commandLine.appendSwitch('enable-blink-features', 'AudioVideoTracks');
app.commandLine.appendSwitch('enable-hdr');
app.commandLine.appendSwitch('high-dpi-support', '1');

let mainWindow = null;
let prevWindowBounds = null;
let isMiniPipActive = false;

const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'webm', 'mov', 'avi', 'ts', 'flv', 'wmv', 'm4v', 'ogv', '3gp'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'opus'];
const ALL_MEDIA_EXTS = [...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS];
const SUBTITLE_EXTENSIONS = ['srt', 'vtt', 'ass', 'sub'];

function isMediaFile(filePath) {
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    return ALL_MEDIA_EXTS.includes(ext);
}

function isSubtitleFile(filePath) {
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    return SUBTITLE_EXTENSIONS.includes(ext);
}

function readTextFileSmart(filePath) {
    try {
        const buf = fs.readFileSync(filePath);
        let content;
        if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
            content = buf.toString('utf16le');
        } else if (buf.length >= 2 && buf[0] === 0xFE && buf[1] === 0xFF) {
            buf.swap16();
            content = buf.toString('utf16le');
        } else {
            content = buf.toString('utf8');
        }
        return content.replace(/^\uFEFF/, '');
    } catch (e) {
        console.error('readTextFileSmart error:', e);
        return '';
    }
}

function parseMediaFromArgs(argList) {
    const mediaToOpen = [];
    if (!argList || !Array.isArray(argList)) return mediaToOpen;

    for (let arg of argList) {
        if (!arg || typeof arg !== 'string') continue;
        // Strip any surrounding quotes Windows might pass
        arg = arg.trim().replace(/^"(.*)"$/, '$1');
        if (!arg || arg.startsWith('--')) continue;

        if (arg.startsWith('http://') || arg.startsWith('https://')) {
            let fileName = 'Network Stream';
            try {
                const u = new url.URL(arg);
                const segs = u.pathname.split('/').filter(Boolean);
                fileName = segs.length > 0 ? decodeURIComponent(segs[segs.length - 1]) : u.hostname;
            } catch (_) {}
            mediaToOpen.push({
                filePath: arg,
                fileName: fileName,
                fileUrl: arg,
                isNetworkStream: true
            });
            continue;
        }

        try {
            if (fs.existsSync(arg)) {
                const stat = fs.statSync(arg);
                if (stat.isDirectory()) {
                    const items = fs.readdirSync(arg);
                    for (const item of items) {
                        const full = path.join(arg, item);
                        if (fs.existsSync(full) && fs.statSync(full).isFile() && isMediaFile(full)) {
                            mediaToOpen.push({
                                filePath: full,
                                fileName: item,
                                fileUrl: url.pathToFileURL(full).href,
                                size: fs.statSync(full).size
                            });
                        }
                    }
                } else if (isMediaFile(arg)) {
                    mediaToOpen.push({
                        filePath: arg,
                        fileName: path.basename(arg),
                        fileUrl: url.pathToFileURL(arg).href,
                        size: stat.size
                    });
                }
            }
        } catch (_) {}
    }
    return mediaToOpen;
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 820,
        minWidth: 720,
        minHeight: 480,
        frame: false,
        backgroundColor: '#0a0c12',
        title: 'VidAmp Player',
        icon: path.join(__dirname, 'icons', 'icon512.png'),
        show: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: false, // Enables local media playback, canvas capture, Web Audio without CORS restrictions
            allowRunningInsecureContent: true
        }
    });

    // Ensure window is shown and focused
    mainWindow.once('ready-to-show', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });

    // Fallback force show
    setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
            mainWindow.show();
            mainWindow.focus();
        }
    }, 800);

    // Forward renderer console logs to terminal for debugging
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        console.log(`[Renderer] ${message}`);
    });

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        console.error(`[Main] Failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
        const fallback = path.join(__dirname, '..', 'dist', 'index.html');
        if (validatedURL !== fallback && fs.existsSync(fallback)) {
            mainWindow.loadFile(fallback);
        }
    });

    // Check if running in development mode with Vite server, or production dist
    const isDev = process.env.VITE_DEV_SERVER_URL || process.argv.includes('--dev');
    if (isDev) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173');
    } else {
        const distIndex = path.join(__dirname, '..', 'dist', 'index.html');
        if (fs.existsSync(distIndex)) {
            mainWindow.loadFile(distIndex);
        } else {
            // Fallback to local dev server or index.html
            mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
        }
    }

    mainWindow.on('maximize', () => {
        mainWindow.webContents.send('window:state-changed', { isMaximized: true });
    });

    mainWindow.on('unmaximize', () => {
        mainWindow.webContents.send('window:state-changed', { isMaximized: false });
    });

    mainWindow.on('enter-full-screen', () => {
        mainWindow.webContents.send('window:fullscreen-changed', { isFullScreen: true });
    });

    mainWindow.on('leave-full-screen', () => {
        mainWindow.webContents.send('window:fullscreen-changed', { isFullScreen: false });
    });

    mainWindow.webContents.on('did-finish-load', () => {
        // Send command-line arguments (delayed slightly to ensure renderer listener is active)
        const args = process.argv.slice(app.isPackaged ? 1 : 2);
        const mediaToOpen = parseMediaFromArgs(args);
        if (mediaToOpen.length > 0) {
            setTimeout(() => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('files:batch-opened', mediaToOpen);
                }
            }, 300);
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine) => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();

            const mediaToOpen = parseMediaFromArgs(commandLine.slice(1));
            if (mediaToOpen.length > 0) {
                mainWindow.webContents.send('files:batch-opened', mediaToOpen);
            }
        } else {
            createWindow();
        }
    });

    app.whenReady().then(() => {
        createWindow();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });

    app.on('window-all-closed', () => {
        app.quit();
    });
}

/* =========================================================
   IPC Handlers
   ========================================================= */

// File Open Dialog
ipcMain.handle('dialog:open-files', async () => {
    if (!mainWindow) return null;
    const res = await dialog.showOpenDialog(mainWindow, {
        title: 'Open Media File(s) — VidAmp Player',
        properties: ['openFile', 'multiSelections'],
        filters: [
            { name: 'All Media Files', extensions: ALL_MEDIA_EXTS },
            { name: 'Video Files', extensions: VIDEO_EXTENSIONS },
            { name: 'Audio Files', extensions: AUDIO_EXTENSIONS },
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    if (res.canceled || !res.filePaths.length) return null;

    return res.filePaths.map(filePath => ({
        filePath,
        fileName: path.basename(filePath),
        fileUrl: url.pathToFileURL(filePath).href,
        size: fs.statSync(filePath).size
    }));
});

// Subtitle Open Dialog
ipcMain.handle('dialog:open-subtitles', async () => {
    if (!mainWindow) return null;
    const res = await dialog.showOpenDialog(mainWindow, {
        title: 'Open Subtitle File — VidAmp Player',
        properties: ['openFile'],
        filters: [
            { name: 'Subtitle Files', extensions: SUBTITLE_EXTENSIONS },
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    if (res.canceled || !res.filePaths.length) return null;

    const subPath = res.filePaths[0];
    const content = readTextFileSmart(subPath);
    return {
        filePath: subPath,
        fileName: path.basename(subPath),
        ext: path.extname(subPath).toLowerCase().replace('.', ''),
        content
    };
});

// Auto-discover matching adjacent subtitle file for a video
ipcMain.handle('subtitles:find-for-media', async (event, videoPath) => {
    if (!videoPath || typeof videoPath !== 'string') return null;
    try {
        if (!fs.existsSync(videoPath)) return null;
        const dir = path.dirname(videoPath);
        const base = path.basename(videoPath, path.extname(videoPath));
        const extCandidates = ['.srt', '.vtt', '.ass', '.sub', '.en.srt', '.eng.srt', '.default.srt'];

        for (const ext of extCandidates) {
            const candidatePath = path.join(dir, `${base}${ext}`);
            if (fs.existsSync(candidatePath)) {
                return {
                    filePath: candidatePath,
                    fileName: path.basename(candidatePath),
                    content: readTextFileSmart(candidatePath)
                };
            }
        }
    } catch (err) {
        console.error('Find matching subtitle error:', err);
    }
    return null;
});

// Auto-discover next sequential episode/media in folder (Netflix / VLC style)
ipcMain.handle('media:find-next-in-folder', async (event, currentPath) => {
    if (!currentPath || typeof currentPath !== 'string') return null;
    try {
        if (!fs.existsSync(currentPath)) return null;
        const dir = path.dirname(currentPath);
        const currentFile = path.basename(currentPath);
        const entries = fs.readdirSync(dir);
        const mediaFiles = entries.filter(f => {
            const full = path.join(dir, f);
            try {
                return fs.statSync(full).isFile() && isMediaFile(full);
            } catch (_) {
                return false;
            }
        });

        // Natural alphanumeric sorting (e.g. S01E01 -> S01E02 -> ... -> S01E10)
        const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
        mediaFiles.sort(collator.compare);

        const currentIdx = mediaFiles.findIndex(f => f.toLowerCase() === currentFile.toLowerCase());
        if (currentIdx !== -1 && currentIdx + 1 < mediaFiles.length) {
            const nextFile = mediaFiles[currentIdx + 1];
            const nextFullPath = path.join(dir, nextFile);
            return {
                filePath: nextFullPath,
                fileName: nextFile,
                fileUrl: url.pathToFileURL(nextFullPath).href,
                size: fs.statSync(nextFullPath).size
            };
        }
    } catch (err) {
        console.error('Find next in folder error:', err);
    }
    return null;
});

// Folder Open Dialog (Batch Queue Scan)
ipcMain.handle('dialog:open-folder', async () => {
    if (!mainWindow) return null;
    const res = await dialog.showOpenDialog(mainWindow, {
        title: 'Open Folder to Play — VidAmp Player',
        properties: ['openDirectory']
    });

    if (res.canceled || !res.filePaths.length) return null;

    const folderPath = res.filePaths[0];
    const items = fs.readdirSync(folderPath);
    const mediaFiles = [];

    for (const item of items) {
        const fullPath = path.join(folderPath, item);
        try {
            const stat = fs.statSync(fullPath);
            if (stat.isFile() && isMediaFile(fullPath)) {
                mediaFiles.push({
                    filePath: fullPath,
                    fileName: item,
                    fileUrl: url.pathToFileURL(fullPath).href,
                    size: stat.size
                });
            }
        } catch (_) {}
    }

    return mediaFiles;
});

// Window Sizing (MPC-HC 50%, 100%, 200%)
ipcMain.on('window:scale', (event, { scale, videoWidth, videoHeight }) => {
    if (!mainWindow || !videoWidth || !videoHeight) return;
    const targetWidth = Math.round(videoWidth * scale);
    const targetHeight = Math.round(videoHeight * scale) + 72; // titlebar + toolbar allowance
    mainWindow.setSize(Math.max(640, targetWidth), Math.max(480, targetHeight));
    mainWindow.center();
});

// Window Controls
ipcMain.on('window:minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.on('window:close', () => {
    if (mainWindow) mainWindow.close();
    app.quit();
});

ipcMain.handle('window:is-maximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
});

ipcMain.handle('window:toggle-fullscreen', () => {
    if (!mainWindow) return false;
    const isFS = mainWindow.isFullScreen();
    mainWindow.setFullScreen(!isFS);
    return !isFS;
});

ipcMain.handle('window:is-fullscreen', () => {
    return mainWindow ? mainWindow.isFullScreen() : false;
});

ipcMain.on('window:set-fullscreen', (event, flag) => {
    if (mainWindow) {
        mainWindow.setFullScreen(!!flag);
    }
});

ipcMain.on('window:set-always-on-top', (event, flag) => {
    if (mainWindow) {
        mainWindow.setAlwaysOnTop(!!flag);
    }
});

// Screenshot Saver
ipcMain.handle('media:save-screenshot', async (event, { base64Data, defaultName }) => {
    if (!mainWindow) return false;
    const picturesDir = app.getPath('pictures');
    const defaultPath = path.join(picturesDir, defaultName || `VidAmp_Frame_${Date.now()}.png`);

    const res = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Frame Screenshot — VidAmp Player',
        defaultPath,
        filters: [
            { name: 'PNG Image', extensions: ['png'] },
            { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] }
        ]
    });

    if (res.canceled || !res.filePath) return false;

    const data = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(data, 'base64');
    fs.writeFileSync(res.filePath, buffer);
    return res.filePath;
});

// Mini-Clip Exporter Saver
ipcMain.handle('media:save-clip', async (event, { base64Data, defaultName }) => {
    if (!mainWindow) return false;
    const videosDir = app.getPath('videos');
    const defaultPath = path.join(videosDir, defaultName || `VidAmp_Clip_${Date.now()}.webm`);

    const res = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Mini-Clip — VidAmp Player',
        defaultPath,
        filters: [
            { name: 'WebM Video', extensions: ['webm'] },
            { name: 'MP4 Video', extensions: ['mp4'] }
        ]
    });

    if (res.canceled || !res.filePath) return false;

    const data = base64Data.replace(/^data:video\/\w+;base64,/, '');
    const buffer = Buffer.from(data, 'base64');
    fs.writeFileSync(res.filePath, buffer);
    return res.filePath;
});

ipcMain.on('shell:open-external', (event, targetUrl) => {
    shell.openExternal(targetUrl);
});

// Provide initial command-line media files directly on demand to renderer
ipcMain.handle('app:get-initial-media', () => {
    const args = process.argv.slice(app.isPackaged ? 1 : 2);
    return parseMediaFromArgs(args);
});

ipcMain.on('app:toggle-devtools', () => {
    if (mainWindow) mainWindow.webContents.toggleDevTools();
});

/* =========================================================
   Advanced Pro Features IPC Handlers
   ========================================================= */

// 1. 📌 Always-On-Top Mini PiP Controller
ipcMain.handle('window:toggle-mini-pip', async () => {
    if (!mainWindow) return false;

    if (!isMiniPipActive) {
        prevWindowBounds = {
            bounds: mainWindow.getBounds(),
            isMaximized: mainWindow.isMaximized()
        };

        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        }

        const currentBounds = mainWindow.getBounds();
        const display = screen.getDisplayMatching(currentBounds);
        const area = display.workArea;

        const pipWidth = 420;
        const pipHeight = 246;
        const x = area.x + area.width - pipWidth - 20;
        const y = area.y + area.height - pipHeight - 20;

        mainWindow.setBounds({ x, y, width: pipWidth, height: pipHeight });
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
        mainWindow.setMinimumSize(320, 180);
        isMiniPipActive = true;
    } else {
        mainWindow.setAlwaysOnTop(false);
        mainWindow.setMinimumSize(720, 480);
        if (prevWindowBounds) {
            mainWindow.setBounds(prevWindowBounds.bounds);
            if (prevWindowBounds.isMaximized) {
                mainWindow.maximize();
            }
        } else {
            mainWindow.setSize(1280, 820);
            mainWindow.center();
        }
        isMiniPipActive = false;
    }

    mainWindow.webContents.send('window:mini-pip-state-changed', { isMiniPip: isMiniPipActive });
    return isMiniPipActive;
});

ipcMain.handle('window:is-mini-pip', () => isMiniPipActive);

// 2. ⚡ Hardware Acceleration & GPU Diagnostics
ipcMain.handle('gpu:get-diagnostics', async () => {
    const featureStatus = app.getGPUFeatureStatus();
    let gpuInfo = null;
    try {
        gpuInfo = await app.getGPUInfo('basic');
    } catch (_) {}

    return {
        featureStatus,
        gpuInfo,
        isAccelerated: featureStatus.gpu_compositing === 'enabled'
    };
});

// 3. 🔎 Auto-Fetch Subtitles (OpenSubtitles REST API + Decompress)
ipcMain.handle('subtitles:search-online', async (event, { query, lang = 'all' }) => {
    if (!query || typeof query !== 'string') return [];
    return new Promise((resolve) => {
        const cleanQuery = encodeURIComponent(query.trim());
        const langPart = (lang && lang !== 'all') ? `/sublanguageid-${lang}` : '';
        const reqUrl = `https://rest.opensubtitles.org/search/query-${cleanQuery}${langPart}`;

        const req = https.get(reqUrl, {
            headers: { 'User-Agent': 'TemporaryUserAgent' }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (!Array.isArray(json)) return resolve([]);
                    const results = json.slice(0, 50).map(item => ({
                        id: item.IDSubtitleFile,
                        movieName: item.MovieName || item.SubFileName,
                        movieYear: item.MovieYear,
                        subFileName: item.SubFileName,
                        langName: item.LanguageName,
                        langCode: item.SubLanguageID,
                        downloadUrl: item.SubDownloadLink,
                        format: item.SubFormat || 'srt',
                        downloads: item.SubDownloadsCnt || 0,
                        rating: item.SubRating || '0.0'
                    }));
                    resolve(results);
                } catch (e) {
                    resolve([]);
                }
            });
        });

        req.on('error', () => resolve([]));
        req.setTimeout(8000, () => {
            req.destroy();
            resolve([]);
        });
    });
});

ipcMain.handle('subtitles:download-online', async (event, { downloadUrl, fileName, videoPath }) => {
    if (!downloadUrl) return { success: false, error: 'No download URL' };

    return new Promise((resolve) => {
        function fetchUrl(targetUrl) {
            https.get(targetUrl, {
                headers: { 'User-Agent': 'TemporaryUserAgent' }
            }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return fetchUrl(res.headers.location);
                }

                const chunks = [];
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    zlib.gunzip(buffer, (err, decompressed) => {
                        let text = '';
                        if (!err) {
                            text = decompressed.toString('utf8');
                        } else {
                            text = buffer.toString('utf8');
                        }

                        let savedPath = null;
                        try {
                            if (videoPath && fs.existsSync(videoPath)) {
                                const dir = path.dirname(videoPath);
                                const base = path.basename(videoPath, path.extname(videoPath));
                                savedPath = path.join(dir, `${base}.en.srt`);
                                fs.writeFileSync(savedPath, text);
                            }
                        } catch (_) {}

                        resolve({
                            success: true,
                            content: text,
                            fileName: fileName || 'online_subtitle.srt',
                            savedPath
                        });
                    });
                });
            }).on('error', (err) => resolve({ success: false, error: err.message }));
        }

        fetchUrl(downloadUrl);
    });
});

// 4. 🎧 Multi-Track Audio Switcher (ffprobe track discovery + audio demuxing)
ipcMain.handle('media:get-audio-tracks', async (event, filePath) => {
    if (!filePath || typeof filePath !== 'string' || !fs.existsSync(filePath)) return [];
    return new Promise((resolve) => {
        const args = [
            '-v', 'error',
            '-select_streams', 'a',
            '-show_entries', 'stream=index,codec_name,channels,channel_layout:stream_tags=language,title',
            '-of', 'json',
            filePath
        ];
        execFile('ffprobe', args, (err, stdout) => {
            if (err || !stdout) return resolve([]);
            try {
                const data = JSON.parse(stdout);
                const streams = (data.streams || []).map((s, idx) => {
                    const tags = s.tags || {};
                    const lang = tags.language || 'und';
                    const title = tags.title || `Audio Track ${idx + 1}`;
                    const codec = (s.codec_name || 'audio').toUpperCase();
                    const channels = s.channels === 6 ? '5.1 Surround' : (s.channels === 8 ? '7.1 Surround' : `${s.channels || 2}ch`);
                    return {
                        index: idx,
                        streamIndex: s.index,
                        language: lang,
                        title: title,
                        codec: codec,
                        channels: channels,
                        label: `${title} [${lang.toUpperCase()}] (${codec}, ${channels})`
                    };
                });
                resolve(streams);
            } catch (_) {
                resolve([]);
            }
        });
    });
});

ipcMain.handle('media:extract-audio-track', async (event, { filePath, trackIndex }) => {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const tempDir = app.getPath('temp');
    const outAudioPath = path.join(tempDir, `vidamp_audio_track_${trackIndex}.m4a`);
    return new Promise((resolve) => {
        const args = [
            '-y',
            '-i', filePath,
            '-map', `0:a:${trackIndex}`,
            '-c:a', 'aac',
            '-b:a', '192k',
            outAudioPath
        ];
        execFile('ffmpeg', args, (err) => {
            if (err) return resolve(null);
            resolve(url.pathToFileURL(outAudioPath).href);
        });
    });
});

// 5. ✂️ 1-Click GIF / Clip Export (FFmpeg High-Res / Palette GIF)
ipcMain.handle('media:export-clip-ffmpeg', async (event, params) => {
    const { filePath, startTime, endTime, format, resolution, fps } = params;
    if (!mainWindow || !filePath || !fs.existsSync(filePath)) return { success: false, error: 'File not found' };

    const duration = endTime - startTime;
    const baseName = path.basename(filePath, path.extname(filePath));
    const ext = format === 'gif' ? 'gif' : 'mp4';
    const defaultName = `${baseName}_clip_${Math.floor(startTime)}s-${Math.floor(endTime)}s.${ext}`;
    const filterName = format === 'gif' ? 'Animated GIF' : 'MP4 Video';

    const saveRes = await dialog.showSaveDialog(mainWindow, {
        title: `Export ${format.toUpperCase()} Clip — VidAmp Player`,
        defaultPath: path.join(app.getPath('videos'), defaultName),
        filters: [
            { name: filterName, extensions: [ext] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    if (saveRes.canceled || !saveRes.filePath) return { success: false, canceled: true };
    const targetPath = saveRes.filePath;

    let scaleFilter = '';
    if (resolution === '720p') scaleFilter = 'scale=-2:720';
    else if (resolution === '480p') scaleFilter = 'scale=-2:480';
    else if (resolution === '360p') scaleFilter = 'scale=-2:360';
    else if (format === 'gif') scaleFilter = 'scale=480:-1:flags=lanczos';

    let args = [];
    if (format === 'gif') {
        const gifFps = fps || 15;
        const filterStr = scaleFilter 
            ? `[0:v] fps=${gifFps},${scaleFilter},split [a][b];[a] palettegen=stats_mode=diff [p];[b][p] paletteuse=dither=bayer:bayer_scale=5`
            : `[0:v] fps=${gifFps},scale=480:-1:flags=lanczos,split [a][b];[a] palettegen=stats_mode=diff [p];[b][p] paletteuse=dither=bayer:bayer_scale=5`;

        args = [
            '-y',
            '-ss', String(startTime),
            '-to', String(endTime),
            '-i', filePath,
            '-filter_complex', filterStr,
            targetPath
        ];
    } else {
        const vfList = [];
        if (scaleFilter) vfList.push(scaleFilter);

        args = [
            '-y',
            '-ss', String(startTime),
            '-to', String(endTime),
            '-i', filePath
        ];
        if (vfList.length) {
            args.push('-vf', vfList.join(','));
        }
        args.push(
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '22',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '192k',
            targetPath
        );
    }

    return new Promise((resolve) => {
        execFile('ffmpeg', args, (err, stdout, stderr) => {
            if (err) {
                console.error('ffmpeg export error:', err, stderr);
                resolve({ success: false, error: err.message });
            } else {
                resolve({ success: true, targetPath, format });
            }
        });
    });
});

ipcMain.on('shell:show-item-in-folder', (event, filePath) => {
    if (filePath && fs.existsSync(filePath)) {
        shell.showItemInFolder(filePath);
    }
});
