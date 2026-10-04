/* =========================================================
   VidAmp Player — Precision Speed Controller
   - Snap-to-grid stepping on [ and ] ([ snaps 1.4x -> 1.25x -> 1.0x; ] snaps 1.4x -> 1.5x -> 1.75x -> 2.0x)
   - Exponential laptop trackpad two-finger gesture (55px threshold, 0.05x precision)
   - 1-Click speed popover presets (0.5x, 0.75x, 1x, 1.25x, 1.4x, 1.5x, 1.75x, 2x, 2.5x, 3x, 4x)
   - Right-click or 'R' key to reset to 1.0x
   - Temporary hold-to-boost (2.0x while holding, restores previous speed on release)
   - Pitch preservation toggle
   ========================================================= */

export class SpeedController {
    constructor() {
        this.video = null;
        this.currentRate = 1.0;
        this.MIN_SPEED = 0.25;
        this.MAX_SPEED = 4.0;
        this.SPEED_GRID = 0.25;
        this.preservesPitch = true;

        // Gesture state
        this.accumulatedWheelDelta = 0;
        this.wheelIdleTimer = null;
        this.WHEEL_STEP_THRESHOLD = 55;

        // Hold-to-boost state
        this.holdBoostEngaged = false;
        this.holdBoostRestoreRate = 1.0;
        this.holdBoostWasPaused = false;
        this.holdTimer = null;

        this.onSpeedChangeCallbacks = [];
        this.onToastCallback = null;
    }

    init(videoEl, onSpeedChange, onToast) {
        this.video = videoEl;
        this.onSpeedChangeCallbacks.push(onSpeedChange);
        this.onToastCallback = onToast;

        this.setupWheelGesture();
        this.setupHoldBoost();
    }

    formatSpeed(rate) {
        const r = Number(rate);
        if (Math.abs(r - 0.25) < 0.03) return '0.25×';
        if (Math.abs(r - 0.5) < 0.03) return '0.5×';
        if (Math.abs(r - 0.75) < 0.03) return '0.75×';
        if (Math.abs(r - 1.25) < 0.03) return '1.25×';
        if (Math.abs(r - 1.5) < 0.03) return '1.5×';
        if (Math.abs(r - 1.75) < 0.03) return '1.75×';
        const num = Math.round(r * 10) / 10;
        return (num % 1 === 0 ? num.toFixed(0) : num.toFixed(1)) + '×';
    }

    stepDownToGrid(rate, step = this.SPEED_GRID) {
        const cur = Number(rate) || 1.0;
        const epsilon = 1e-4;
        const snapped = Math.floor((cur - epsilon) / step) * step;
        return Number(Math.max(this.MIN_SPEED, Math.round(snapped * 100) / 100).toFixed(2));
    }

    stepUpToGrid(rate, step = this.SPEED_GRID) {
        const cur = Number(rate) || 1.0;
        const epsilon = 1e-4;
        const snapped = Math.ceil((cur + epsilon) / step) * step;
        return Number(Math.min(this.MAX_SPEED, Math.round(snapped * 100) / 100).toFixed(2));
    }

    // Enhancer for YouTube style: standard 0.1x increments up to max 4.0x
    stepNormal(isUp, velocity = 0) {
        const cur = Number(this.currentRate) || 1.0;
        const step = velocity >= 60 ? 0.2 : 0.1;
        let nextRate;

        if (isUp) {
            if (cur < 0.3) {
                nextRate = 0.3;
            } else {
                nextRate = Math.round((cur + step) * 10) / 10;
            }
            nextRate = Math.min(this.MAX_SPEED, nextRate);
        } else {
            if (cur <= 0.35 && cur > 0.25) {
                nextRate = 0.25;
            } else {
                nextRate = Math.round((cur - step) * 10) / 10;
            }
            nextRate = Math.max(this.MIN_SPEED, nextRate);
        }

        this.setPlaybackRate(nextRate, true);
        return nextRate;
    }

    stepExponential(isUp, velocity = 0) {
        return this.stepNormal(isUp, velocity);
    }

    setPlaybackRate(rate, notify = true) {
        if (!this.video) return;
        const targetRate = Math.max(this.MIN_SPEED, Math.min(this.MAX_SPEED, Number(rate)));
        this.currentRate = targetRate;
        this.video.playbackRate = targetRate;
        this.video.preservesPitch = this.preservesPitch;

        if (notify && this.onToastCallback) {
            this.onToastCallback(`⚡ Speed: ${this.formatSpeed(targetRate)}`);
        }

        this.onSpeedChangeCallbacks.forEach(cb => cb(targetRate));
    }

