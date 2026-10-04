/* =========================================================
   VidAmp Player — Playlist & Queue Manager
   - Track queue, shuffle, loop one / loop all
   - Export playlist (.m3u / .json)
   - Recent history memory
   - Drag & drop reordering
   ========================================================= */

export class PlaylistManager {
    constructor() {
        this.items = [];
        this.currentIndex = -1;
        this.repeatMode = 'all'; // 'off', 'all', 'one'
        this.shuffle = false;
        this.containerEl = null;

        this.STORAGE_KEY = 'vidamp_recents_v2';
        this.loadRecents();
    }

    init(containerEl) {
        this.containerEl = containerEl;
        this.render();
    }

    addFiles(fileList, playImmediately = false) {
        if (!fileList || !fileList.length) return;

        let targetIndex = -1;
        fileList.forEach((file, idx) => {
            const existingIdx = this.items.findIndex(i => 
                (i.filePath && file.filePath && i.filePath.toLowerCase() === file.filePath.toLowerCase()) ||
                (i.fileUrl && file.fileUrl && i.fileUrl === file.fileUrl)
            );

            if (existingIdx !== -1) {
                // Update with newest details and track index
                this.items[existingIdx] = file;
                this.addToRecents(file);
                if (idx === 0) targetIndex = existingIdx;
            } else {
                this.items.push(file);
                this.addToRecents(file);
                if (idx === 0) targetIndex = this.items.length - 1;
            }
        });

        this.render();

        if (playImmediately || this.currentIndex === -1) {
            if (targetIndex !== -1) {
                this.playIndex(targetIndex);
            } else if (this.items.length > 0) {
                this.playIndex(0);
            }
        }
    }

    playIndex(index) {
        if (index < 0 || index >= this.items.length) return;
        this.currentIndex = index;
        const item = this.items[index];
        if (window.VidAmpApp) {
            window.VidAmpApp.loadMedia(item);
        }
        this.render();
    }

    playNext() {
        if (!this.items.length) return;
        if (this.repeatMode === 'one') {
            if (window.VidAmpApp) {
                window.VidAmpApp.seek(0);
                window.VidAmpApp.play();
            }
            return;
        }

        let nextIdx;
        if (this.shuffle && this.items.length > 1) {
            do {
                nextIdx = Math.floor(Math.random() * this.items.length);
            } while (nextIdx === this.currentIndex);
        } else {
            nextIdx = this.currentIndex + 1;
            if (nextIdx >= this.items.length) {
                if (this.repeatMode === 'all') nextIdx = 0;
                else return; // Reached end
            }
        }

        this.playIndex(nextIdx);
    }

    playPrevious() {
        if (!this.items.length) return;
        let prevIdx = this.currentIndex - 1;
        if (prevIdx < 0) {
            if (this.repeatMode === 'all') prevIdx = this.items.length - 1;
            else return;
        }
        this.playIndex(prevIdx);
    }

    removeItem(index, e) {
        if (e) e.stopPropagation();
        if (index < 0 || index >= this.items.length) return;

        this.items.splice(index, 1);
        if (this.currentIndex === index) {
            if (this.items.length > 0) {
                this.playIndex(Math.min(index, this.items.length - 1));
            } else {
                this.currentIndex = -1;
                if (window.VidAmpApp) window.VidAmpApp.unloadMedia();
            }
        } else if (this.currentIndex > index) {
            this.currentIndex--;
        }

        this.render();
    }

    clearPlaylist() {
        this.items = [];
        this.currentIndex = -1;
        if (window.VidAmpApp) window.VidAmpApp.unloadMedia();
        this.render();
    }

    exportM3U() {
        if (!this.items.length) return;
        let content = '#EXTM3U\n';
        this.items.forEach(item => {
            content += `#EXTINF:-1,${item.fileName}\n${item.filePath || item.fileUrl}\n`;
        });

        const blob = new Blob([content], { type: 'audio/x-mpegurl' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `VidAmp_Playlist_${Date.now()}.m3u`;
        a.click();
    }

    addToRecents(item) {
        try {
            let recents = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
            recents = recents.filter(r => r.filePath !== item.filePath);
            recents.unshift({
                filePath: item.filePath,
                fileName: item.fileName,
                fileUrl: item.fileUrl,
                isNetworkStream: !!item.isNetworkStream,
                playedAt: Date.now()
            });
            if (recents.length > 30) recents = recents.slice(0, 30);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(recents));
        } catch (_) {}
    }

    loadRecents() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw) {
                const recents = JSON.parse(raw);
                if (recents && recents.length) {
                    this.items = recents.slice(0, 10);
                }
            }
        } catch (_) {}
    }

    render() {
        if (!this.containerEl) return;
        if (!this.items.length) {
            this.containerEl.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); font-size: 12px; padding: 24px 0;">
                    Playlist is empty.<br>Drag & drop videos here or click Open File.
                </div>
            `;
            return;
        }

        this.containerEl.innerHTML = this.items.map((item, idx) => {
            const isActive = idx === this.currentIndex;
            const isStream = item.isNetworkStream || (item.fileUrl && (item.fileUrl.startsWith('http://') || item.fileUrl.startsWith('https://')));
            const badge = isStream ? `<span class="badge" style="margin-right: 4px; font-size: 9px; padding: 1px 5px; background: rgba(0,240,255,0.15); color: var(--accent-cyan); border: 1px solid rgba(0,240,255,0.4);">LIVE</span>` : '';
            return `
                <div class="playlist-item ${isActive ? 'active' : ''}" onclick="window.VidAmpPlaylist.playIndex(${idx})">
                    <span class="playlist-item-index">${idx + 1}</span>
                    <div class="playlist-item-info">
                        <div class="playlist-item-title" title="${item.fileName}">${badge}${item.fileName}</div>
                        <div class="playlist-item-meta">${item.filePath || item.fileUrl}</div>
                    </div>
                    <button class="playlist-item-remove" title="Remove from list" onclick="window.VidAmpPlaylist.removeItem(${idx}, event)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            `;
        }).join('');
    }
}
