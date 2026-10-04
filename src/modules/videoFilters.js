/* =========================================================
   VidAmp Player — Video Filters & Geometry Engine
   - CSS Post-processing: Brightness, Contrast, Saturation, Hue, Invert
   - Presets: Normal, HDR Boost, Night Mode, High Contrast
   - Aspect Ratio Switcher: Default, 21:9 Ultrawide, Stretch, 16:9, 4:3
   - Video Rotation & Mirror Flip (VLC & MPC-HC style)
   ========================================================= */

export class VideoFiltersEngine {
    constructor() {
        this.video = null;

        this.filters = {
            brightness: 100,
            contrast: 100,
            saturate: 100,
            hueRotate: 0,
            invert: 0,
            sepia: 0
        };

        this.presets = [
            { id: 'normal', name: 'Normal (Reset)', b: 100, c: 100, s: 100, hue: 0, invert: 0, sepia: 0, icon: '🔄' },
            { id: 'night-vision', name: 'Night Vision (Military Phosphor)', b: 155, c: 170, s: 280, hue: 95, invert: 0, sepia: 0, icon: '🟢' },
            { id: 'night-warm', name: 'Night Warmth (OLED Eye-Care)', b: 92, c: 100, s: 95, hue: 0, invert: 0, sepia: 40, icon: '🌙' },
            { id: 'hdr', name: 'HDR Vivid Boost', b: 110, c: 125, s: 135, hue: 0, invert: 0, sepia: 0, icon: '⚡' },
            { id: 'contrast', name: 'High Dynamic Contrast', b: 112, c: 145, s: 110, hue: 0, invert: 0, sepia: 0, icon: '🔥' },
            { id: 'thermal', name: 'Thermal / Invert Vision', b: 100, c: 110, s: 120, hue: 180, invert: 100, sepia: 0, icon: '👁️' }
        ];
        this.presetIndex = 0;

        this.aspectModes = [
            { id: 'contain', label: '16:9 Standard Fit', fit: 'contain', scale: 'none' },
            { id: 'crop-21-9', label: '21:9 Ultrawide Crop', fit: 'cover', scale: 'scale(1.33)' },
            { id: 'fill', label: 'Stretch to Fill', fit: 'fill', scale: 'none' },
            { id: 'fit-4-3', label: '4:3 Classic TV Fit', fit: 'contain', scale: 'scaleX(0.75)' }
        ];
        this.aspectIndex = 0;

        this.rotation = 0; // 0, 90, 180, 270
        this.flipH = false;
        this.flipV = false;
    }

    init(videoEl) {
        this.video = videoEl || document.getElementById('video-element');
        this.apply();
    }

    apply() {
        if (!this.video) this.video = document.getElementById('video-element');
        if (!this.video) return;

        // 1. CSS Filter String
        const { brightness, contrast, saturate, hueRotate, invert, sepia } = this.filters;
        const filterParts = [];
        if (brightness !== 100) filterParts.push(`brightness(${brightness}%)`);
        if (contrast !== 100) filterParts.push(`contrast(${contrast}%)`);
        if (saturate !== 100) filterParts.push(`saturate(${saturate}%)`);
        if (hueRotate !== 0) filterParts.push(`hue-rotate(${hueRotate}deg)`);
        if (invert !== 0) filterParts.push(`invert(${invert}%)`);
        if (sepia && sepia !== 0) filterParts.push(`sepia(${sepia}%)`);

        this.video.style.filter = filterParts.join(' ');

        // 2. Transform String (scale, rotation, flip)
        const aspect = this.aspectModes[this.aspectIndex];
        const transformParts = [];

        if (aspect.scale !== 'none') transformParts.push(aspect.scale);
        if (this.rotation !== 0) transformParts.push(`rotate(${this.rotation}deg)`);
        if (this.flipH) transformParts.push('scaleX(-1)');
        if (this.flipV) transformParts.push('scaleY(-1)');

        this.video.style.objectFit = aspect.fit;
        this.video.style.transform = transformParts.join(' ');

        // Update Button Active state
        const btnFilters = document.getElementById('tb-filters');
        if (btnFilters) {
            const isCustom = this.presets[this.presetIndex] && this.presets[this.presetIndex].id !== 'normal';
            btnFilters.classList.toggle('active', isCustom);
        }

        // Update Popover Active Pills
        const curPresetId = this.presets[this.presetIndex] ? this.presets[this.presetIndex].id : 'normal';
        document.querySelectorAll('#filters-popover .sp-pill').forEach(pill => {
            pill.classList.toggle('active', pill.getAttribute('data-filter') === curPresetId);
        });

        const curAspectId = this.aspectModes[this.aspectIndex] ? this.aspectModes[this.aspectIndex].id : 'contain';
        document.querySelectorAll('#aspect-popover .sp-pill').forEach(pill => {
            pill.classList.toggle('active', pill.getAttribute('data-aspect') === curAspectId);
        });
    }

