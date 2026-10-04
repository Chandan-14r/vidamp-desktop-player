/* =========================================================
   VidAmp Player — UI & Window Interactions
   - Zero-overlap below-video toolbar docking
   - Smooth Cinema Fullscreen autohide for titlebar & dock
   - Popovers and Drawers manager
   - Drag-and-Drop file processing
   ========================================================= */

export class UIController {
    constructor() {
        this.idleTimer = null;
        this.toastTimer = null;
        this.toolbarVisible = true;
    }

    init() {
        this.bindAutohide();
        this.bindPopovers();
        this.bindInlineVolume();
    }

    bindAutohide() {
        const titlebar = document.getElementById('titlebar');
        const dock = document.getElementById('below-video-dock');
        const fsExitPill = document.getElementById('fullscreen-exit-pill');
        let lastY = 0;
        let pillHideTimer = null;

        const showUI = () => {
            if (titlebar) titlebar.classList.remove('autohide');
            if (dock) dock.classList.remove('autohide');
            document.body.classList.remove('idle-cursor');
            document.body.style.cursor = 'default';
        };

        const hideUI = () => {
            if (titlebar) titlebar.classList.add('autohide');
            if (dock) dock.classList.add('autohide');
            document.body.classList.add('idle-cursor');
            document.body.style.cursor = 'none';
        };

        this.showUI = showUI;
        this.hideUI = hideUI;

        const hideExitPill = () => {
            if (fsExitPill && !fsExitPill.matches(':hover')) {
                fsExitPill.classList.remove('visible');
            }
        };

        const showExitPill = () => {
            if (!fsExitPill) return;
            fsExitPill.classList.add('visible');

            clearTimeout(pillHideTimer);
            pillHideTimer = setTimeout(() => {
                hideExitPill();
            }, 3500);
        };

        if (fsExitPill) {
            fsExitPill.addEventListener('mouseenter', () => {
                clearTimeout(pillHideTimer);
            });
            fsExitPill.addEventListener('mouseleave', () => {
                clearTimeout(pillHideTimer);
                pillHideTimer = setTimeout(() => {
                    hideExitPill();
                }, 800);
            });
        }

        const scheduleAutohide = (e) => {
            // Do NOT reveal top or bottom bars on ANY keyboard keypress (forward ->, rewind <-, spacebar, volume, shortcuts)!
            if (e && e.type === 'keydown') {
                return;
            }

            // Do NOT reveal top or bottom bars when clicking or pressing on the video stage / video area, or using mouse side buttons!
            if (e && e.type === 'mousedown') {
                if (e.button !== 0) return;
                if (e.target && (e.target.closest('#video-stage') || e.target.closest('#video-element') || e.target.closest('#ambient-glow-canvas') || e.target.closest('#cinema-overlay') || e.target.closest('#subtitle-overlay'))) {
                    return;
                }
            }

            // Do NOT reveal top or bottom bars during 2x speed hold, hold pending, or within 1.2s of releasing!
            const sp = window.VidAmpSpeed;
            if (sp) {
                if (sp.holdBoostEngaged || sp.isPointerDownOnStage || sp.isHoldBoostPending) {
                    return;
                }
                if (Date.now() - (sp.lastHoldBoostEndTime || 0) < 1200) {
                    return;
                }
            }

            const isFS = document.body.classList.contains('is-fullscreen') || !!document.fullscreenElement;
            const video = window.VidAmpApp ? window.VidAmpApp.video : null;
            const isPlaying = video && !video.paused;

            // In Fullscreen mode:
            // Top and bottom bars should NOT appear on general mouse movement across the video!
            // Only reveal them if:
            // 1) Cursor moves to top titlebar zone (clientY <= 65)
            // 2) Cursor moves to bottom dock zone (clientY >= innerHeight - 85)
            // 3) Cursor is interacting with a popover, drawer, modal, or dock button
            // 4) Or the video is paused
            if (isFS && isPlaying && e && e.type === 'mousemove') {
                const winH = window.innerHeight;
                const isOverTopBar = e.clientY <= 65;
                const isOverBottomBar = e.clientY >= (winH - 85);
                const isOverUI = e.target && (e.target.closest('#titlebar') || e.target.closest('#below-video-dock') || e.target.closest('.drawer') || e.target.closest('.modal-backdrop') || e.target.closest('.dock-popover') || e.target.closest('.fullscreen-exit-pill'));

                if (!isOverTopBar && !isOverBottomBar && !isOverUI) {
                    // Moving cursor across the video in fullscreen:
                    // Keep cursor visible momentarily, but keep upside and downside bars autohidden!
                    document.body.classList.remove('idle-cursor');
                    document.body.style.cursor = 'default';

                    clearTimeout(this.idleTimer);
                    this.idleTimer = setTimeout(() => {
                        const drawerStillOpen = document.querySelector('.drawer.open');
                        const modalStillOpen = document.querySelector('.modal-backdrop.open');
                        const popoverStillOpen = document.querySelector('#speed-popover.visible, #bookmark-popover.visible, #aspect-popover.visible, #filter-popover.visible');
                        if (drawerStillOpen || modalStillOpen || popoverStillOpen) return;

                        if (titlebar) titlebar.classList.add('autohide');
                        if (dock) dock.classList.add('autohide');
                        document.body.classList.add('idle-cursor');
                        document.body.style.cursor = 'none';
                    }, 1800);
                    return;
                }
            }

            showUI();
            clearTimeout(this.idleTimer);

            // In fullscreen mode during playback, automatically hide UI when idle
            if (isFS && isPlaying) {
                // Check if user is interacting with drawers, modals, or popovers
                const drawerOpen = document.querySelector('.drawer.open');
                const modalOpen = document.querySelector('.modal-backdrop.open');
                const popoverOpen = document.querySelector('#speed-popover.visible, #bookmark-popover.visible, #aspect-popover.visible, #filter-popover.visible');

                if (drawerOpen || modalOpen || popoverOpen) return;

                this.idleTimer = setTimeout(() => {
                    const drawerStillOpen = document.querySelector('.drawer.open');
                    const modalStillOpen = document.querySelector('.modal-backdrop.open');
                    const popoverStillOpen = document.querySelector('#speed-popover.visible, #bookmark-popover.visible, #aspect-popover.visible, #filter-popover.visible');
                    if (drawerStillOpen || modalStillOpen || popoverStillOpen) return;

                    if (titlebar) titlebar.classList.add('autohide');
                    if (dock) dock.classList.add('autohide');
                    document.body.classList.add('idle-cursor');
                    document.body.style.cursor = 'none';
                }, 2200);
            }
        };

        window.addEventListener('mousemove', scheduleAutohide);
        window.addEventListener('mousedown', scheduleAutohide);

        // ONLY show the Exit Fullscreen pill when the user brings their mouse to the TOP-MIDDLE of the screen
        window.addEventListener('mousemove', (e) => {
            const isFS = document.body.classList.contains('is-fullscreen') || !!document.fullscreenElement;
            if (!isFS) {
                if (fsExitPill) fsExitPill.classList.remove('visible');
                clearTimeout(pillHideTimer);
                return;
            }

            const winW = window.innerWidth;
            // Target region: Top 36px, centered horizontally within middle 30% of screen
            const inTopMiddleZone = e.clientY <= 36 && e.clientX >= (winW * 0.35) && e.clientX <= (winW * 0.65);

            if (inTopMiddleZone) {
                showExitPill();
            } else if (fsExitPill && fsExitPill.classList.contains('visible') && !fsExitPill.matches(':hover')) {
                // If cursor leaves the top area, hide it
                if (e.clientY > 75 || Math.abs(e.clientX - (winW / 2)) > 260) {
                    hideExitPill();
                }
            }
        });

        window.addEventListener('fullscreen-entered', () => {
            // NEVER show exit pill on entering fullscreen
            if (fsExitPill) fsExitPill.classList.remove('visible');
            clearTimeout(pillHideTimer);
            if (titlebar) titlebar.classList.add('autohide');
            if (dock) dock.classList.add('autohide');
            document.body.classList.add('idle-cursor');
            document.body.style.cursor = 'none';
        });

        window.addEventListener('fullscreen-exited', () => {
            showUI();
            clearTimeout(pillHideTimer);
            if (fsExitPill) fsExitPill.classList.remove('visible');
        });
    }

