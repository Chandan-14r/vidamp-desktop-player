/* =========================================================
   VidAmp Player — VLC, MPC-HC & VidAmp Master Keyboard Shortcuts
   - Space: Single-toggle Play/Pause with activeElement blur
   - [ / ]: Snap speed down / up to standard grid
   - R: Reset speed to 1.0x
   - , / .: Frame-by-frame backward / forward (~0.033s)
   - Left / Right: Jump ±5s; Alt + Left / Right: Jump ±10s; Ctrl + Left / Right: Jump ±60s
   - J / K: Audio delay sync ±50ms (VLC)
   - G / H: Subtitle delay sync ±50ms (VLC)
   - V: Toggle subtitles on/off
   - I: Toggle MPC-HC Media Info HUD
   - Alt + 1 / 2 / 3: Window scaling (50%, 100%, 200%)
   - Alt + B: Toggle Pro Tools Drawer; Alt + T: Toggle Toolbar
   - Shift + A: Universal Ambient Glow
   - Shift + B: Bookmark Timestamp
   - Shift + S: Sleep Timer
   - ?: Shortcut Cheat Sheet
   ========================================================= */

export class ShortcutsManager {
    constructor() {
        this.video = null;
        this.spaceHoldTimer = null;
        this.spaceLongPressEngaged = false;
    }

    init(videoEl) {
        this.video = videoEl;
        this.bindEvents();
    }

    isSpaceKey(e) {
        return (
            e.code === 'Space' ||
            e.key === ' ' ||
            e.key === 'Spacebar' ||
            e.keyCode === 32
        );
    }

