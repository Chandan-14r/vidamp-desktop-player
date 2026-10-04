/* =========================================================
   VidAmp Player — Application Main Entry Point (Vite + Electron)
   ========================================================= */

import './styles/main.css';

import { AudioController } from './modules/audio.js';
import { AmbientGlowController } from './modules/ambient.js';
import { SpeedController } from './modules/speed.js';
import { SubtitleEngine } from './modules/subtitles.js';
import { VideoFiltersEngine } from './modules/videoFilters.js';
import { StreamEngine } from './modules/hlsPlayer.js';
import { CreatorTools } from './modules/tools.js';
import { PlaylistManager } from './modules/playlist.js';
import { MediaInfoHUD } from './modules/mediaInfo.js';
import { ShortcutsManager } from './modules/shortcuts.js';
import { UIController } from './modules/ui.js';

class VidAmpPlayerApp {
    constructor() {
        this.video = null;
        this.canvasAmbient = null;
        this.currentMedia = null;
        this.isScrubbing = false;
        this.showRemainingTime = false;
        this.toastTimer = null;

        // Auto-next episode and history state
        this.nextEpisodeTriggered = false;
        this.nextEpisodeDismissed = false;
        this.resumeTimer = null;
        this.lastHistorySaveTime = 0;

        // Explicitly bind all public methods to guarantee 'this' context everywhere
        this.showToast = this.showToast.bind(this);
        this.openFilePicker = this.openFilePicker.bind(this);
        this.openFolderPicker = this.openFolderPicker.bind(this);
        this.openSubtitlePicker = this.openSubtitlePicker.bind(this);
        this.openNetworkUrlPrompt = this.openNetworkUrlPrompt.bind(this);
        this.submitNetworkStream = this.submitNetworkStream.bind(this);
        this.promptJumpToTime = this.promptJumpToTime.bind(this);
        this.submitJumpToTime = this.submitJumpToTime.bind(this);
        this.togglePlay = this.togglePlay.bind(this);
        this.toggleFullscreen = this.toggleFullscreen.bind(this);
        this.togglePiP = this.togglePiP.bind(this);
        this.toggleMute = this.toggleMute.bind(this);
        this.toggleDrawer = this.toggleDrawer.bind(this);
        this.closeDrawer = this.closeDrawer.bind(this);
        this.closeAllModals = this.closeAllModals.bind(this);
        this.toggleShortcutsModal = this.toggleShortcutsModal.bind(this);
        this.scaleWindow = this.scaleWindow.bind(this);
        this.clearWatchHistory = this.clearWatchHistory.bind(this);
        this.renderWatchHistory = this.renderWatchHistory.bind(this);
        this.checkAutoNextEpisode = this.checkAutoNextEpisode.bind(this);
        this.loadFromHistory = this.loadFromHistory.bind(this);
        this.removeFromHistory = this.removeFromHistory.bind(this);

        // Pro Features bindings
        this.openAutoFetchSubtitles = this.openAutoFetchSubtitles.bind(this);
        this.openClipExportModal = this.openClipExportModal.bind(this);
        this.toggleMiniPip = this.toggleMiniPip.bind(this);
        this.openGpuDiagnostics = this.openGpuDiagnostics.bind(this);
        this.cycleHdrMode = this.cycleHdrMode.bind(this);
    }

    init() {
        this.video = document.getElementById('video-element');
        this.canvasAmbient = document.getElementById('ambient-glow-canvas');

        // Instantiate subsystems
        window.VidAmpAudio = new AudioController();
        window.VidAmpAmbient = new AmbientGlowController();
        window.VidAmpSpeed = new SpeedController();
        window.VidAmpSubtitles = new SubtitleEngine();
        window.VidAmpFilters = new VideoFiltersEngine();
        window.VidAmpStream = new StreamEngine();
        window.VidAmpTools = new CreatorTools();
        window.VidAmpPlaylist = new PlaylistManager();
        window.VidAmpHUD = new MediaInfoHUD();
        window.VidAmpShortcuts = new ShortcutsManager();
        window.VidAmpUI = new UIController();

        // Initialize modules safely
        try { window.VidAmpAudio.init(this.video); } catch (e) { console.error('Audio init:', e); }
        try { window.VidAmpAmbient.init(this.canvasAmbient, this.video); } catch (e) { console.error('Ambient init:', e); }
        try {
            window.VidAmpSpeed.init(
                this.video,
                (rate) => this.onSpeedChanged(rate),
                (msg) => this.showToast(msg)
            );
        } catch (e) { console.error('Speed init:', e); }
        try { window.VidAmpSubtitles.init(this.video, document.getElementById('subtitle-overlay')); } catch (e) { console.error('Subtitles init:', e); }
        try { window.VidAmpFilters.init(this.video); } catch (e) { console.error('Filters init:', e); }
        try { window.VidAmpStream.init(this.video); } catch (e) { console.error('Stream init:', e); }
        try { window.VidAmpTools.init(this.video, (msg) => this.showToast(msg)); } catch (e) { console.error('Tools init:', e); }
        try { window.VidAmpPlaylist.init(document.getElementById('playlist-items-container')); } catch (e) { console.error('Playlist init:', e); }
        try { window.VidAmpHUD.init(this.video, document.getElementById('media-info-hud')); } catch (e) { console.error('HUD init:', e); }
        try { window.VidAmpShortcuts.init(this.video); } catch (e) { console.error('Shortcuts init:', e); }
        try { window.VidAmpUI.init(); } catch (e) { console.error('UI init:', e); }

        // Bind DOM event listeners unconditionally
        this.setupThumbnailPreview();
        this.bindVideoEvents();
        this.bindScrubEvents();
        this.bindTitlebarEvents();
        this.bindToolbarEvents();
        this.bindDragAndDrop();

        // Connect with Electron main process
        if (window.vidampAPI) {
            // 1. Fetch initial media passed via "Open With" or command line
            if (window.vidampAPI.getInitialMedia) {
                window.vidampAPI.getInitialMedia().then(files => {
                    if (files && files.length > 0) {
                        window.VidAmpPlaylist.addFiles(files, true);
                    }
                }).catch(err => console.error('getInitialMedia failed:', err));
            }

            // 2. Listen for files while app is already open
            window.vidampAPI.onFileOpened((file) => {
                if (file) window.VidAmpPlaylist.addFiles([file], true);
            });
            if (window.vidampAPI.onFilesBatchOpened) {
                window.vidampAPI.onFilesBatchOpened((files) => {
                    if (files && files.length) window.VidAmpPlaylist.addFiles(files, true);
                });
            }

            window.vidampAPI.onWindowStateChanged(({ isMaximized }) => {
                // Window state tracking
            });

            if (window.vidampAPI.onMiniPipChanged) {
                window.vidampAPI.onMiniPipChanged(({ isMiniPip }) => {
                    document.body.classList.toggle('mini-pip-mode', isMiniPip);
                });
            }
        }

        // Check if there are saved recent items
        if (window.VidAmpPlaylist.items.length > 0) {
            window.VidAmpPlaylist.render();
        }
    }