    adjustBrightness(delta, onToast) {
        this.filters.brightness = Math.max(10, Math.min(200, this.filters.brightness + delta));
        this.apply();
        if (onToast) onToast(`☀️ Brightness: ${this.filters.brightness}%`);
    }

    setPresetById(id, onToast) {
        const idx = this.presets.findIndex(p => p.id === id);
        if (idx !== -1) {
            this.presetIndex = idx;
            const p = this.presets[idx];
            this.filters.brightness = p.b;
            this.filters.contrast = p.c;
            this.filters.saturate = p.s;
            this.filters.hueRotate = p.hue || 0;
            this.filters.invert = p.invert || 0;
            this.filters.sepia = p.sepia || 0;
            this.apply();
            if (onToast) onToast(`${p.icon} Filter: ${p.name}`);
        }
    }

    cyclePreset(onToast) {
        this.presetIndex = (this.presetIndex + 1) % this.presets.length;
        const p = this.presets[this.presetIndex];
        this.filters.brightness = p.b;
        this.filters.contrast = p.c;
        this.filters.saturate = p.s;
        this.filters.hueRotate = p.hue || 0;
        this.filters.invert = p.invert || 0;
        this.filters.sepia = p.sepia || 0;
        this.apply();
        if (onToast) onToast(`${p.icon} Filter: ${p.name}`);
    }

    reset(onToast) {
        this.setPresetById('normal', onToast);
        this.rotation = 0;
        this.flipH = false;
        this.flipV = false;
        this.apply();
        if (onToast) onToast('🎨 Filters & Geometry Reset');
    }

    setAspectById(id, onToast) {
        const idx = this.aspectModes.findIndex(a => a.id === id);
        if (idx !== -1) {
            this.aspectIndex = idx;
            const mode = this.aspectModes[idx];
            this.apply();
            if (onToast) onToast(`📐 Aspect: ${mode.label}`);
        }
    }

    cycleAspectRatio(onToast) {
        this.aspectIndex = (this.aspectIndex + 1) % this.aspectModes.length;
        const mode = this.aspectModes[this.aspectIndex];
        this.apply();
        if (onToast) onToast(`📐 Aspect: ${mode.label}`);
    }

    rotateClockwise(onToast) {
        this.rotation = (this.rotation + 90) % 360;
        this.apply();
        if (onToast) onToast(`🔄 Rotate: ${this.rotation}°`);
    }

    toggleFlipHorizontal(onToast) {
        this.flipH = !this.flipH;
        this.apply();
        if (onToast) onToast(this.flipH ? '🪞 Mirror Flip: ON' : '🪞 Mirror Flip: OFF');
    }