    bindPopovers() {
        // Close popovers when clicking outside
        window.addEventListener('click', (e) => {
            if (!e.target.closest('#speed-popover') && !e.target.closest('#tb-speed')) {
                const sp = document.getElementById('speed-popover');
                if (sp) sp.classList.remove('visible');
            }
            if (!e.target.closest('#bookmark-popover') && !e.target.closest('#tb-bookmark')) {
                const bmp = document.getElementById('bookmark-popover');
                if (bmp) bmp.classList.remove('visible');
            }
        });
    }

    bindInlineVolume() {
        const slider = document.getElementById('inline-volume-slider');
        if (!slider) return;

        slider.addEventListener('input', (e) => {
            const step20 = parseInt(e.target.value, 10);
            const vol = step20 / 20;
            if (window.VidAmpAudio) {
                window.VidAmpAudio.applyVolume(vol, (msg) => {
                    if (window.VidAmpApp) window.VidAmpApp.showToast(msg);
                });
            }
        });

        // Sync slider when volume changes externally
        if (window.VidAmpAudio && Array.isArray(window.VidAmpAudio.onVolumeChangeCallbacks)) {
            window.VidAmpAudio.onVolumeChangeCallbacks.push((vol) => {
                if (slider) slider.value = Math.min(20, Math.round(vol * 20));
            });
        }
    }

    toggleToolbar(force) {
        const dock = document.getElementById('below-video-dock');
        if (!dock) return;
        this.toolbarVisible = typeof force === 'boolean' ? force : !this.toolbarVisible;
        dock.style.display = this.toolbarVisible ? 'flex' : 'none';
        if (window.VidAmpApp) {
            window.VidAmpApp.showToast(this.toolbarVisible ? '🎛️ Toolbar: Shown (Alt+T)' : '🎛️ Toolbar: Hidden (Alt+T)');
        }
    }
}