    loadMedia(item) {
        if (!item || (!item.fileUrl && !item.filePath)) return;
        this.currentMedia = item;
        this.cancelNextEpisodeToast();

        // Reset loops & bookmarks for new media
        window.VidAmpTools.clearLoopAB();

        let src = item.fileUrl || item.filePath;
        const isNetwork = src && (src.startsWith('http://') || src.startsWith('https://'));

        if (src && !isNetwork && !src.startsWith('blob:') && !src.startsWith('file://')) {
            // Convert raw Windows file path to file:/// URL scheme
            src = `file:///${src.replace(/\\/g, '/')}`;
        }

        if (isNetwork) {
            window.VidAmpStream.loadUrl(src, (msg) => this.showToast(msg));
        } else {
            if (window.VidAmpStream) window.VidAmpStream.destroy();
            this.video.src = src;
            this.video.load();
            this.video.play().then(() => {
                window.VidAmpAudio.ensureContext(this.video);
            }).catch((err) => {
                console.warn('Autoplay caught:', err);
            });
        }

        // Update offscreen thumbnail preview video source
        if (this.thumbVideo && src) {
            try {
                this.thumbVideo.src = src;
                this.thumbVideo.load();
            } catch (_) {}
        }

        document.getElementById('empty-state').classList.add('hidden');
        document.getElementById('now-playing-text').textContent = item.fileName;
        document.title = `${item.fileName} — VidAmp Player`;

        // Auto-discover matching adjacent subtitle file (VLC / MPC-HC style, local media only)
        if (!isNetwork && item.filePath && window.vidampAPI && window.vidampAPI.findMatchingSubtitle) {
            window.vidampAPI.findMatchingSubtitle(item.filePath).then(sub => {
                if (sub && sub.content && window.VidAmpSubtitles) {
                    window.VidAmpSubtitles.loadSubtitleText(sub.content, sub.fileName, (msg) => this.showToast(msg));
                }
            }).catch(() => {});
        }

        // Detect multi-track audio (Dual-Audio MKV / MP4)
        if (!isNetwork && item.filePath && window.VidAmpAudio) {
            window.VidAmpAudio.detectAudioTracks(item.filePath, (tracks) => {
                if (tracks && tracks.length > 1) {
                    this.showToast(`🎧 Dual-Audio: ${tracks.length} audio tracks available`);
                }
            });
        }

        // Check for saved resume position (local media only)
        if (!isNetwork) {
            this.checkResumePosition(item);
        }

        this.showToast(`▶ Loaded: ${item.fileName}`);
    }

    checkResumePosition(item) {
        try {
            const key = `vidamp_resume_${item.fileName}`;
            const savedTime = parseFloat(localStorage.getItem(key) || '0');
            const dur = this.video ? this.video.duration : 0;
            if (savedTime > 10 && (!dur || savedTime < dur - 15)) {
                setTimeout(() => {
                    const pill = document.getElementById('smart-resume-pill');
                    const tsEl = document.getElementById('sr-timestamp');
                    const btnResume = document.getElementById('sr-btn-resume');
                    const btnDismiss = document.getElementById('sr-btn-dismiss');

                    if (pill && tsEl && btnResume && btnDismiss) {
                        tsEl.textContent = this.formatTime(savedTime);
                        pill.classList.remove('hidden');

                        btnResume.onclick = (e) => {
                            e.stopPropagation();
                            this.video.currentTime = savedTime;
                            pill.classList.add('hidden');
                            this.showToast(`⏱️ Resumed from ${this.formatTime(savedTime)}`);
                        };

                        btnDismiss.onclick = (e) => {
                            e.stopPropagation();
                            pill.classList.add('hidden');
                        };

                        clearTimeout(this.resumeTimer);
                        this.resumeTimer = setTimeout(() => {
                            if (pill) pill.classList.add('hidden');
                        }, 8000);
                    }
                }, 600);
            }
        } catch (_) {}
    }

    saveResumePosition() {
        if (!this.currentMedia || !this.video) return;
        const cur = this.video.currentTime;
        const dur = this.video.duration || 0;
        if (!Number.isFinite(cur) || cur < 3) return;

        try {
            const key = `vidamp_resume_${this.currentMedia.fileName}`;
            localStorage.setItem(key, String(cur));
            this.saveWatchHistoryItem(this.currentMedia, cur, dur);
        } catch (_) {}
    }

    saveWatchHistoryItem(item, cur, dur) {
        try {
            let history = JSON.parse(localStorage.getItem('vidamp_watch_history') || '[]');
            const id = item.filePath || item.fileName;
            history = history.filter(h => (h.filePath || h.fileName) !== id);

            const entry = {
                id,
                fileName: item.fileName,
                filePath: item.filePath || '',
                fileUrl: item.fileUrl || '',
                currentTime: Math.floor(cur),
                duration: Math.floor(dur),
                progressPercent: dur > 0 ? Math.min(100, Math.round((cur / dur) * 100)) : 0,
                updatedAt: Date.now()
            };

            history.unshift(entry);
            if (history.length > 50) history = history.slice(0, 50);

            localStorage.setItem('vidamp_watch_history', JSON.stringify(history));

            const drawer = document.getElementById('history-drawer');
            if (drawer && drawer.classList.contains('open')) {
                this.renderWatchHistory();
            }
        } catch (_) {}
    }

