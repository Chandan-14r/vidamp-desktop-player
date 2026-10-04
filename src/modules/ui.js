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

        const triggerPillWith5sTimeout = () => {
            if (!fsExitPill) return;
            fsExitPill.classList.add('visible');
            if (titlebar) titlebar.classList.remove('autohide');

            clearTimeout(pillHideTimer);
            pillHideTimer = setTimeout(() => {
                if (fsExitPill && !fsExitPill.matches(':hover')) {
                    fsExitPill.classList.remove('visible');
                }
            }, 5000); // Popup automatically exits after 5 seconds!
        };

        if (fsExitPill) {
            fsExitPill.addEventListener('mouseenter', () => {
                clearTimeout(pillHideTimer);
            });
            fsExitPill.addEventListener('mouseleave', () => {
                clearTimeout(pillHideTimer);
                pillHideTimer = setTimeout(() => {
                    if (fsExitPill) fsExitPill.classList.remove('visible');
                }, 2000);
            });
        }

        const scheduleAutohide = (e) => {
            showUI();
            clearTimeout(this.idleTimer);

            const isFS = document.body.classList.contains('is-fullscreen') || !!document.fullscreenElement;
            const video = window.VidAmpApp ? window.VidAmpApp.video : null;
            const isPlaying = video && !video.paused;

            // In fullscreen mode during playback, automatically hide UI when idle
            if (isFS && isPlaying) {
                // Check if user is interacting with drawers, modals, or popovers
                const drawerOpen = document.querySelector('.drawer.open');
                const modalOpen = document.querySelector('.modal-backdrop.open');
                const popoverOpen = document.querySelector('#speed-popover.visible, #bookmark-popover.visible');

                if (drawerOpen || modalOpen || popoverOpen) return;

                this.idleTimer = setTimeout(() => {
                    const drawerStillOpen = document.querySelector('.drawer.open');
                    const modalStillOpen = document.querySelector('.modal-backdrop.open');
                    const popoverStillOpen = document.querySelector('#speed-popover.visible, #bookmark-popover.visible');
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
        window.addEventListener('keydown', scheduleAutohide);

        // When mouse moves upward / near top edge, pop down the Wrong / Exit Arrow pill for 5 seconds!
        window.addEventListener('mousemove', (e) => {
            const isFS = document.body.classList.contains('is-fullscreen') || !!document.fullscreenElement;
            if (!isFS) {
                if (fsExitPill) fsExitPill.classList.remove('visible');
                clearTimeout(pillHideTimer);
                return;
            }

            const screenMiddle = window.innerHeight / 2;
            const movingUpward = e.clientY < lastY;
            lastY = e.clientY;

            // Trigger when moving upward in the upper half of the screen ("upward of the middle") or hovering top zone
            if (e.clientY < 60) {
                triggerPillWith5sTimeout();
            } else if (movingUpward && e.clientY < screenMiddle) {
                triggerPillWith5sTimeout();
            }
        });

        window.addEventListener('fullscreen-entered', () => {
            scheduleAutohide();
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
