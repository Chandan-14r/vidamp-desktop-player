/* =========================================================
   VidAmp Player — Universal Ambient Glow (Dynamic Bias Lighting)
   - 32x18 low-resolution canvas sampler behind video
   - Throttled requestAnimationFrame loop (45ms interval / ~22 fps)
   - GPU-accelerated CSS blur (65px), saturation (2.2), brightness (1.2)
   - Smooth opacity transitions (fade in on play, fade out on pause)
   ========================================================= */

export class AmbientGlowController {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.video = null;
        this.active = true;
        this.rafId = null;
        this.lastDrawTime = 0;
        this.sampleInterval = 45; // ms between frame samples
    }

    init(canvasEl, videoEl) {
        this.canvas = canvasEl;
        this.video = videoEl;
        this.canvas.width = 32;
        this.canvas.height = 18;
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: false });

        this.video.addEventListener('play', () => {
            if (this.active) this.startLoop();
        });

        this.video.addEventListener('pause', () => {
            this.fadeGlow(false);
        });

        this.video.addEventListener('ended', () => {
            this.fadeGlow(false);
        });

        if (this.active && !this.video.paused) {
            this.startLoop();
        }
    }

    startLoop() {
        if (!this.active || !this.video || !this.canvas) return;
        this.canvas.classList.add('active');

        const loop = (now) => {
            if (!this.active) {
                this.fadeGlow(false);
                return;
            }

            if (this.video && !this.video.paused && !this.video.ended && this.video.readyState >= 2) {
                if (now - this.lastDrawTime >= this.sampleInterval) {
                    this.lastDrawTime = now;
                    try {
                        this.ctx.drawImage(this.video, 0, 0, 32, 18);
                    } catch (_) {}
                }
            }

            this.rafId = requestAnimationFrame(loop);
        };

        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = requestAnimationFrame(loop);
    }

    stopLoop() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.fadeGlow(false);
    }

    fadeGlow(show) {
        if (this.canvas) {
            if (show && this.active) {
                this.canvas.classList.add('active');
            } else {
                this.canvas.classList.remove('active');
            }
        }
    }

    toggle(onToast) {
        this.active = !this.active;
        if (this.active) {
            if (!this.video.paused) {
                this.startLoop();
            }
            if (onToast) onToast('🌌 Ambient Glow: ON');
        } else {
            this.stopLoop();
            if (onToast) onToast('🌌 Ambient Glow: OFF');
        }
        return this.active;
    }
}
