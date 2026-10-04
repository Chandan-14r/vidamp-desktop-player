/* =========================================================
   VidAmp Player — VLC & MPC-HC Subtitle Engine
   - Parses .srt, .vtt, .ass text subtitle tracks
   - Subtitle Delay / Sync Adjustment (VLC G/H keys ±50ms)
   - Real-time cue renderer overlay with custom styling
   ========================================================= */

export class SubtitleEngine {
    constructor() {
        this.video = null;
        this.overlayEl = null;
        this.cues = [];
        this.activeCue = null;
        this.subtitleDelayMs = 0; // -5000ms to +5000ms
        this.enabled = true;
        this.fontSize = 24;
    }

    init(videoEl, overlayEl) {
        this.video = videoEl;
        this.overlayEl = overlayEl;

        this.video.addEventListener('timeupdate', () => {
            this.update();
        });
    }

    parseSubtitles(rawContent) {
        if (!rawContent) return [];
        // Clean BOM and standardize line endings
        const content = rawContent.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = content.split('\n');
        const cues = [];

        const parseTime = (timeStr) => {
            if (!timeStr) return 0;
            const clean = timeStr.trim().replace(',', '.');
            const parts = clean.split(':');
            if (parts.length === 3) {
                return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
            } else if (parts.length === 2) {
                return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
            }
            return parseFloat(clean) || 0;
        };

        // Check if ASS / SSA format
        const isAss = content.includes('[Events]') || lines.some(l => l.startsWith('Dialogue:'));

        if (isAss) {
            for (const rawLine of lines) {
                const line = rawLine.trim();
                if (line.startsWith('Dialogue:')) {
                    const payload = line.substring(9).trim();
                    const parts = payload.split(',');
                    if (parts.length >= 9) {
                        const start = parseTime(parts[1]);
                        const end = parseTime(parts[2]);
                        let text = parts.slice(9).join(',');
                        // Clean ASS styling tags like {\an8}, {\i1}, \N, etc.
                        text = text.replace(/\{[^}]+\}/g, '').replace(/\\N/gi, '\n').replace(/\\n/gi, '\n').trim();
                        if (text && end > start) {
                            cues.push({ start, end, text });
                        }
                    }
                }
            }
            cues.sort((a, b) => a.start - b.start);
            return cues;
        }

        // Standard SRT / VTT parser
        let i = 0;
        while (i < lines.length) {
            const line = lines[i].trim();
            if (line.includes('-->')) {
                const times = line.split('-->');
                const startStr = times[0].trim();
                const endStr = times[1].trim().split(/\s+/)[0];
                const start = parseTime(startStr);
                const end = parseTime(endStr);

                i++;
                let text = '';
                while (i < lines.length && lines[i].trim() !== '') {
                    let lineText = lines[i].trim();
                    lineText = lineText.replace(/<v[^>]*>/gi, '').replace(/<\/v>/gi, '');
                    text += (text ? '\n' : '') + lineText;
                    i++;
                }

                if (text && end > start) {
                    cues.push({ start, end, text });
                }
            }
            i++;
        }