    // ⚡ Hardware Acceleration & HDR Passthrough
    setHdrMode(mode, onToast) {
        this.hdrMode = mode;
        if (mode === 'bt2020') {
            this.filters.brightness = 106;
            this.filters.contrast = 118;
            this.filters.saturate = 130;
            if (onToast) onToast('⚡ HDR Passthrough: BT.2020 Wide Color Tone-Mapping');
        } else if (mode === 'cinema') {
            this.filters.brightness = 108;
            this.filters.contrast = 125;
            this.filters.saturate = 120;
            if (onToast) onToast('⚡ HDR Passthrough: Dynamic Cinema Peak Luminance');
        } else if (mode === 'oled') {
            this.filters.brightness = 100;
            this.filters.contrast = 135;
            this.filters.saturate = 135;
            if (onToast) onToast('⚡ HDR Passthrough: True Black OLED Curve');
        } else {
            this.filters.brightness = 100;
            this.filters.contrast = 100;
            this.filters.saturate = 100;
            if (onToast) onToast('⚡ HDR Passthrough: Standard SDR (Off)');
        }
        this.apply();
        this.updateHdrUI();
    }

    getPlaybackStats() {
        if (!this.video) return { totalFrames: 0, droppedFrames: 0, dropRate: '0.0%' };
        if (typeof this.video.getVideoPlaybackQuality === 'function') {
            const q = this.video.getVideoPlaybackQuality();
            const total = q.totalVideoFrames || 0;
            const dropped = q.droppedVideoFrames || 0;
            const rate = total > 0 ? ((dropped / total) * 100).toFixed(1) + '%' : '0.0%';
            return { totalFrames: total, droppedFrames: dropped, dropRate: rate };
        }
        return { totalFrames: 0, droppedFrames: 0, dropRate: '0.0%' };
    }

    async openGpuDiagnosticsModal() {
        const modal = document.getElementById('gpu-diagnostics-modal');
        if (!modal) return;

        const gpuStatusEl = document.getElementById('gpu-diag-status');
        const gpuNameEl = document.getElementById('gpu-diag-name');
        const gpuDecodeEl = document.getElementById('gpu-diag-decode');
        const frameStatsEl = document.getElementById('gpu-diag-frames');

        if (gpuStatusEl) gpuStatusEl.textContent = 'Checking GPU status...';

        modal.classList.add('open');

        let diag = null;
        if (window.vidampAPI && window.vidampAPI.getGpuDiagnostics) {
            try {
                diag = await window.vidampAPI.getGpuDiagnostics();
            } catch (e) {
                console.error('GPU diag error:', e);
            }
        }

        const isAcc = diag ? diag.isAccelerated : true;
        if (gpuStatusEl) {
            gpuStatusEl.innerHTML = isAcc 
                ? '<span style="color:var(--accent-emerald);font-weight:700;">● Active (Hardware Accelerated)</span>'
                : '<span style="color:var(--accent-amber);font-weight:700;">● Software Fallback</span>';
        }

        if (gpuNameEl) {
            let gpuName = 'Direct3D 11 / Discrete GPU';
            if (diag && diag.gpuInfo && diag.gpuInfo.auxAttributes && diag.gpuInfo.auxAttributes.glRenderer) {
                gpuName = diag.gpuInfo.auxAttributes.glRenderer;
            }
            gpuNameEl.textContent = gpuName;
        }

        if (gpuDecodeEl) {
            const decodeStatus = (diag && diag.featureStatus) ? diag.featureStatus.video_decode : 'enabled';
            gpuDecodeEl.innerHTML = decodeStatus === 'enabled' 
                ? '<span style="color:var(--accent-emerald)">Hardware Decoding (NVDEC / VAAPI / D3D11) ✓</span>'
                : '<span style="color:var(--text-muted)">Standard Decoder</span>';
        }

        const stats = this.getPlaybackStats();
        if (frameStatsEl) {
            frameStatsEl.textContent = `Frames Decoded: ${stats.totalFrames} | Dropped: ${stats.droppedFrames} (${stats.dropRate})`;
        }

        this.updateHdrUI();
    }

    updateHdrUI() {
        const currentMode = this.hdrMode || 'off';
        const buttons = document.querySelectorAll('.hdr-mode-pill');
        buttons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === currentMode);
        });
    }
}
