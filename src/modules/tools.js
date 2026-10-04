/* =========================================================
   VidAmp Player — Creator & Study Tools
   - A-B Loop repeater
   - High-Res Mini-Clip Exporter (MediaRecorder captureStream)
   - Frame Capture / Screenshot to Pictures folder
   - Timestamp Bookmarking with 1-click jump list
   - Sleep Timer with 3s volume fade
   ========================================================= */

export class CreatorTools {
    constructor() {
        this.video = null;
        this.onToast = null;

        // A-B Loop
        this.loopA = null;
        this.loopB = null;

        // Clip Exporter
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isExportingClip = false;

        // Bookmarks
        this.bookmarks = [];

        // Sleep Timer
        this.sleepOptions = [0, 15, 30, 45, 60, -1]; // 0=off, -1=end of video
        this.sleepIndex = 0;
        this.sleepTimerId = null;
    }

    init(videoEl, onToast) {
        this.video = videoEl;
        this.onToast = onToast;

        this.video.addEventListener('timeupdate', () => {
            // A-B Loop enforcement
            if (this.loopA !== null && this.loopB !== null && this.loopA < this.loopB) {
                if (this.video.currentTime >= this.loopB || this.video.currentTime < this.loopA - 0.5) {
                    if (this.isExportingClip) {
                        this.stopClipExport();
                    } else {
                        this.video.currentTime = this.loopA;
                    }
                }
            }
        });

        this.video.addEventListener('ended', () => {
            if (this.sleepOptions[this.sleepIndex] === -1) {
                this.executeSleepFade();
            }
        });
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

    // A-B Loop
    setPointA() {
        if (!this.video) return;
        this.loopA = this.video.currentTime;
        this.updateLoopMarkers();
        if (this.onToast) this.onToast(`⚗️ Loop Point A: ${this.formatTime(this.loopA)}`);
    }

    setPointB() {
        if (!this.video) return;
        if (this.loopA === null) {
            this.setPointA();
            return;
        }
        this.loopB = this.video.currentTime;
        this.updateLoopMarkers();
        if (this.onToast) this.onToast(`⚗️ Loop Point B: ${this.formatTime(this.loopB)}`);
    }

    cycleLoopAB() {
        if (this.loopA === null) {
            this.setPointA();
        } else if (this.loopB === null) {
            this.setPointB();
        } else {
            this.clearLoopAB();
        }
    }

    clearLoopAB() {
        this.loopA = null;
        this.loopB = null;
        this.updateLoopMarkers();
        if (this.onToast) this.onToast('⚗️ A-B Loop Cleared');
    }

    updateLoopMarkers() {
        const flagA = document.getElementById('loop-flag-a');
        const flagB = document.getElementById('loop-flag-b');
        const tbBtn = document.getElementById('tb-abloop');
        const dur = this.video.duration;

        if (this.loopA !== null && dur > 0 && flagA) {
            flagA.style.display = 'block';
            flagA.style.left = `${(this.loopA / dur) * 100}%`;
        } else if (flagA) {
            flagA.style.display = 'none';
        }

        if (this.loopB !== null && dur > 0 && flagB) {
            flagB.style.display = 'block';
            flagB.style.left = `${(this.loopB / dur) * 100}%`;
        } else if (flagB) {
            flagB.style.display = 'none';
        }

        if (tbBtn) {
            tbBtn.classList.toggle('active', this.loopA !== null || this.loopB !== null);
        }
    }

    // 1-Click GIF & Clip Exporter
    openClipExportModal(currentMedia) {
        if (!this.video) return;

        // Auto-initialize A-B markers if not set
        if (this.loopA === null || this.loopB === null || this.loopA >= this.loopB) {
            const cur = this.video.currentTime || 0;
            const dur = this.video.duration || (cur + 10);
            this.loopA = Math.max(0, Math.floor(cur));
            this.loopB = Math.min(dur, Math.floor(cur) + 5);
            this.updateLoopMarkers();
            if (this.onToast) this.onToast(`✂️ Set default 5s clip: ${this.formatTime(this.loopA)} → ${this.formatTime(this.loopB)}`);
        }

        const modal = document.getElementById('clip-export-modal');
        const startInput = document.getElementById('clip-export-start');
        const endInput = document.getElementById('clip-export-end');
        const durPill = document.getElementById('clip-export-dur');
        const statusEl = document.getElementById('clip-export-status');

        if (!modal) return;

        if (startInput) startInput.value = this.loopA.toFixed(1);
        if (endInput) endInput.value = this.loopB.toFixed(1);
        if (durPill) durPill.textContent = `${(this.loopB - this.loopA).toFixed(1)}s`;
        if (statusEl) statusEl.innerHTML = '';

        this.currentMediaForExport = currentMedia;
        modal.classList.add('open');
    }

    async runClipExport() {
        if (!this.video) return;
        const startInput = document.getElementById('clip-export-start');
        const endInput = document.getElementById('clip-export-end');
        const formatSelect = document.getElementById('clip-export-format');
        const resSelect = document.getElementById('clip-export-res');
        const fpsSelect = document.getElementById('clip-export-fps');
        const statusEl = document.getElementById('clip-export-status');
        const exportBtn = document.getElementById('btn-run-export-clip');

        const startTime = parseFloat(startInput ? startInput.value : this.loopA);
        const endTime = parseFloat(endInput ? endInput.value : this.loopB);
        const format = formatSelect ? formatSelect.value : 'mp4';
        const resolution = resSelect ? resSelect.value : 'original';
        const fps = parseInt(fpsSelect ? fpsSelect.value : '15', 10);

        if (isNaN(startTime) || isNaN(endTime) || startTime >= endTime) {
            if (statusEl) statusEl.innerHTML = '<span style="color:var(--accent-rose)">⚠️ Invalid start or end timestamp</span>';
            return;
        }

        const filePath = this.currentMediaForExport ? (this.currentMediaForExport.filePath || '') : '';

        // If local file and FFmpeg is available via vidampAPI
        if (window.vidampAPI && window.vidampAPI.exportClipFFmpeg && filePath) {
            if (exportBtn) exportBtn.disabled = true;
            if (statusEl) {
                statusEl.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px; color: var(--accent-cyan); font-size: 12px; margin-top: 6px;">
                        <div class="spinner"></div>
                        <span>Exporting high-quality ${format.toUpperCase()} segment with FFmpeg...</span>
                    </div>
                `;
            }

            try {
                const res = await window.vidampAPI.exportClipFFmpeg({
                    filePath,
                    startTime,
                    endTime,
                    format,
                    resolution,
                    fps
                });

                if (res && res.success) {
                    if (statusEl) {
                        statusEl.innerHTML = `
                            <div style="color: var(--accent-emerald); font-size: 12px; margin-top: 8px; display: flex; flex-direction: column; gap: 6px;">
                                <span>✓ Successfully saved: ${res.targetPath.split(/[/\\]/).pop()}</span>
                                <div style="display: flex; gap: 8px;">
                                    <button class="sp-pill" type="button" onclick="window.vidampAPI.showItemInFolder('${res.targetPath.replace(/\\/g, '\\\\')}')">📂 Open in Folder</button>
                                </div>
                            </div>
                        `;
                    }
                    if (this.onToast) this.onToast(`✂️ Exported ${format.toUpperCase()}: ${res.targetPath.split(/[/\\]/).pop()}`);
                } else if (res && res.canceled) {
                    if (statusEl) statusEl.innerHTML = '<span style="color:var(--text-muted)">Export canceled.</span>';
                } else {
                    if (statusEl) statusEl.innerHTML = `<span style="color:var(--accent-rose)">Export error: ${res ? res.error : 'Unknown'}</span>`;
                }
            } catch (err) {
                console.error('Clip export error:', err);
                if (statusEl) statusEl.innerHTML = `<span style="color:var(--accent-rose)">Export failed: ${err.message}</span>`;
            } finally {
                if (exportBtn) exportBtn.disabled = false;
            }
        } else {
            // Client-side fallback via MediaRecorder
            this.loopA = startTime;
            this.loopB = endTime;
            this.startClipExport();
            const modal = document.getElementById('clip-export-modal');
            if (modal) modal.classList.remove('open');
        }
    }

    startClipExport() {
        if (!this.video || this.loopA === null || this.loopB === null || this.loopA >= this.loopB) {
            if (this.onToast) this.onToast('⚠️ Please set Loop Point A and Point B first');
            return;
        }

        try {
            const stream = this.video.captureStream ? this.video.captureStream(60) : null;
            if (!stream) {
                if (this.onToast) this.onToast('❌ captureStream not supported for this media');
                return;
            }

            this.recordedChunks = [];
            this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9,opus' });

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    this.recordedChunks.push(e.data);
                }
            };

            this.mediaRecorder.onstop = async () => {
                const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
                const reader = new FileReader();
                reader.onload = async () => {
                    const base64Data = reader.result;
                    const defaultName = `VidAmp_Clip_${Math.floor(this.loopA)}s-${Math.floor(this.loopB)}s.webm`;

                    if (window.vidampAPI) {
                        const savedPath = await window.vidampAPI.saveClip({ base64Data, defaultName });
                        if (savedPath && this.onToast) this.onToast(`🎬 Exported Clip: ${savedPath}`);
                    } else {
                        const a = document.createElement('a');
                        a.href = URL.createObjectURL(blob);
                        a.download = defaultName;
                        a.click();
                        if (this.onToast) this.onToast('🎬 Clip download initiated');
                    }
                };
                reader.readAsDataURL(blob);
                this.isExportingClip = false;
            };

            this.isExportingClip = true;
            this.video.currentTime = this.loopA;
            this.video.play().then(() => {
                this.mediaRecorder.start();
                if (this.onToast) this.onToast('🔴 Recording Loop Clip...');
            }).catch(() => {});
        } catch (err) {
            console.error('Clip export error:', err);
            if (this.onToast) this.onToast('❌ Failed to start clip export');
            this.isExportingClip = false;
        }
    }

    stopClipExport() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
    }

    // Frame Capture / Screenshot
    async captureScreenshot(currentFileName = 'VidAmp') {
        if (!this.video || !this.video.videoWidth) {
            if (this.onToast) this.onToast('❌ No active video frame to capture');
            return;
        }

        try {
            const canvas = document.createElement('canvas');
            canvas.width = this.video.videoWidth;
            canvas.height = this.video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);

            const base64Data = canvas.toDataURL('image/png');
            const cleanName = currentFileName.replace(/\.[^/.]+$/, '');
            const defaultName = `${cleanName}_${Math.floor(this.video.currentTime)}s.png`;

            if (window.vidampAPI) {
                const savedPath = await window.vidampAPI.saveScreenshot({ base64Data, defaultName });
                if (savedPath && this.onToast) this.onToast(`📸 Saved: ${savedPath}`);
            } else {
                const a = document.createElement('a');
                a.href = base64Data;
                a.download = defaultName;
                a.click();
                if (this.onToast) this.onToast('📸 Frame screenshot captured');
            }
        } catch (err) {
            console.error('Screenshot error:', err);
            if (this.onToast) this.onToast('❌ Frame capture failed');
        }
    }

    // Timestamp Bookmarks
    addBookmark() {
        if (!this.video) return;
        const time = this.video.currentTime;
        this.bookmarks.push({ time, label: `Bookmark at ${this.formatTime(time)}` });
        this.bookmarks.sort((a, b) => a.time - b.time);
        this.renderBookmarksList();
        if (this.onToast) this.onToast(`📌 Bookmark Added: ${this.formatTime(time)}`);
    }

    renderBookmarksList() {
        const container = document.getElementById('bookmark-list-container');
        if (!container) return;

        if (!this.bookmarks.length) {
            container.innerHTML = `<div style="color:var(--text-muted);font-size:11px;text-align:center;padding:8px 0;">No bookmarks saved</div>`;
            return;
        }

        container.innerHTML = this.bookmarks.map((bm, idx) => `
            <div class="bm-item">
                <span class="bm-time" onclick="window.VidAmpTools.seekToBookmark(${bm.time})">⏱️ ${this.formatTime(bm.time)}</span>
                <button class="bm-del" onclick="window.VidAmpTools.removeBookmark(${idx})">×</button>
            </div>
        `).join('');
    }

    seekToBookmark(time) {
        if (!this.video) return;
        this.video.currentTime = time;
        if (this.onToast) this.onToast(`📌 Jumped to ${this.formatTime(time)}`);
        const pop = document.getElementById('bookmark-popover');
        if (pop) pop.classList.remove('visible');
    }

    removeBookmark(index) {
        this.bookmarks.splice(index, 1);
        this.renderBookmarksList();
    }

    // Sleep Timer
    cycleSleepTimer() {
        this.sleepIndex = (this.sleepIndex + 1) % this.sleepOptions.length;
        const mins = this.sleepOptions[this.sleepIndex];

        if (this.sleepTimerId) {
            clearTimeout(this.sleepTimerId);
            this.sleepTimerId = null;
        }

        if (mins === 0) {
            if (this.onToast) this.onToast('🌙 Sleep Timer: OFF');
        } else if (mins === -1) {
            if (this.onToast) this.onToast('🌙 Sleep Timer: At End of Video');
        } else {
            if (this.onToast) this.onToast(`🌙 Sleep Timer: ${mins} minutes`);
            this.sleepTimerId = setTimeout(() => {
                this.executeSleepFade();
            }, mins * 60 * 1000);
        }

        const btn = document.getElementById('tb-sleep');
        const badge = document.getElementById('tb-sleep-badge');
        if (btn) btn.classList.toggle('active', this.sleepOptions[this.sleepIndex] !== 0);
        if (badge) {
            if (mins === 0) {
                badge.style.display = 'none';
            } else if (mins === -1) {
                badge.textContent = 'END';
                badge.style.display = 'block';
            } else {
                badge.textContent = `${mins}m`;
                badge.style.display = 'block';
            }
        }
    }

    executeSleepFade() {
        if (this.onToast) this.onToast('🌙 Sleep Timer: Pausing Playback');
        let currentVol = this.video.volume;
        const fadeInterval = setInterval(() => {
            currentVol = Math.max(0, currentVol - 0.1);
            this.video.volume = currentVol;
            if (currentVol <= 0.05) {
                clearInterval(fadeInterval);
                this.video.pause();
                this.video.volume = 1.0;
                this.sleepIndex = 0;
                const btn = document.getElementById('tb-sleep');
                if (btn) btn.classList.remove('active');
                const badge = document.getElementById('tb-sleep-badge');
                if (badge) badge.style.display = 'none';
            }
        }, 200);
    }
}