        cues.sort((a, b) => a.start - b.start);
        return cues;
    }

    loadSubtitleText(content, fileName, onToast) {
        try {
            this.cues = this.parseSubtitles(content);
            this.enabled = true;
            if (onToast) onToast(`💬 Loaded Subtitles: ${fileName} (${this.cues.length} cues)`);
        } catch (err) {
            console.error('Subtitle parse error:', err);
            if (onToast) onToast('❌ Failed to parse subtitle file');
        }
    }

    update() {
        if (!this.enabled || !this.video || !this.overlayEl || !this.cues.length) {
            if (this.overlayEl) this.overlayEl.classList.remove('visible');
            return;
        }

        // Apply delay offset (delay in seconds)
        const curTime = this.video.currentTime - (this.subtitleDelayMs / 1000);
        const match = this.cues.find(c => curTime >= c.start && curTime <= c.end);

        if (match) {
            this.overlayEl.innerHTML = match.text.replace(/\n/g, '<br>');
            this.overlayEl.style.fontSize = `${this.fontSize}px`;
            this.overlayEl.classList.add('visible');
        } else {
            this.overlayEl.classList.remove('visible');
        }
    }

    adjustDelay(deltaMs, onToast) {
        this.subtitleDelayMs = Math.max(-10000, Math.min(10000, this.subtitleDelayMs + deltaMs));
        if (onToast) {
            const sign = this.subtitleDelayMs > 0 ? `+${this.subtitleDelayMs}` : `${this.subtitleDelayMs}`;
            onToast(`💬 Subtitle Delay: ${sign} ms`);
        }
        this.update();
        return this.subtitleDelayMs;
    }

    toggleSubtitles(onToast) {
        this.enabled = !this.enabled;
        if (!this.enabled && this.overlayEl) {
            this.overlayEl.classList.remove('visible');
        }
        if (onToast) onToast(this.enabled ? '💬 Subtitles: ON' : '💬 Subtitles: OFF');
        return this.enabled;
    }

    setFontSize(size) {
        this.fontSize = Math.max(14, Math.min(42, size));
        if (this.overlayEl) this.overlayEl.style.fontSize = `${this.fontSize}px`;
    }

    cleanTitle(rawName) {
        if (!rawName) return '';
        let name = rawName.replace(/\.[^/.]+$/, ''); // remove extension
        name = name.replace(/\[[^\]]*\]|\([^\)]*\)/g, ' ');
        name = name.replace(/\b(1080p|720p|480p|2160p|4k|uhd|bluray|blu-ray|web-dl|webrip|hdrip|dvdrip|x264|x265|hevc|h264|h265|aac|dts|ac3|atmos|truehd|10bit|remux|yts|yify|rarbg|psa|eztv|galaxytv)\b/gi, ' ');
        name = name.replace(/[._\-]/g, ' ');
        name = name.replace(/\s+/g, ' ').trim();
        return name;
    }

    openAutoFetchModal(currentMedia, onToast) {
        const modal = document.getElementById('subtitles-search-modal');
        const queryInput = document.getElementById('sub-search-query-input');
        const langSelect = document.getElementById('sub-search-lang-select');
        const container = document.getElementById('sub-search-results');

        if (!modal) return;

        let detectedName = '';
        if (currentMedia) {
            detectedName = currentMedia.fileName || (currentMedia.filePath ? currentMedia.filePath.split(/[/\\]/).pop() : '');
            this.currentFileName = detectedName;
            this.currentFilePath = currentMedia.filePath || '';
        }

        const cleaned = this.cleanTitle(detectedName);
        if (queryInput) {
            queryInput.value = cleaned || detectedName || '';
        }

        modal.classList.add('open');
        if (container) {
            container.innerHTML = '<div class="sub-loading-state">Type a title or click Search to find matching subtitles on OpenSubtitles...</div>';
        }

        if (cleaned && cleaned.length >= 2) {
            this.searchOnline(cleaned, (langSelect ? langSelect.value : 'all'), onToast);
        }
    }

    async searchOnline(query, lang = 'all', onToast) {
        const container = document.getElementById('sub-search-results');
        if (!container) return;

        if (!query || query.trim().length < 2) {
            container.innerHTML = '<div class="sub-loading-state">Please enter a video or movie title to search.</div>';
            return;
        }

        container.innerHTML = `
            <div class="sub-loading-state">
                <div class="spinner"></div>
                <span>Searching OpenSubtitles for "${query}"...</span>
            </div>
        `;

        try {
            let results = [];
            if (window.vidampAPI && window.vidampAPI.searchOnlineSubtitles) {
                results = await window.vidampAPI.searchOnlineSubtitles(query, lang);
            }

            if (!results || results.length === 0) {
                container.innerHTML = `
                    <div class="sub-empty-state">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <span style="font-weight: 600; font-size: 13px;">No subtitles found for "${query}"</span>
                        <span style="font-size: 11px; opacity: 0.7;">Try searching with a shorter title (e.g. movie name and release year only) or selecting "All Languages".</span>
                    </div>
                `;
                return;
            }

            container.innerHTML = '';
            results.forEach((item) => {
                const card = document.createElement('div');
                card.className = 'sub-result-card';
                card.innerHTML = `
                    <div class="sub-card-left">
                        <div class="sub-card-title">${item.movieName || item.subFileName} ${item.movieYear ? `(${item.movieYear})` : ''}</div>
                        <div class="sub-card-filename" title="${item.subFileName}">${item.subFileName}</div>
                        <div class="sub-card-badges">
                            <span class="sub-badge-lang">${item.langName || 'Unknown'}</span>
                            <span class="sub-badge-format">${(item.format || 'SRT').toUpperCase()}</span>
                            <span class="sub-badge-meta">★ ${item.rating || '0.0'}</span>
                            <span class="sub-badge-meta">⬇ ${Number(item.downloads).toLocaleString()}</span>
                        </div>
                    </div>
                    <div class="sub-card-right">
                        <button class="btn-primary sub-btn-download">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            Apply Subtitle
                        </button>
                    </div>
                `;

                const btn = card.querySelector('.sub-btn-download');
                btn.addEventListener('click', () => {
                    btn.disabled = true;
                    btn.textContent = 'Applying...';
                    this.downloadAndApply(item, onToast);
                });

                container.appendChild(card);
            });
        } catch (err) {
            console.error('Online subtitle search error:', err);
            container.innerHTML = `<div class="sub-loading-state" style="color:var(--accent-rose)">Failed to search OpenSubtitles: ${err.message || 'Network error'}</div>`;
        }
    }

    async downloadAndApply(item, onToast) {
        if (!window.vidampAPI || !window.vidampAPI.downloadOnlineSubtitle) {
            if (onToast) onToast('❌ Subtitle downloader unavailable in this environment');
            return;
        }

        try {
            if (onToast) onToast(`⏳ Fetching & applying subtitle: ${item.subFileName}...`);
            const res = await window.vidampAPI.downloadOnlineSubtitle({
                downloadUrl: item.downloadUrl,
                fileName: item.subFileName,
                videoPath: this.currentFilePath
            });

            if (res && res.success && res.content) {
                this.loadSubtitleText(res.content, res.fileName, onToast);
                const modal = document.getElementById('subtitles-search-modal');
                if (modal) modal.classList.remove('open');
                if (onToast) onToast(`💬 Subtitles Active: ${item.movieName || item.subFileName} (${item.langName})`);
            } else {
                if (onToast) onToast(`❌ Failed to download subtitle: ${res.error || 'Unknown error'}`);
            }
        } catch (err) {
            console.error('Download subtitle error:', err);
            if (onToast) onToast(`❌ Error: ${err.message || 'Download failed'}`);
        }
    }
}