    bindEvents() {
        window.addEventListener('keydown', e => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // Space: Long-press for 2x Speed, Quick tap for Play / Pause
            if (this.isSpaceKey(e) && !e.ctrlKey && !e.altKey && !e.metaKey) {
                e.preventDefault();
                if (document.activeElement && typeof document.activeElement.blur === 'function') {
                    document.activeElement.blur();
                }

                if (e.repeat) {
                    // Continuing to hold: ensure 2x speed boost is active
                    if (!this.spaceLongPressEngaged) {
                        clearTimeout(this.spaceHoldTimer);
                        this.spaceLongPressEngaged = true;
                        if (window.VidAmpSpeed) {
                            window.VidAmpSpeed.startHoldBoost();
                        }
                    }
                    return;
                }

                // Initial keydown: begin hold timer (220ms)
                this.spaceLongPressEngaged = false;
                clearTimeout(this.spaceHoldTimer);
                this.spaceHoldTimer = setTimeout(() => {
                    this.spaceLongPressEngaged = true;
                    if (window.VidAmpSpeed) {
                        window.VidAmpSpeed.startHoldBoost();
                    }
                }, 220);
                return;
            }

            // Alt + 1, 2, 3: Window Scaling (MPC-HC style)
            if (e.altKey && !e.ctrlKey && !e.shiftKey) {
                if (e.key === '1') {
                    e.preventDefault();
                    window.VidAmpApp.scaleWindow(0.5);
                    return;
                }
                if (e.key === '2') {
                    e.preventDefault();
                    window.VidAmpApp.scaleWindow(1.0);
                    return;
                }
                if (e.key === '3') {
                    e.preventDefault();
                    window.VidAmpApp.scaleWindow(2.0);
                    return;
                }
                // Alt + B: Pro Video Tools Panel
                if (e.key.toLowerCase() === 'b' || e.code === 'KeyB') {
                    e.preventDefault();
                    window.VidAmpApp.toggleDrawer('eq-drawer');
                    return;
                }
                // Alt + T: Below-Video Toolbar Toggle
                if (e.key.toLowerCase() === 't' || e.code === 'KeyT') {
                    e.preventDefault();
                    window.VidAmpApp.toggleToolbarVisibility();
                    return;
                }
            }

            // Speed Snapping: [ and ]
            if ((e.key === '[' || e.code === 'BracketLeft') && !e.ctrlKey && !e.altKey && !e.metaKey) {
                e.preventDefault();
                window.VidAmpSpeed.stepDown();
                return;
            }
            if ((e.key === ']' || e.code === 'BracketRight') && !e.ctrlKey && !e.altKey && !e.metaKey) {
                e.preventDefault();
                window.VidAmpSpeed.stepUp();
                return;
            }

            // R: Reset speed to 1.0x (without Shift)
            if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
                e.preventDefault();
                window.VidAmpSpeed.reset();
                return;
            }

            // Frame Stepper: . and ,
            if ((e.key === '.' || e.key === '>') && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                window.VidAmpApp.stepFrame(1);
                return;
            }
            if ((e.key === ',' || e.key === '<') && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                window.VidAmpApp.stepFrame(-1);
                return;
            }

            // Audio Delay Sync (VLC J / K keys ±50ms)
            if (e.key.toLowerCase() === 'j' && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                window.VidAmpAudio.adjustAudioDelay(-50, window.VidAmpApp.showToast);
                return;
            }
            if (e.key.toLowerCase() === 'k' && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                window.VidAmpAudio.adjustAudioDelay(50, window.VidAmpApp.showToast);
                return;
            }

            // Subtitle Delay Sync (VLC G / H keys ±50ms)
            if (e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                window.VidAmpSubtitles.adjustDelay(-50, window.VidAmpApp.showToast);
                return;
            }
            if (e.key.toLowerCase() === 'h' && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                window.VidAmpSubtitles.adjustDelay(50, window.VidAmpApp.showToast);
                return;
            }

            // V: Toggle Subtitles on/off
            if (e.key.toLowerCase() === 'v' && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                window.VidAmpSubtitles.toggleSubtitles(window.VidAmpApp.showToast);
                return;
            }

            // I: Toggle MPC-HC Media Info HUD
            if (e.key.toLowerCase() === 'i' && !e.altKey) {
                e.preventDefault();
                window.VidAmpHUD.toggle();
                return;
            }

            // Shift Modifiers
            if (e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
                // Shift + R: Rotate Video 90° Clockwise
                if (e.key === 'r' || e.key === 'R' || e.code === 'KeyR') {
                    e.preventDefault();
                    if (window.VidAmpFilters) {
                        window.VidAmpFilters.rotateClockwise(window.VidAmpApp ? window.VidAmpApp.showToast : null);
                    }
                    return;
                }
                // Shift + M: Mirror Flip Horizontal
                if (e.key === 'm' || e.key === 'M' || e.code === 'KeyM') {
                    e.preventDefault();
                    if (window.VidAmpFilters) {
                        window.VidAmpFilters.toggleFlipHorizontal(window.VidAmpApp ? window.VidAmpApp.showToast : null);
                    }
                    return;
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    window.VidAmpAudio.applyVolume(window.VidAmpAudio.volume + 0.05, window.VidAmpApp.showToast);
                    return;
                }
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    window.VidAmpAudio.applyVolume(window.VidAmpAudio.volume - 0.05, window.VidAmpApp.showToast);
                    return;
                }
                if (e.key === 'A' || e.code === 'KeyA') {
                    e.preventDefault();
                    window.VidAmpAmbient.toggle(window.VidAmpApp.showToast);
                    return;
                }
                if (e.key === 'B' || e.code === 'KeyB') {
                    e.preventDefault();
                    window.VidAmpTools.addBookmark();
                    return;
                }
                if (e.key === 'S' || e.code === 'KeyS') {
                    e.preventDefault();
                    window.VidAmpTools.cycleSleepTimer();
                    return;
                }
                // Shift + P: Always-On-Top Mini PiP Controller
                if (e.key === 'P' || e.code === 'KeyP') {
                    e.preventDefault();
                    if (window.VidAmpApp && window.VidAmpApp.toggleMiniPip) {
                        window.VidAmpApp.toggleMiniPip();
                    }
                    return;
                }
                // Shift + E: 1-Click GIF / Clip Export
                if (e.key === 'E' || e.code === 'KeyE') {
                    e.preventDefault();
                    if (window.VidAmpApp && window.VidAmpApp.openClipExportModal) {
                        window.VidAmpApp.openClipExportModal();
                    }
                    return;
                }
                // Shift + H: Cycle HDR Passthrough Tone-Mapping
                if (e.key === 'H' || e.code === 'KeyH') {
                    e.preventDefault();
                    if (window.VidAmpApp && window.VidAmpApp.cycleHdrMode) {
                        window.VidAmpApp.cycleHdrMode();
                    }
                    return;
                }
            }