    renderWatchHistory() {
        const container = document.getElementById('history-items-container');
        if (!container) return;

        let history = [];
        try {
            history = JSON.parse(localStorage.getItem('vidamp_watch_history') || '[]');
        } catch (_) {}

        if (!history || history.length === 0) {
            container.innerHTML = `
                <div class="history-empty-placeholder">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.4;">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <span>No watch history yet. Videos you play will be remembered here!</span>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        const now = Date.now();

        history.forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item';

            const elapsedSec = Math.floor((now - item.updatedAt) / 1000);
            let timeAgo = 'Just now';
            if (elapsedSec >= 86400) timeAgo = `${Math.floor(elapsedSec / 86400)}d ago`;
            else if (elapsedSec >= 3600) timeAgo = `${Math.floor(elapsedSec / 3600)}h ago`;
            else if (elapsedSec >= 60) timeAgo = `${Math.floor(elapsedSec / 60)}m ago`;

            div.innerHTML = `
                <div class="history-item-header">
                    <span class="history-item-title" title="${item.fileName}">${item.fileName}</span>
                    <button class="history-item-remove" title="Remove from history">✕</button>
                </div>
                <div class="history-item-meta">
                    <span>${this.formatTime(item.currentTime)} / ${this.formatTime(item.duration)} (${item.progressPercent}%)</span>
                    <span>${timeAgo}</span>
                </div>
                <div class="history-progress-track">
                    <div class="history-progress-fill" style="width: ${item.progressPercent}%"></div>
                </div>
            `;

            div.onclick = (e) => {
                if (e.target.closest('.history-item-remove')) return;
                this.loadFromHistory(item);
                this.closeDrawer('history-drawer');
            };

            const removeBtn = div.querySelector('.history-item-remove');
            if (removeBtn) {
                removeBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.removeFromHistory(item.id);
                };
            }

            container.appendChild(div);
        });
    }

    clearWatchHistory() {
        try {
            localStorage.removeItem('vidamp_watch_history');
            this.renderWatchHistory();
            this.showToast('🗑️ Watch history cleared');
        } catch (_) {}
    }

    removeFromHistory(id) {
        try {
            let history = JSON.parse(localStorage.getItem('vidamp_watch_history') || '[]');
            history = history.filter(h => h.id !== id);
            localStorage.setItem('vidamp_watch_history', JSON.stringify(history));
            this.renderWatchHistory();
        } catch (_) {}
    }

    loadFromHistory(item) {
        const media = {
            fileName: item.fileName,
            filePath: item.filePath,
            fileUrl: item.fileUrl
        };
        this.loadMedia(media);
        if (item.currentTime > 5) {
            const onLoaded = () => {
                this.video.currentTime = item.currentTime;
                this.showToast(`⏱️ Resumed from ${this.formatTime(item.currentTime)}`);
                this.video.removeEventListener('loadedmetadata', onLoaded);
            };
            this.video.addEventListener('loadedmetadata', onLoaded, { once: true });
        }
    }

    unloadMedia() {
        this.cancelNextEpisodeToast();
        this.currentMedia = null;
        this.video.pause();
        this.video.removeAttribute('src');
        this.video.load();
        document.getElementById('empty-state').classList.remove('hidden');
        document.getElementById('now-playing-text').textContent = 'No media loaded';
        document.title = 'VidAmp Player';
        this.updateTimeDisplay(0, 0);
        this.updateScrubProgress(0);
    }

    bindVideoEvents() {
        this.video.addEventListener('timeupdate', () => {
            if (this.isScrubbing) return;
            const cur = this.video.currentTime;
            const dur = this.video.duration;
            this.updateTimeDisplay(cur, dur);
            this.updateScrubProgress(dur > 0 ? (cur / dur) * 100 : 0);

            // Periodically save progress to history (every 5 seconds)
            const now = Date.now();
            if (now - this.lastHistorySaveTime > 5000 && cur > 3) {
                this.lastHistorySaveTime = now;
                this.saveResumePosition();
            }

            // Auto-Next Episode detection during end credits (last 12 seconds)
            const remaining = dur - cur;
            if (dur > 25 && remaining <= 12 && remaining > 0 && !this.nextEpisodeTriggered && !this.nextEpisodeDismissed) {
                this.checkAutoNextEpisode();
            }
        });

        this.video.addEventListener('progress', () => {
            if (this.video.buffered.length > 0 && this.video.duration > 0) {
                const bufferedEnd = this.video.buffered.end(this.video.buffered.length - 1);
                const pct = (bufferedEnd / this.video.duration) * 100;
                document.getElementById('scrub-buffered').style.width = `${pct}%`;
            }
        });

        this.video.addEventListener('play', () => {
            this.updatePlayPauseButton(true);
            this.flashCenterIcon(true);
        });

        this.video.addEventListener('pause', () => {
            this.updatePlayPauseButton(false);
            this.flashCenterIcon(false);
            this.saveResumePosition();
        });

        this.video.addEventListener('ended', async () => {
            this.updatePlayPauseButton(false);
            this.saveResumePosition();

            if (this.nextEpisodeDismissed) return;

            // If countdown is active, cancel it and proceed to play
            if (this.nextEpisodeInterval) {
                this.cancelNextEpisodeToast();
            }

            // 1. If playlist has multiple items queued, advance to next
            const pl = window.VidAmpPlaylist;
            if (pl && pl.items.length > 1 && pl.currentIndex + 1 < pl.items.length) {
                pl.playNext();
                return;
            }

            // 2. Discover next sequential episode in folder (S01E01 -> S01E02)
            if (this.currentMedia && this.currentMedia.filePath && window.vidampAPI && window.vidampAPI.findNextInFolder) {
                try {
                    const nextItem = await window.vidampAPI.findNextInFolder(this.currentMedia.filePath);
                    if (nextItem) {
                        this.loadMedia(nextItem);
                        return;
                    }
                } catch (err) {
                    console.error('Find next in folder error:', err);
                }
            }

            // 3. Fallback to loop/repeat if applicable
            if (pl && pl.repeatMode === 'all' && pl.items.length > 0) {
                pl.playNext();
            }
        });

        let clickTimer = null;

        // Click on video to play/pause (or dismiss open drawers)
        this.video.addEventListener('click', (e) => {
            if (e.target.closest('#below-video-dock') || e.target.closest('#enhancer-toolbar')) return;

            // Guard against long-press 2x release: NEVER pause on releasing 2x!
            if (window.VidAmpSpeed && (window.VidAmpSpeed.suppressNextClick || (Date.now() - (window.VidAmpSpeed.lastHoldBoostEndTime || 0) < 500))) {
                if (window.VidAmpSpeed) window.VidAmpSpeed.suppressNextClick = false;
                if (clickTimer) {
                    clearTimeout(clickTimer);
                    clickTimer = null;
                }
                e.stopPropagation();
                return;
            }

            const openDrawer = document.querySelector('.drawer.open');
            if (openDrawer) {
                this.closeAllModals();
                e.stopPropagation();
                return;
            }

            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
            }
            clickTimer = setTimeout(() => {
                clickTimer = null;
                this.togglePlay();
            }, 240);
        });

        // Double-click gestures (MX Player / YouTube style):
        // Left 30%: -10s seek jump
        // Right 30%: +10s seek jump
        // Center: toggle fullscreen
        this.video.addEventListener('dblclick', (e) => {
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
            }

            const rect = this.video.getBoundingClientRect();
            const relX = (e.clientX - rect.left) / rect.width;

            if (relX < 0.3) {
                this.seekDelta(-10);
                this.triggerSeekRipple('left');
            } else if (relX > 0.7) {
                this.seekDelta(10);
                this.triggerSeekRipple('right');
            } else {
                this.toggleFullscreen();
            }
        });
    }

    async checkAutoNextEpisode() {
        this.nextEpisodeTriggered = true;
        let nextItem = null;

        const pl = window.VidAmpPlaylist;
        if (pl && pl.items.length > 1 && pl.currentIndex + 1 < pl.items.length) {
            nextItem = pl.items[pl.currentIndex + 1];
        } else if (this.currentMedia && this.currentMedia.filePath && window.vidampAPI && window.vidampAPI.findNextInFolder) {
            try {
                nextItem = await window.vidampAPI.findNextInFolder(this.currentMedia.filePath);
            } catch (_) {}
        }

        if (nextItem && !this.nextEpisodeDismissed) {
            this.showNextEpisodeToast(nextItem);
        }
    }

    togglePlay() {
        if (!this.video.src && !this.currentMedia) {
            this.openFilePicker();
            return;
        }

        if (this.video.paused) {
            this.video.play().then(() => {
                window.VidAmpAudio.ensureContext(this.video);
            }).catch(() => {});
        } else {
            this.video.pause();
        }
    }

    updatePlayPauseButton(isPlaying) {
        const btn = document.getElementById('btn-play-pause');
        if (!btn) return;
        btn.innerHTML = isPlaying
            ? `<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`
            : `<svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
    }

    flashCenterIcon(isPlaying) {
        const ind = document.getElementById('center-play-indicator');
        if (!ind) return;
        ind.innerHTML = isPlaying
            ? `<svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
            : `<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`;
        ind.classList.add('flash');
        setTimeout(() => ind.classList.remove('flash'), 300);
    }

    formatTime(sec) {
        if (!Number.isFinite(sec)) return '--:--';
        sec = Math.max(0, Math.floor(sec));
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        const pad = n => String(n).padStart(2, '0');
        return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
    }

    updateTimeDisplay(cur, dur) {
        const curEl = document.getElementById('current-time-text');
        const durEl = document.getElementById('duration-time-text');
        if (!curEl || !durEl) return;

        curEl.textContent = this.formatTime(cur);
        if (this.showRemainingTime && Number.isFinite(dur)) {
            const rem = Math.max(0, dur - cur);
            durEl.textContent = `-${this.formatTime(rem)}`;
        } else {
            durEl.textContent = this.formatTime(dur);
        }
    }

    toggleTimeRemaining() {
        this.showRemainingTime = !this.showRemainingTime;
        this.updateTimeDisplay(this.video.currentTime, this.video.duration);
    }

    updateScrubProgress(pct) {
        const p = document.getElementById('scrub-progress');
        const h = document.getElementById('scrub-handle');
        if (p) p.style.width = `${pct}%`;
        if (h) h.style.left = `${pct}%`;
    }

    setupThumbnailPreview() {
        this.thumbVideo = document.createElement('video');
        this.thumbVideo.muted = true;
        this.thumbVideo.playsInline = true;
        this.thumbVideo.preload = 'auto';
        // Position offscreen so Chromium active media decoding pipeline runs without throttling
        this.thumbVideo.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:160px;height:90px;opacity:0;pointer-events:none;';
        document.body.appendChild(this.thumbVideo);

        this.thumbSeeking = false;
        this.pendingThumbTime = null;

        const drawFrame = () => {
            const canvas = document.getElementById('thumb-preview-canvas');
            if (canvas && this.thumbVideo && this.thumbVideo.videoWidth > 0) {
                const ctx = canvas.getContext('2d');
                ctx.drawImage(this.thumbVideo, 0, 0, canvas.width, canvas.height);
            }
        };

        this.thumbVideo.addEventListener('loadeddata', () => {
            drawFrame();
        });

        this.thumbVideo.addEventListener('seeked', () => {
            drawFrame();
            if (this.pendingThumbTime !== null) {
                const nextTime = this.pendingThumbTime;
                this.pendingThumbTime = null;
                try {
                    this.thumbVideo.currentTime = nextTime;
                } catch (_) {
                    this.thumbSeeking = false;
                }
            } else {
                this.thumbSeeking = false;
            }
        });
    }

    requestThumbSeek(time) {
        if (!this.thumbVideo || !Number.isFinite(time)) return;
        if (this.thumbVideo.readyState < 1) {
            // Draw current player video frame if ready as initial preview
            const canvas = document.getElementById('thumb-preview-canvas');
            if (canvas && this.video && this.video.videoWidth > 0) {
                const ctx = canvas.getContext('2d');
                ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);
            }
            return;
        }
        if (this.thumbSeeking) {
            this.pendingThumbTime = time;
        } else {
            this.thumbSeeking = true;
            try {
                this.thumbVideo.currentTime = time;
            } catch (_) {
                this.thumbSeeking = false;
            }
        }
    }

    bindScrubEvents() {
        const container = document.getElementById('scrub-bar-container');
        const tooltip = document.getElementById('scrub-tooltip');
        if (!container) return;

        const seekToEvent = (e) => {
            const rect = container.getBoundingClientRect();
            const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            if (Number.isFinite(this.video.duration)) {
                this.video.currentTime = pos * this.video.duration;
            }
        };

        container.addEventListener('mousedown', (e) => {
            this.isScrubbing = true;
            seekToEvent(e);
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isScrubbing) {
                seekToEvent(e);
            }
        });

        window.addEventListener('mouseup', () => {
            if (this.isScrubbing) {
                this.isScrubbing = false;
            }
        });

        container.addEventListener('mousemove', (e) => {
            if (!this.video || !this.video.duration || !Number.isFinite(this.video.duration)) return;
            const rect = container.getBoundingClientRect();
            const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const targetTime = pos * this.video.duration;

            if (tooltip) {
                tooltip.style.display = 'flex';
                const halfW = 85;
                const clampedX = Math.max(halfW, Math.min(rect.width - halfW, e.clientX - rect.left));
                tooltip.style.left = `${clampedX}px`;

                const timeEl = document.getElementById('thumb-preview-time');
                if (timeEl) timeEl.textContent = this.formatTime(targetTime);

                this.requestThumbSeek(targetTime);
            }
        });

        container.addEventListener('mouseleave', () => {
            if (tooltip) tooltip.style.display = 'none';
        });

        // Click on time display to toggle remaining time
        const timeWrap = document.querySelector('.time-display');
        if (timeWrap) {
            timeWrap.addEventListener('click', () => this.toggleTimeRemaining());
        }
    }

    seekDelta(delta) {
        if (!this.video || !Number.isFinite(this.video.duration)) return;
        this.video.currentTime = Math.max(0, Math.min(this.video.duration, this.video.currentTime + delta));
    }

    stepFrame(direction) {
        if (!this.video) return;
        this.video.pause();
        const FRAME_TIME = 1 / 30; // ~0.0333s
        this.video.currentTime = Math.max(0, this.video.currentTime + (direction * FRAME_TIME));
        const sign = direction > 0 ? '+1' : '-1';
        this.showToast(`🎞️ Frame ${sign} · ${this.formatTime(this.video.currentTime)}`);
    }

    triggerSeekRipple(side) {
        const ripple = document.getElementById(side === 'left' ? 'seek-ripple-left' : 'seek-ripple-right');
        if (!ripple) return;
        ripple.classList.remove('active');
        void ripple.offsetWidth; // Force DOM reflow to re-trigger CSS animation
        ripple.classList.add('active');
        clearTimeout(this[`_${side}RippleTimer`]);
        this[`_${side}RippleTimer`] = setTimeout(() => {
            ripple.classList.remove('active');
        }, 500);
    }

    showNextEpisodeToast(nextItem) {
        this.cancelNextEpisodeToast();

        const toast = document.getElementById('next-episode-toast');
        const filenameEl = document.getElementById('ne-filename');
        const secEl = document.getElementById('ne-seconds');
        const fillEl = document.getElementById('ne-progress-fill');
        const btnCancel = document.getElementById('ne-btn-cancel');
        const btnPlay = document.getElementById('ne-btn-play');

        if (!toast || !filenameEl || !secEl || !fillEl) return;

        filenameEl.textContent = nextItem.fileName;
        secEl.textContent = '5';
        fillEl.style.width = '100%';
        toast.classList.remove('hidden');

        const DURATION_MS = 5000;
        const startTime = Date.now();

        const playNextNow = () => {
            this.cancelNextEpisodeToast();
            if (window.VidAmpPlaylist) {
                window.VidAmpPlaylist.addFiles([nextItem], true);
            } else {
                this.loadMedia(nextItem);
            }
        };

        if (btnPlay) {
            btnPlay.onclick = (e) => {
                e.stopPropagation();
                playNextNow();
            };
        }

        if (btnCancel) {
            btnCancel.onclick = (e) => {
                e.stopPropagation();
                this.cancelNextEpisodeToast();
                this.showToast('Autoplay cancelled');
            };
        }

        this.nextEpisodeInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, DURATION_MS - elapsed);
            const secondsLeft = Math.ceil(remaining / 1000);
            const pct = (remaining / DURATION_MS) * 100;

            secEl.textContent = String(secondsLeft);
            fillEl.style.width = `${pct}%`;

            if (remaining <= 0) {
                playNextNow();
            }
        }, 100);
    }

    cancelNextEpisodeToast() {
        if (this.nextEpisodeInterval) {
            clearInterval(this.nextEpisodeInterval);
            this.nextEpisodeInterval = null;
        }
        const toast = document.getElementById('next-episode-toast');
        if (toast) toast.classList.add('hidden');
    }

    // Titlebar & Sizing Controls
    bindTitlebarEvents() {
        const btnMin = document.getElementById('btn-win-min');
        const btnMax = document.getElementById('btn-win-max');
        const btnClose = document.getElementById('btn-win-close');

        // Window Controls
        if (btnMax) btnMax.onclick = () => this.toggleFullscreen();

        if (window.vidampAPI) {
            if (btnMin) btnMin.onclick = () => window.vidampAPI.minimize();
            if (btnClose) btnClose.onclick = () => window.vidampAPI.close();

            // Listen for native fullscreen state changes from Electron
            if (window.vidampAPI.onFullscreenChanged) {
                window.vidampAPI.onFullscreenChanged(({ isFullScreen }) => {
                    document.body.classList.toggle('is-fullscreen', isFullScreen);
                    if (btnMax) {
                        btnMax.innerHTML = isFullScreen
                            ? `<svg viewBox="0 0 24 24"><path d="M4 8V4h4M4 4l6 6M20 8v-4h-4M20 4l-6 6M4 16v4h4M4 20l6-6M20 16v4h-4M20 20l-6-6"/></svg>`
                            : `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;
                    }
                    // Dispatch custom events for UI autohide system
                    window.dispatchEvent(new Event(isFullScreen ? 'fullscreen-entered' : 'fullscreen-exited'));
                });
            }

            // Pin Always on Top
            const pinBtn = document.getElementById('btn-pin-ontop');
            if (pinBtn) {
                let onTop = false;
                pinBtn.onclick = () => {
                    onTop = !onTop;
                    window.vidampAPI.setAlwaysOnTop(onTop);
                    pinBtn.classList.toggle('active', onTop);
                    this.showToast(onTop ? '📌 Always on Top: ON' : '📌 Always on Top: OFF');
                };
            }
        }

        // Drawers (ALWAYS wired!)
        const btnPl = document.getElementById('btn-toggle-playlist');
        if (btnPl) btnPl.onclick = () => this.toggleDrawer('playlist-drawer');

        const btnHist = document.getElementById('btn-toggle-history');
        if (btnHist) btnHist.onclick = () => this.toggleDrawer('history-drawer');

        const btnEq = document.getElementById('btn-toggle-eq');
        if (btnEq) btnEq.onclick = () => this.toggleDrawer('eq-drawer');

        // Explicit Close Buttons on Drawers
        const btnCloseEq = document.getElementById('btn-close-eq');
        if (btnCloseEq) {
            btnCloseEq.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.closeDrawer('eq-drawer');
            };
        }

        const btnClosePlaylist = document.getElementById('btn-close-playlist');
        if (btnClosePlaylist) {
            btnClosePlaylist.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.closeDrawer('playlist-drawer');
            };
        }

        const btnCloseHistory = document.getElementById('btn-close-history');
        if (btnCloseHistory) {
            btnCloseHistory.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.closeDrawer('history-drawer');
            };
        }
    }

    scaleWindow(scale) {
        if (!window.vidampAPI) return;
        const w = this.video.videoWidth || 1280;
        const h = this.video.videoHeight || 720;
        window.vidampAPI.scaleWindow(scale, w, h);
        this.showToast(`🖥️ Window Scaled: ${Math.round(scale * 100)}%`);
    }

    closeDrawer(drawerId) {
        const target = document.getElementById(drawerId);
        if (target) {
            target.classList.remove('open');
        }
        const anyOpen = document.querySelectorAll('.drawer.open');
        if (anyOpen.length === 0) {
            const container = document.getElementById('app-container');
            if (container) container.classList.remove('drawer-open');
        }
        if (drawerId === 'eq-drawer' && window.VidAmpAudio) {
            window.VidAmpAudio.stopVisualizer();
        }
    }

    toggleDrawer(drawerId) {
        const target = document.getElementById(drawerId);
        if (!target) return;
        const wasOpen = target.classList.contains('open');

        // Close other drawers
        document.querySelectorAll('.drawer').forEach(d => {
            if (d.id !== drawerId) d.classList.remove('open');
        });

        const container = document.getElementById('app-container');

        if (!wasOpen) {
            target.classList.add('open');
            if (container) container.classList.add('drawer-open');
            if (drawerId === 'eq-drawer' && window.VidAmpAudio) {
                window.VidAmpAudio.startVisualizer(document.getElementById('audio-visualizer-canvas'));
            }
            if (drawerId === 'history-drawer') {
                this.renderWatchHistory();
            }
        } else {
            target.classList.remove('open');
            if (container) container.classList.remove('drawer-open');
            if (drawerId === 'eq-drawer' && window.VidAmpAudio) {
                window.VidAmpAudio.stopVisualizer();
            }
        }
    }

    // Toolbar Controls
    bindToolbarEvents() {
        const hideAllPopovers = () => {
            document.querySelectorAll('.tb-popover').forEach(p => p.classList.remove('visible'));
        };

        // Close popovers when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.tb-popover') && !e.target.closest('.tb-btn') && !e.target.closest('.tb-speed-btn')) {
                hideAllPopovers();
            }
        });

        const btnPlayPause = document.getElementById('btn-play-pause');
        if (btnPlayPause) btnPlayPause.onclick = () => this.togglePlay();

        // Loop Whole Video
        const btnLoop = document.getElementById('tb-loop');
        if (btnLoop) {
            btnLoop.onclick = () => {
                this.video.loop = !this.video.loop;
                btnLoop.classList.toggle('active', this.video.loop);
                this.showToast(this.video.loop ? '🔁 Loop: ON' : '🔁 Loop: OFF');
            };
        }

        // Volume Boost (100% -> 150% -> 200% -> 250% -> 100%)
        const btnVolBoost = document.getElementById('tb-volboost');
        if (btnVolBoost) {
            btnVolBoost.onclick = () => {
                const curVol = window.VidAmpAudio ? window.VidAmpAudio.volume : 1.0;
                let nextVol = 1.0;
                if (curVol <= 1.05) nextVol = 1.5;
                else if (curVol <= 1.55) nextVol = 2.0;
                else if (curVol <= 2.05) nextVol = 2.5;
                else nextVol = 1.0;

                if (window.VidAmpAudio) {
                    window.VidAmpAudio.applyVolume(nextVol, (msg) => this.showToast(msg));
                }
            };
            btnVolBoost.oncontextmenu = (e) => {
                e.preventDefault();
                if (window.VidAmpAudio) {
                    window.VidAmpAudio.applyVolume(1.0, (msg) => this.showToast(msg));
                }
            };
        }

        // Bass & Vocal EQ
        const btnBass = document.getElementById('tb-bass');
        if (btnBass) {
            btnBass.onclick = () => {
                if (window.VidAmpAudio) {
                    window.VidAmpAudio.toggleBassBoost((msg) => this.showToast(msg));
                }
            };
            btnBass.oncontextmenu = (e) => {
                e.preventDefault();
                if (window.VidAmpAudio) {
                    window.VidAmpAudio.toggleVocalBoost((msg) => this.showToast(msg));
                }
            };
        }

        // Night Mode Dialogue Clarity
        const btnSpeech = document.getElementById('tb-speech');
        if (btnSpeech) {
            btnSpeech.onclick = () => {
                if (window.VidAmpAudio) {
                    window.VidAmpAudio.toggleNightModeDialogue((msg) => this.showToast(msg));
                }
            };
        }

        // Cinema Mode (True Theater Dimming)
        const btnCinema = document.getElementById('tb-cinema');
        const cinemaOverlay = document.getElementById('cinema-overlay');
        const toggleCinema = () => {
            const isCinema = document.body.classList.toggle('cinema-active');
            if (cinemaOverlay) cinemaOverlay.classList.toggle('visible', isCinema);
            if (btnCinema) btnCinema.classList.toggle('active', isCinema);
            this.showToast(isCinema ? '🎬 Cinema Mode: ON (Theater Lights Dimmed)' : '🎬 Cinema Mode: OFF');
        };
        if (btnCinema) btnCinema.onclick = toggleCinema;
        if (cinemaOverlay) cinemaOverlay.onclick = toggleCinema;

        // Ambient Glow
        const btnAmbient = document.getElementById('tb-ambient');
        if (btnAmbient) {
            btnAmbient.onclick = () => {
                if (window.VidAmpAmbient) {
                    const active = window.VidAmpAmbient.toggle((msg) => this.showToast(msg));
                    btnAmbient.classList.toggle('active', active);
                }
            };
            if (window.VidAmpAmbient && window.VidAmpAmbient.active) {
                btnAmbient.classList.add('active');
            }
        }

        // Fullscreen
        const btnTheater = document.getElementById('tb-theater');
        if (btnTheater) btnTheater.onclick = () => this.toggleFullscreen();

        // PiP
        const btnPip = document.getElementById('tb-pip');
        if (btnPip) btnPip.onclick = () => this.togglePiP();

        // Aspect Ratio: Click opens Popover, Right-click resets to standard 16:9
        const btnAspect = document.getElementById('tb-aspect');
        const aspectPopover = document.getElementById('aspect-popover');
        if (btnAspect) {
            btnAspect.onclick = (e) => {
                e.stopPropagation();
                const wasVis = aspectPopover && aspectPopover.classList.contains('visible');
                hideAllPopovers();
                if (aspectPopover && !wasVis) aspectPopover.classList.add('visible');
            };
            btnAspect.oncontextmenu = (e) => {
                e.preventDefault();
                if (window.VidAmpFilters) window.VidAmpFilters.setAspectById('contain', (msg) => this.showToast(msg));
            };
        }

        // Rotate 90° & Mirror Flip
        const btnRotate = document.getElementById('tb-rotate');
        if (btnRotate) {
            btnRotate.onclick = () => {
                if (window.VidAmpFilters) window.VidAmpFilters.rotateClockwise((msg) => this.showToast(msg));
            };
            btnRotate.oncontextmenu = (e) => {
                e.preventDefault();
                if (window.VidAmpFilters) window.VidAmpFilters.toggleFlipHorizontal((msg) => this.showToast(msg));
            };
        }

        // Speed Pill Click -> Popover
        const btnSpeed = document.getElementById('tb-speed');
        const speedPopover = document.getElementById('speed-popover');
        if (btnSpeed) {
            btnSpeed.onclick = (e) => {
                e.stopPropagation();
                const wasVis = speedPopover && speedPopover.classList.contains('visible');
                hideAllPopovers();
                if (speedPopover && !wasVis) speedPopover.classList.add('visible');
            };
            btnSpeed.oncontextmenu = (e) => {
                e.preventDefault();
                if (window.VidAmpSpeed) window.VidAmpSpeed.reset();
            };
        }

        // Filter Preset: Click opens Popover (with Night Vision, OLED, HDR, etc.), Right-click cycles
        const btnFilters = document.getElementById('tb-filters');
        const filtersPopover = document.getElementById('filters-popover');
        if (btnFilters) {
            btnFilters.onclick = (e) => {
                e.stopPropagation();
                const wasVis = filtersPopover && filtersPopover.classList.contains('visible');
                hideAllPopovers();
                if (filtersPopover && !wasVis) filtersPopover.classList.add('visible');
            };
            btnFilters.oncontextmenu = (e) => {
                e.preventDefault();
                if (window.VidAmpFilters) window.VidAmpFilters.cyclePreset((msg) => this.showToast(msg));
            };
        }

        // Screenshot Capture
        const btnScreenshot = document.getElementById('tb-screenshot');
        if (btnScreenshot) {
            btnScreenshot.onclick = () => {
                if (window.VidAmpTools) {
                    window.VidAmpTools.captureScreenshot(this.currentMedia ? this.currentMedia.fileName : 'VidAmp');
                }
            };
        }

        // A-B Loop & Clip Export
        const btnAbLoop = document.getElementById('tb-abloop');
        if (btnAbLoop) {
            btnAbLoop.onclick = () => {
                if (window.VidAmpTools) window.VidAmpTools.cycleLoopAB();
            };
            btnAbLoop.oncontextmenu = (e) => {
                e.preventDefault();
                this.openClipExportModal();
            };
        }

        // Dedicated 1-Click GIF / Clip Export button
        const btnClipExport = document.getElementById('tb-clip-export');
        if (btnClipExport) {
            btnClipExport.onclick = () => this.openClipExportModal();
        }

        // Multi-Track Audio Switcher Toolbar Button
        const btnAudioTrack = document.getElementById('tb-audio-track');
        if (btnAudioTrack) {
            btnAudioTrack.onclick = () => {
                if (window.VidAmpAudio) window.VidAmpAudio.cycleAudioTrack((msg) => this.showToast(msg));
            };
            btnAudioTrack.oncontextmenu = (e) => {
                e.preventDefault();
                this.toggleDrawer('eq-drawer');
            };
        }

        // Always-On-Top Mini PiP Controller Button
        const btnMiniPip = document.getElementById('tb-mini-pip');
        if (btnMiniPip) {
            btnMiniPip.onclick = () => this.toggleMiniPip();
        }

        // Mini PiP Mode Restore Button
        const btnMiniRestore = document.getElementById('mini-pip-restore-btn');
        if (btnMiniRestore) {
            btnMiniRestore.onclick = () => this.toggleMiniPip();
        }

        // Auto-Fetch Subtitles Button
        const btnAutoSub = document.getElementById('btn-auto-subtitles');
        if (btnAutoSub) {
            btnAutoSub.onclick = () => this.openAutoFetchSubtitles();
        }

        // GPU & HDR Diagnostics Badge / Button
        const btnGpuHdr = document.getElementById('btn-gpu-hdr');
        if (btnGpuHdr) {
            btnGpuHdr.onclick = () => this.openGpuDiagnostics();
        }

        // Bookmarks Popover Toggle
        const btnBookmark = document.getElementById('tb-bookmark');
        const bmPopover = document.getElementById('bookmark-popover');
        if (btnBookmark) {
            btnBookmark.onclick = (e) => {
                e.stopPropagation();
                const wasVis = bmPopover && bmPopover.classList.contains('visible');
                hideAllPopovers();
                if (bmPopover && !wasVis) bmPopover.classList.add('visible');
            };
            btnBookmark.oncontextmenu = (e) => {
                e.preventDefault();
                if (window.VidAmpTools) window.VidAmpTools.addBookmark();
            };
        }

        // Sleep Timer
        const btnSleep = document.getElementById('tb-sleep');
        if (btnSleep) {
            btnSleep.onclick = () => {
                if (window.VidAmpTools) window.VidAmpTools.cycleSleepTimer();
            };
        }

        // Pro Tools & Settings Drawer
        const btnSettings = document.getElementById('tb-settings');
        if (btnSettings) {
            btnSettings.onclick = () => {
                this.toggleDrawer('eq-drawer');
            };
        }
    }

    onSpeedChanged(rate) {
        document.getElementById('tb-speed-val').textContent = window.VidAmpSpeed.formatSpeed(rate);
        document.querySelectorAll('.sp-pill').forEach(pill => {
            const pRate = Number(pill.getAttribute('data-speed'));
            pill.classList.toggle('active', Math.abs(pRate - rate) < 0.01);
        });
    }

    // File Pickers
    async openFilePicker() {
        if (window.vidampAPI) {
            const files = await window.vidampAPI.openFileDialog();
            if (files && files.length) {
                window.VidAmpPlaylist.addFiles(files, true);
            }
        } else {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'video/*,audio/*';
            input.multiple = true;
            input.onchange = (e) => {
                const files = Array.from(e.target.files).map(f => ({
                    filePath: f.name,
                    fileName: f.name,
                    fileUrl: URL.createObjectURL(f),
                    size: f.size
                }));
                window.VidAmpPlaylist.addFiles(files, true);
            };
            input.click();
        }
    }

    async openFolderPicker() {
        if (window.vidampAPI) {
            const files = await window.vidampAPI.openFolderDialog();
            if (files && files.length) {
                window.VidAmpPlaylist.addFiles(files, true);
            }
        }
    }

    async openSubtitlePicker() {
        if (window.vidampAPI && window.vidampAPI.openSubtitleDialog) {
            const sub = await window.vidampAPI.openSubtitleDialog();
            if (sub && sub.content && window.VidAmpSubtitles) {
                window.VidAmpSubtitles.loadSubtitleText(sub.content, sub.fileName, (msg) => this.showToast(msg));
            }
        } else {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.srt,.vtt,.ass,.sub';
            input.onchange = (e) => {
                if (e.target.files && e.target.files.length) {
                    const f = e.target.files[0];
                    const reader = new FileReader();
                    reader.onload = (re) => {
                        if (window.VidAmpSubtitles) {
                            window.VidAmpSubtitles.loadSubtitleText(re.target.result, f.name, (msg) => this.showToast(msg));
                        }
                    };
                    reader.readAsText(f);
                }
            };
            input.click();
        }
    }

    openNetworkUrlPrompt() {
        const modal = document.getElementById('network-stream-modal');
        const input = document.getElementById('network-stream-url-input');
        if (modal) {
            modal.classList.add('open');
            if (input) {
                setTimeout(() => {
                    input.focus();
                    input.select();
                }, 100);
            }
        }
    }

    submitNetworkStream() {
        const input = document.getElementById('network-stream-url-input');
        if (!input || !input.value.trim()) return;
        const streamUrl = input.value.trim();
        const modal = document.getElementById('network-stream-modal');
        if (modal) modal.classList.remove('open');

        let fileName = 'Network Stream';
        try {
            const parsed = new URL(streamUrl);
            const pathSegments = parsed.pathname.split('/').filter(Boolean);
            fileName = pathSegments.length > 0 ? decodeURIComponent(pathSegments[pathSegments.length - 1]) : parsed.hostname;
        } catch (_) {
            fileName = streamUrl.split('/').pop().split('?')[0] || 'Network Stream';
        }

        const item = {
            filePath: streamUrl,
            fileName: fileName,
            fileUrl: streamUrl,
            isNetworkStream: true
        };
        window.VidAmpPlaylist.addFiles([item], true);
        this.showToast(`🌐 Loading Stream: ${fileName}`);
    }

    promptJumpToTime() {
        const modal = document.getElementById('jump-time-modal');
        const input = document.getElementById('jump-time-input');
        if (modal) {
            modal.classList.add('open');
            if (input) {
                input.value = this.formatTime(this.video ? this.video.currentTime || 0 : 0);
                setTimeout(() => {
                    input.focus();
                    input.select();
                }, 100);
            }
        }
    }

    submitJumpToTime() {
        const input = document.getElementById('jump-time-input');
        if (!input || !input.value.trim()) return;
        const raw = input.value.trim();
        const modal = document.getElementById('jump-time-modal');
        if (modal) modal.classList.remove('open');

        // Parse format: [hh:]mm:ss or pure seconds
        let seconds = 0;
        const parts = raw.split(':').map(p => parseFloat(p));
        if (parts.length === 3 && !parts.some(isNaN)) {
            seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2 && !parts.some(isNaN)) {
            seconds = parts[0] * 60 + parts[1];
        } else if (!isNaN(parseFloat(raw))) {
            seconds = parseFloat(raw);
        } else {
            this.showToast('⚠️ Invalid timestamp format');
            return;
        }

        if (this.video && Number.isFinite(seconds)) {
            this.video.currentTime = Math.max(0, Math.min(seconds, this.video.duration || seconds));
            this.showToast(`⏱️ Jumped to ${this.formatTime(this.video.currentTime)}`);
        }
    }

    // Drag and Drop
    bindDragAndDrop() {
        const dropOverlay = document.getElementById('drag-overlay');

        ['dragenter', 'dragover'].forEach(eventName => {
            window.addEventListener(eventName, (e) => {
                e.preventDefault();
                if (dropOverlay) dropOverlay.classList.add('active');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            window.addEventListener(eventName, (e) => {
                e.preventDefault();
                if (e.target === dropOverlay || e.type === 'drop') {
                    if (dropOverlay) dropOverlay.classList.remove('active');
                }
            });
        });

        window.addEventListener('drop', (e) => {
            e.preventDefault();
            if (dropOverlay) dropOverlay.classList.remove('active');

            if (e.dataTransfer && e.dataTransfer.files.length) {
                const subExts = ['.srt', '.vtt', '.ass', '.sub'];
                const subFiles = [];
                const mediaFiles = [];

                for (let i = 0; i < e.dataTransfer.files.length; i++) {
                    const f = e.dataTransfer.files[i];
                    const name = (f.name || '').toLowerCase();
                    const isSub = subExts.some(ext => name.endsWith(ext));
                    if (isSub) {
                        subFiles.push(f);
                    } else {
                        mediaFiles.push({
                            filePath: f.path || f.name,
                            fileName: f.name,
                            fileUrl: f.path ? `file://${f.path.replace(/\\/g, '/')}` : URL.createObjectURL(f),
                            size: f.size
                        });
                    }
                }

                // If subtitle files dropped, load into SubtitleEngine
                if (subFiles.length > 0) {
                    const subF = subFiles[0];
                    const reader = new FileReader();
                    reader.onload = (re) => {
                        if (window.VidAmpSubtitles) {
                            window.VidAmpSubtitles.loadSubtitleText(re.target.result, subF.name, (msg) => this.showToast(msg));
                        }
                    };
                    reader.readAsText(subF);
                }

                // If media files dropped, add ONLY media files to playlist (never subtitle files!)
                if (mediaFiles.length > 0) {
                    window.VidAmpPlaylist.addFiles(mediaFiles, true);
                }
            }
        });
    }

    toggleFullscreen() {
        if (window.vidampAPI && window.vidampAPI.toggleFullscreen) {
            window.vidampAPI.toggleFullscreen();
        } else {
            // Fallback to browser Fullscreen API
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
            } else {
                document.exitFullscreen().catch(() => {});
            }
        }
    }

    togglePiP() {
        if (!this.video) return;
        if (document.pictureInPictureElement) {
            document.exitPictureInPicture().catch(() => {});
        } else if (document.pictureInPictureEnabled) {
            this.video.requestPictureInPicture().catch(() => {});
        }
    }

    toggleMute() {
        if (!this.video) return;
        this.video.muted = !this.video.muted;
        const btnMute = document.getElementById('btn-inline-mute');
        if (btnMute) {
            btnMute.innerHTML = this.video.muted
                ? `<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`
                : `<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
            btnMute.classList.toggle('active', this.video.muted);
        }
        this.showToast(this.video.muted ? '🔇 Muted' : '🔊 Unmuted');
    }

    toggleToolbarVisibility() {
        window.VidAmpUI.toggleToolbar();
    }

    toggleShortcutsModal() {
        document.getElementById('shortcuts-modal').classList.toggle('open');
    }

    closeAllModals() {
        document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
        document.querySelectorAll('.drawer').forEach(d => d.classList.remove('open'));
        const container = document.getElementById('app-container');
        if (container) container.classList.remove('drawer-open');
        if (window.VidAmpAudio) {
            window.VidAmpAudio.stopVisualizer();
        }
        const cinemaOverlay = document.getElementById('cinema-overlay');
        if (cinemaOverlay) cinemaOverlay.classList.remove('visible');
        const tbCinema = document.getElementById('tb-cinema');
        if (tbCinema) tbCinema.classList.remove('active');
        const speedPopover = document.getElementById('speed-popover');
        if (speedPopover) speedPopover.classList.remove('visible');
        const bookmarkPopover = document.getElementById('bookmark-popover');
        if (bookmarkPopover) bookmarkPopover.classList.remove('visible');
    }

    openAutoFetchSubtitles() {
        if (window.VidAmpSubtitles) {
            window.VidAmpSubtitles.openAutoFetchModal(this.currentMedia, (msg) => this.showToast(msg));
        }
    }

    openClipExportModal() {
        if (window.VidAmpTools) {
            window.VidAmpTools.openClipExportModal(this.currentMedia);
        }
    }

    toggleMiniPip() {
        if (window.vidampAPI && window.vidampAPI.toggleMiniPip) {
            window.vidampAPI.toggleMiniPip().then(isMini => {
                this.showToast(isMini ? '📌 Mini PiP Controller Active' : '🖥️ Restored Player Window');
            }).catch(() => {});
        } else {
            this.togglePiP();
        }
    }

    openGpuDiagnostics() {
        if (window.VidAmpFilters) {
            window.VidAmpFilters.openGpuDiagnosticsModal();
        }
    }

    cycleHdrMode() {
        if (!window.VidAmpFilters) return;
        const modes = ['off', 'bt2020', 'cinema', 'oled'];
        const cur = window.VidAmpFilters.hdrMode || 'off';
        const nextIdx = (modes.indexOf(cur) + 1) % modes.length;
        window.VidAmpFilters.setHdrMode(modes[nextIdx], (msg) => this.showToast(msg));
    }

    showToast(message) {
        const toast = document.getElementById('osd-toast');
        if (!toast) return;

        toast.textContent = message;
        toast.classList.add('visible');

        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => {
            toast.classList.remove('visible');
        }, 1600);
    }
}

window.VidAmpApp = new VidAmpPlayerApp();
document.addEventListener('DOMContentLoaded', () => {
    window.VidAmpApp.init();
});
