/* =========================================================
   VidAmp Player — Network & HLS Stream Player
   - Plays .m3u8 live feeds & VOD using hls.js
   - Handles direct HTTP/HTTPS video streams
   ========================================================= */

import Hls from 'hls.js';

export class StreamEngine {
    constructor() {
        this.hls = null;
        this.video = null;
    }

    init(videoEl) {
        this.video = videoEl;
    }

    isHlsUrl(url) {
        if (!url || typeof url !== 'string') return false;
        return /\.m3u8($|\?)/i.test(url) || url.toLowerCase().includes('.m3u8') || url.includes('/hls/') || url.includes('format=m3u8');
    }

    loadUrl(streamUrl, onToast) {
        this.destroy();

        if (this.isHlsUrl(streamUrl) && Hls.isSupported()) {
            if (this.video) {
                this.video.pause();
                this.video.removeAttribute('src');
                this.video.load();
            }

            this.hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 90
            });
            this.hls.loadSource(streamUrl);
            this.hls.attachMedia(this.video);

            this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
                this.video.play().then(() => {
                    if (window.VidAmpAudio) window.VidAmpAudio.ensureContext(this.video);
                }).catch(() => {});
                if (onToast) onToast('📡 HLS Live Stream Connected');
            });

            this.hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            if (onToast) onToast('⚠️ Network Error: Recovering stream...');
                            this.hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            if (onToast) onToast('⚠️ Media Error: Recovering media...');
                            this.hls.recoverMediaError();
                            break;
                        default:
                            this.destroy();
                            if (onToast) onToast('❌ Fatal Stream Error');
                            break;
                    }
                }
            });
        } else {
            // Direct video URL (.mp4, .webm, or direct HTTP/HTTPS stream)
            this.video.src = streamUrl;
            this.video.load();
            this.video.play().then(() => {
                if (window.VidAmpAudio) window.VidAmpAudio.ensureContext(this.video);
            }).catch((err) => {
                console.warn('Direct stream autoplay catch:', err);
            });
            if (onToast) onToast('▶ Direct Stream Loaded');
        }
    }

    destroy() {
        if (this.hls) {
            try {
                this.hls.detachMedia();
            } catch (_) {}
            this.hls.destroy();
            this.hls = null;
        }
    }
}