            // Seeking Jumps (VLC & MPC-HC style: normal ±5s, Alt ±10s, Ctrl ±60s)
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                const delta = e.ctrlKey ? -60 : (e.altKey ? -10 : -5);
                window.VidAmpApp.seekDelta(delta);
                return;
            }
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                const delta = e.ctrlKey ? 60 : (e.altKey ? 10 : 5);
                window.VidAmpApp.seekDelta(delta);
                return;
            }

            // Volume Up/Down with standard Arrow keys (MPC-HC standard)
            if (e.key === 'ArrowUp' && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                window.VidAmpAudio.applyVolume(window.VidAmpAudio.volume + 0.05, window.VidAmpApp.showToast);
                return;
            }
            if (e.key === 'ArrowDown' && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                window.VidAmpAudio.applyVolume(window.VidAmpAudio.volume - 0.05, window.VidAmpApp.showToast);
                return;
            }

            // Ctrl + O: Open Media File
            if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'o' || e.key === 'O')) {
                e.preventDefault();
                window.VidAmpApp.openFilePicker();
                return;
            }

            // Ctrl + N: Open Network Stream (VLC standard)
            if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'n' || e.key === 'N')) {
                e.preventDefault();
                window.VidAmpApp.openNetworkUrlPrompt();
                return;
            }

            // Ctrl + J or Ctrl + T: Jump to timestamp
            if ((e.ctrlKey && (e.key === 'j' || e.key === 'J' || e.key === 't' || e.key === 'T'))) {
                e.preventDefault();
                window.VidAmpApp.promptJumpToTime();
                return;
            }

            // Ctrl + H: Watch History & Recents Drawer
            if (e.ctrlKey && (e.key === 'h' || e.key === 'H') && !e.altKey) {
                e.preventDefault();
                window.VidAmpApp.toggleDrawer('history-drawer');
                return;
            }

            // N: Night Mode Dialogue Clarity
            if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.altKey && !e.metaKey) {
                e.preventDefault();
                if (window.VidAmpAudio) {
                    window.VidAmpAudio.toggleNightModeDialogue((msg) => window.VidAmpApp.showToast(msg));
                }
                return;
            }

            // B: Cycle Multi-Track Audio languages (MPC-HC A / VLC B standard)
            if ((e.key === 'b' || e.key === 'B') && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
                e.preventDefault();
                if (window.VidAmpAudio) {
                    window.VidAmpAudio.cycleAudioTrack(window.VidAmpApp ? window.VidAmpApp.showToast : null);
                }
                return;
            }

            // Ctrl + Shift + S: Auto-Fetch Subtitles (OpenSubtitles)
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                if (window.VidAmpApp && window.VidAmpApp.openAutoFetchSubtitles) {
                    window.VidAmpApp.openAutoFetchSubtitles();
                }
                return;
            }

            // M: Mute
            if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                window.VidAmpApp.toggleMute();
                return;
            }

            // F: Fullscreen
            if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                window.VidAmpApp.toggleFullscreen();
                return;
            }

            // P: Picture in Picture
            if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                window.VidAmpApp.togglePiP();
                return;
            }

            // ?: Shortcut Cheat Sheet
            if (e.key === '?' || (e.shiftKey && e.key === '/')) {
                e.preventDefault();
                window.VidAmpApp.toggleShortcutsModal();
                return;
            }

            // F12 or Ctrl+Shift+I: Toggle DevTools
            if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i'))) {
                e.preventDefault();
                if (window.vidampAPI && window.vidampAPI.toggleDevTools) {
                    window.vidampAPI.toggleDevTools();
                }
                return;
            }

            // Escape: Exit fullscreen first, then close modals/drawers
            if (e.key === 'Escape') {
                // If in native Electron fullscreen, exit it
                if (document.body.classList.contains('is-fullscreen') && window.vidampAPI && window.vidampAPI.setFullscreen) {
                    window.vidampAPI.setFullscreen(false);
                    return;
                }
                // Otherwise close modals/drawers
                window.VidAmpApp.closeAllModals();
            }
        });

        window.addEventListener('keyup', e => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // Space keyup: restore speed if long-pressed, or toggle Play/Pause if tapped
            if (this.isSpaceKey(e) && !e.ctrlKey && !e.altKey && !e.metaKey) {
                e.preventDefault();
                clearTimeout(this.spaceHoldTimer);

                const wasLongPress = this.spaceLongPressEngaged || (window.VidAmpSpeed && window.VidAmpSpeed.holdBoostEngaged);
                if (wasLongPress) {
                    this.spaceLongPressEngaged = false;
                    if (window.VidAmpSpeed) {
                        window.VidAmpSpeed.endHoldBoost();
                    }
                } else {
                    // Quick tap: toggle Play / Pause
                    if (window.VidAmpApp) {
                        window.VidAmpApp.togglePlay();
                    }
                }
                return;
            }
        });

        window.addEventListener('blur', () => {
            clearTimeout(this.spaceHoldTimer);
            if (this.spaceLongPressEngaged) {
                this.spaceLongPressEngaged = false;
                if (window.VidAmpSpeed) {
                    window.VidAmpSpeed.endHoldBoost();
                }
            }
        });

        // Mouse Forward (button 4) and Back (button 3) side button seeking
        window.addEventListener('mouseup', e => {
            if (e.button === 4) {
                e.preventDefault();
                if (window.VidAmpApp) window.VidAmpApp.seekDelta(5);
            } else if (e.button === 3) {
                e.preventDefault();
                if (window.VidAmpApp) window.VidAmpApp.seekDelta(-5);
            }
        });
    }
}
