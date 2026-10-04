/* =========================================================
   VidAmp Player — MPC-HC Style Media Information & Stats HUD
   - Real-time resolution, framerate, aspect ratio
   - Dropped frames & buffer stats
   - Audio & Subtitle sync offset display
   ========================================================= */

export class MediaInfoHUD {
    constructor() {
        this.video = null;
        this.hudEl = null;
        this.visible = false;
        this.updateInterval = null;
        this.lastTime = 0;
        this.frameCount = 0;
        this.fps = 0;
    }

    init(videoEl, hudEl) {
        this.video = videoEl;
        this.hudEl = hudEl;
    }

    toggle() {
        this.visible = !this.visible;
        if (this.visible) {
            this.hudEl.classList.add('visible');
            this.updateStats();
            this.updateInterval = setInterval(() => this.updateStats(), 800);
        } else {
            this.hudEl.classList.remove('visible');
            clearInterval(this.updateInterval);
        }
        return this.visible;
    }

    updateStats() {
        if (!this.hudEl || !this.video) return;

        const w = this.video.videoWidth || 0;
        const h = this.video.videoHeight || 0;
        const dur = this.video.duration || 0;
        const cur = this.video.currentTime || 0;
        const rate = this.video.playbackRate || 1.0;

        // Dropped frames
        let dropped = 0;
        let totalFrames = 0;
        if (typeof this.video.getVideoPlaybackQuality === 'function') {
            const q = this.video.getVideoPlaybackQuality();
            dropped = q.droppedVideoFrames || 0;
            totalFrames = q.totalVideoFrames || 0;
        }

        // Audio & Subtitle Delays
        const audioDelay = window.VidAmpAudio ? window.VidAmpAudio.audioDelayMs : 0;
        const subDelay = window.VidAmpSubtitles ? window.VidAmpSubtitles.subtitleDelayMs : 0;

        const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
        const div = gcd(w, h);
        const aspectStr = div > 0 ? `${w / div}:${h / div}` : '--:--';

        this.hudEl.innerHTML = `
            <div class="hud-title">⚡ VIDAMP MEDIA STREAM HUD</div>
            <div><strong>Resolution:</strong> ${w} × ${h} (${aspectStr})</div>
            <div><strong>Playback Rate:</strong> ${rate}×</div>
            <div><strong>Timeline:</strong> ${Math.floor(cur)}s / ${Math.floor(dur)}s</div>
            <div><strong>Dropped Frames:</strong> ${dropped} / ${totalFrames}</div>
            <div><strong>Audio Delay (J/K):</strong> ${audioDelay > 0 ? '+' : ''}${audioDelay} ms</div>
            <div><strong>Subtitle Delay (G/H):</strong> ${subDelay > 0 ? '+' : ''}${subDelay} ms</div>
            <div><strong>Renderer:</strong> HTML5 Video Engine + Web Audio API</div>
        `;
    }
}