    stepDown() {
        const next = this.stepDownToGrid(this.currentRate);
        this.setPlaybackRate(next, true);
    }

    stepUp() {
        const next = this.stepUpToGrid(this.currentRate);
        this.setPlaybackRate(next, true);
    }

    reset() {
        this.setPlaybackRate(1.0, true);
    }

    togglePitchPreservation(onToast) {
        this.preservesPitch = !this.preservesPitch;
        if (this.video) {
            this.video.preservesPitch = this.preservesPitch;
        }
        if (onToast) {
            onToast(this.preservesPitch ? '🎵 Pitch Preservation: ON' : '🎵 Pitch Preservation: OFF');
        }
        return this.preservesPitch;
    }

    setupWheelGesture() {
        const viewport = document.getElementById('video-stage');
        const speedBtn = document.getElementById('tb-speed');

        // Allow wheel on the Speed button directly to adjust speed (Enhancer for YouTube style)
        if (speedBtn) {
            speedBtn.addEventListener('wheel', e => {
                e.preventDefault();
                e.stopPropagation();
                const isUp = e.deltaY < 0;
                const velocity = Math.abs(e.deltaY);
                this.stepNormal(isUp, velocity);
            }, { passive: false });
        }

        if (!viewport) return;

        // Calibrated thresholds for trackpad and mouse wheel gestures
        const VOLUME_THRESHOLD = 14;
        let accumulatedVolumeDelta = 0;
        let volumeIdleTimer = null;

        const SPEED_THRESHOLD = 20; // Crisp, responsive 0.1x steps just like Enhancer for YouTube
        let accumulatedSpeedDelta = 0;
        let speedIdleTimer = null;

        viewport.addEventListener('wheel', e => {
            if (e.target.closest('.drawer') || e.target.closest('#speed-popover') || e.target.closest('#bookmark-popover') || e.target.closest('.modal-backdrop')) {
                return;
            }

            e.preventDefault();

            const rect = viewport.getBoundingClientRect();
            const relX = (e.clientX - rect.left) / rect.width;

            // Alt + Wheel over left side: Brightness
            if (e.altKey) {
                if (relX <= 0.5 && window.VidAmpFilters) {
                    const delta = e.deltaY < 0 ? 5 : -5;
                    window.VidAmpFilters.adjustBrightness(delta, this.onToastCallback);
                    return;
                }
            }

            // Detect horizontal two-finger swipe on trackpad (seeking forward/backward)
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 25) {
                const seekDelta = e.deltaX > 0 ? 3 : -3;
                if (window.VidAmpApp) window.VidAmpApp.seekDelta(seekDelta);
                return;
            }

            let rawDelta = e.deltaY;
            if (e.deltaMode === 1) rawDelta *= 25;
            else if (e.deltaMode === 2) rawDelta *= 60;
            const scrollDelta = -rawDelta; // Upward movement = positive

            // GESTURE ZONE 1: Playback Speed (Left 50% of screen OR holding Shift anywhere)
            // Enhancer for YouTube style: increments normally by 0.1x (e.g. 1.0 -> 1.1 -> 1.2 -> 1.3 -> 1.4 -> 1.5...) up to max 4.0x
            if (e.shiftKey || relX < 0.5) {
                accumulatedSpeedDelta += scrollDelta;
                clearTimeout(speedIdleTimer);
                speedIdleTimer = setTimeout(() => {
                    accumulatedSpeedDelta = 0;
                }, 130);

                if (Math.abs(accumulatedSpeedDelta) >= SPEED_THRESHOLD) {
                    const isUp = accumulatedSpeedDelta > 0;
                    accumulatedSpeedDelta -= (isUp ? SPEED_THRESHOLD : -SPEED_THRESHOLD);

                    const velocity = Math.abs(rawDelta);
                    this.stepNormal(isUp, velocity);
                }
                return;
            }

            // GESTURE ZONE 2: Sound / Volume (Right 50% of screen)
            // Scale of 0 to 20, where 20 = Full Sound (100%)
            accumulatedVolumeDelta += scrollDelta;

            clearTimeout(volumeIdleTimer);
            volumeIdleTimer = setTimeout(() => {
                accumulatedVolumeDelta = 0;
            }, 130);

            if (Math.abs(accumulatedVolumeDelta) >= VOLUME_THRESHOLD) {
                const stepUp = accumulatedVolumeDelta > 0;
                accumulatedVolumeDelta -= (stepUp ? VOLUME_THRESHOLD : -VOLUME_THRESHOLD);

                const velocity = Math.abs(rawDelta);
                // Step on 0-20 scale:
                // Soft / standard scroll: 1 unit on the 0-20 scale
                // Fast high-velocity swipe: 2 units on the 0-20 scale
                const stepUnits = velocity >= 55 ? 2 : 1;

                if (window.VidAmpAudio) {
                    const currentStep20 = Math.round(window.VidAmpAudio.volume * 20);
                    const nextStep20 = stepUp 
                        ? Math.min(20, currentStep20 + stepUnits)
                        : Math.max(0, currentStep20 - stepUnits);
                    const nextVol = nextStep20 / 20;

                    window.VidAmpAudio.applyVolume(nextVol, (msg) => {
                        if (window.VidAmpApp) window.VidAmpApp.showToast(msg);
                    });

                    // Sync inline slider (0-20) and HUD slider
                    const inlineSlider = document.getElementById('inline-volume-slider');
                    if (inlineSlider) inlineSlider.value = nextStep20;

                    const hudSlider = document.getElementById('hud-vol-slider');
                    if (hudSlider) hudSlider.value = nextStep20 * 5;

                    const hudVal = document.getElementById('hud-vol-val');
                    if (hudVal) hudVal.textContent = `${nextStep20}/20`;
                }
            }
        }, { passive: false });
    }

    startHoldBoost() {
        if (this.holdBoostEngaged || !this.video) return false;
        const wasPaused = this.video.paused;
        this.holdBoostRestoreRate = this.currentRate;
        this.holdBoostWasPaused = wasPaused;
        this.holdBoostEngaged = true;

        if (wasPaused) {
            this.video.play().catch(() => {});
        }
        this.video.playbackRate = 2.0;

        // Ensure upside bar (titlebar) and downside bar (dock) stay hidden while holding for 2x
        const isFS = document.body.classList.contains('is-fullscreen') || !!document.fullscreenElement;
        if (isFS) {
            const titlebar = document.getElementById('titlebar');
            const dock = document.getElementById('below-video-dock');
            if (titlebar) titlebar.classList.add('autohide');
            if (dock) dock.classList.add('autohide');
            document.body.classList.add('idle-cursor');
            document.body.style.cursor = 'none';
        }

        const indicator = document.getElementById('hold-boost-indicator');
        if (indicator) indicator.classList.add('visible');
        return true;
    }

    endHoldBoost() {
        if (!this.holdBoostEngaged || !this.video) return false;
        this.video.playbackRate = this.holdBoostRestoreRate;
        this.currentRate = this.holdBoostRestoreRate;

        // User requirement: Releasing 2x must NEVER pause the video!
        // Ensure the video continues playing smoothly without interruption
        if (this.video.paused) {
            this.video.play().catch(() => {});
        }

        this.holdBoostEngaged = false;
        this.suppressNextClick = true;
        this.lastHoldBoostEndTime = Date.now();

        const indicator = document.getElementById('hold-boost-indicator');
        if (indicator) indicator.classList.remove('visible');

        this.onSpeedChangeCallbacks.forEach(cb => cb(this.currentRate));
        return true;
    }

    setupHoldBoost() {
        const viewport = document.getElementById('video-stage');
        if (!viewport) return;

        this.mouseDownTime = 0;
        this.lastHoldBoostEndTime = 0;
        this.suppressNextClick = false;

        viewport.addEventListener('mousedown', e => {
            if (e.button !== 0 || e.target.closest('#below-video-dock') || e.target.closest('.drawer') || e.target.closest('.modal-backdrop')) {
                return;
            }
            this.mouseDownTime = Date.now();
            clearTimeout(this.holdTimer);
            this.holdTimer = setTimeout(() => {
                this.startHoldBoost();
            }, 250);
        });

        window.addEventListener('mouseup', () => {
            clearTimeout(this.holdTimer);
            const heldDuration = this.mouseDownTime ? (Date.now() - this.mouseDownTime) : 0;

            if (this.holdBoostEngaged) {
                this.endHoldBoost();
                this.suppressNextClick = true;
                this.lastHoldBoostEndTime = Date.now();
            } else if (heldDuration >= 250) {
                // If held longer than tap threshold, mark as long press release so click doesn't pause
                this.suppressNextClick = true;
                this.lastHoldBoostEndTime = Date.now();
            }
            this.mouseDownTime = 0;
        });

        // Capture phase to intercept and suppress the trailing click event after a long-press release
        window.addEventListener('click', e => {
            const timeSinceHoldEnd = Date.now() - this.lastHoldBoostEndTime;
            if (this.suppressNextClick || timeSinceHoldEnd < 450) {
                this.suppressNextClick = false;
                e.stopPropagation();
                e.stopImmediatePropagation();
                e.preventDefault();
            }
        }, true);
    }
}
