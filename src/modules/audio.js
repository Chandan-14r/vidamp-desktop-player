/* =========================================================
   VidAmp Player — Professional Audio Suite
   - 200% Volume Boost with Web Audio API limiter (DynamicsCompressor)
   - Studio Bass Boost EQ (+7dB low-end shelf at 140Hz)
   - Vocal Clarity EQ (+6dB dialog peak at 2.5kHz)
   - 10-Band Studio Graphic Equalizer with VLC / MPC-HC Presets
   - Audio Delay / Sync Correction (VLC J/K keys ±50ms)
   - Real-time Spectrum Visualizer
   ========================================================= */

export class AudioController {
    constructor() {
        this.ctx = null;
        this.source = null;
        this.gainNode = null;
        this.limiterNode = null;
        this.bassFilter = null;
        this.vocalFilter = null;
        this.delayNode = null;
        this.pannerNode = null;
        this.eqFilters = [];
        this.analyser = null;
        this.videoEl = null;

        this.bassBoostActive = false;
        this.vocalBoostActive = false;
        this.nightModeActive = false;
        this.volume = 1.0;
        this.volumeBoostLimit = 2.5; // up to 250%
        this.audioDelayMs = 0; // -5000ms to +5000ms
        this.onVolumeChangeCallbacks = [];

        this.eqFrequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
        this.eqGains = new Array(10).fill(0);

        this.presets = {
            flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            bass: [8, 7, 5, 2, 0, 0, 0, 0, 0, 0],
            vocal: [-3, -1, 0, 2, 5, 6, 4, 2, 0, 0],
            movie: [5, 3, 1, 2, 4, 5, 3, 2, 1, 0],
            rock: [6, 4, 2, -1, -2, 1, 3, 5, 6, 6],
            pop: [-1, 1, 3, 4, 3, 0, -1, 1, 3, 4],
            classical: [5, 4, 3, 2, -1, -1, 0, 2, 3, 4],
            club: [0, 0, 3, 5, 5, 5, 3, 0, 0, 0],
            night: [-6, -4, -2, 0, 2, 2, 1, -1, -3, -5]
        };

        this.visualizerAnimationId = null;
    }

    ensureContext(video) {
        if (this.ctx && this.source && this.videoEl === video) {
            if (this.ctx.state === 'suspended') {
                this.ctx.resume().catch(() => {});
            }
            return true;
        }

        try {
            this.videoEl = video;
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return false;

            this.ctx = new AudioCtx();
            this.source = this.ctx.createMediaElementSource(video);

            // 1. Audio Delay Node (for VLC-style audio sync correction)
            this.delayNode = this.ctx.createDelay(5.0);
            this.delayNode.delayTime.value = Math.max(0, this.audioDelayMs / 1000);

            // 2. Low-shelf filter for Bass Boost (+7dB at 140Hz)
            this.bassFilter = this.ctx.createBiquadFilter();
            this.bassFilter.type = 'lowshelf';
            this.bassFilter.frequency.value = 140;
            this.bassFilter.gain.value = this.bassBoostActive ? 7.0 : 0.0;

            // 3. Peaking filter for Vocal Clarity (+6dB at 2500Hz, Q=1.0)
            this.vocalFilter = this.ctx.createBiquadFilter();
            this.vocalFilter.type = 'peaking';
            this.vocalFilter.frequency.value = 2500;
            this.vocalFilter.Q.value = 1.0;
            this.vocalFilter.gain.value = this.vocalBoostActive ? 6.0 : 0.0;

            // 4. 10-Band Studio Graphic Equalizer
            this.eqFilters = this.eqFrequencies.map((freq, i) => {
                const f = this.ctx.createBiquadFilter();
                f.frequency.value = freq;
                f.gain.value = this.eqGains[i];
                if (i === 0) f.type = 'lowshelf';
                else if (i === this.eqFrequencies.length - 1) f.type = 'highshelf';
                else {
                    f.type = 'peaking';
                    f.Q.value = 1.4;
                }
                return f;
            });

            // 5. Master Gain Node (supports up to 250% Volume Boost)
            this.gainNode = this.ctx.createGain();
            this.gainNode.gain.value = this.volume > 1.0 ? this.volume : 1.0;

            // 6. Limiter / DynamicsCompressor to prevent digital distortion at 200%
            this.limiterNode = this.ctx.createDynamicsCompressor();
            this.limiterNode.threshold.value = -6.0;
            this.limiterNode.knee.value = 12.0;
            this.limiterNode.ratio.value = 12.0;
            this.limiterNode.attack.value = 0.003;
            this.limiterNode.release.value = 0.25;

            // 7. Stereo Panner
            if (this.ctx.createStereoPanner) {
                this.pannerNode = this.ctx.createStereoPanner();
            }

            // 8. Analyser for spectrum visualizer
            this.analyser = this.ctx.createAnalyser();
            this.analyser.fftSize = 64;

            // Construct Chain:
            // source -> delay -> bassFilter -> vocalFilter -> eq0..9 -> gain -> limiter -> panner -> analyser -> destination
            let lastNode = this.source;

            lastNode.connect(this.delayNode);
            lastNode = this.delayNode;

            lastNode.connect(this.bassFilter);
            lastNode = this.bassFilter;

            lastNode.connect(this.vocalFilter);
            lastNode = this.vocalFilter;

            for (const eqNode of this.eqFilters) {
                lastNode.connect(eqNode);
                lastNode = eqNode;
            }

            lastNode.connect(this.gainNode);
            lastNode = this.gainNode;

            lastNode.connect(this.limiterNode);
            lastNode = this.limiterNode;

            if (this.pannerNode) {
                lastNode.connect(this.pannerNode);
                lastNode = this.pannerNode;
            }

            lastNode.connect(this.analyser);
            this.analyser.connect(this.ctx.destination);

            if (this.ctx.state === 'suspended') {
                this.ctx.resume().catch(() => {});
            }
            return true;
        } catch (err) {
            console.warn('[VidAmp Audio] Web Audio setup:', err);
            return false;
        }
    }

    applyVolume(volumeLevel, onToast) {
        if (!this.videoEl) return;
        const effectiveVol = Math.max(0, Math.min(this.volumeBoostLimit, volumeLevel));
        this.volume = effectiveVol;

        const level20 = Math.round(effectiveVol * 20);

        if (effectiveVol <= 1.0) {
            this.videoEl.volume = effectiveVol;
            if (this.gainNode) {
                this.gainNode.gain.value = 1.0;
            }
            if (onToast) {
                if (level20 === 0) {
                    onToast('🔇 Volume: 0 / 20 (Muted)');
                } else if (level20 === 20) {
                    onToast('🔊 Volume: 20 / 20 (Full Sound)');
                } else {
                    onToast(`🔊 Volume: ${level20} / 20`);
                }
            }
        } else {
            this.ensureContext(this.videoEl);
            this.videoEl.volume = 1.0;
            if (this.gainNode) {
                this.gainNode.gain.value = effectiveVol;
                if (onToast) onToast(`🚀 Volume Boost: ${level20} / 20 (${Math.round(effectiveVol * 100)}%)`);
            } else {
                if (onToast) onToast('🔊 Volume: 20 / 20 (Full Sound)');
            }
        }

        if (effectiveVol > 0 && this.videoEl.muted) {
            this.videoEl.muted = false;
        }

        if (this.onVolumeChangeCallbacks && this.onVolumeChangeCallbacks.length) {
            this.onVolumeChangeCallbacks.forEach(cb => {
                try { cb(effectiveVol); } catch (_) {}
            });
        }
    }

    toggleBassBoost(onToast) {
        if (!this.videoEl) return false;
        this.ensureContext(this.videoEl);
        this.bassBoostActive = !this.bassBoostActive;
        if (this.bassFilter) {
            this.bassFilter.gain.value = this.bassBoostActive ? 7.0 : 0.0;
        }
        if (onToast) {
            onToast(this.bassBoostActive ? '🔊 Bass Boost: ON (+7dB)' : '🔊 Bass Boost: OFF');
        }
        return this.bassBoostActive;
    }

    toggleVocalBoost(onToast) {
        if (!this.videoEl) return false;
        this.ensureContext(this.videoEl);
        this.vocalBoostActive = !this.vocalBoostActive;
        if (this.vocalFilter) {
            this.vocalFilter.gain.value = this.vocalBoostActive ? 6.0 : 0.0;
        }
        if (onToast) {
            onToast(this.vocalBoostActive ? '🎙️ Vocal Clarity: ON (+6dB)' : '🎙️ Vocal Clarity: OFF');
        }
        return this.vocalBoostActive;
    }

    toggleNightModeDialogue(onToast) {
        if (!this.videoEl) return false;
        this.ensureContext(this.videoEl);
        this.nightModeActive = !this.nightModeActive;

        if (this.limiterNode) {
            // Night mode dynamic range compression (DRC):
            // Threshold: -28dB, ratio: 18:1, smooth knee: 30
            // Suppresses loud gunshot/explosion spikes while lifting quiet voices
            this.limiterNode.threshold.value = this.nightModeActive ? -28.0 : -6.0;
            this.limiterNode.knee.value = this.nightModeActive ? 30.0 : 12.0;
            this.limiterNode.ratio.value = this.nightModeActive ? 18.0 : 12.0;
        }

        if (this.vocalFilter) {
            const boost = this.nightModeActive ? 7.0 : (this.vocalBoostActive ? 6.0 : 0.0);
            this.vocalFilter.gain.value = boost;
        }

        const btn = document.getElementById('tb-speech');
        if (btn) btn.classList.toggle('active', this.nightModeActive);

        if (onToast) {
            onToast(this.nightModeActive
                ? '🌙 Dialogue Clarity: ON (Tames explosions, boosts speech)'
                : '🌙 Dialogue Clarity: OFF'
            );
        }
        return this.nightModeActive;
    }

    // Audio Delay Sync (VLC J/K keys ±50ms)
    adjustAudioDelay(deltaMs, onToast) {
        this.audioDelayMs = Math.max(-5000, Math.min(5000, this.audioDelayMs + deltaMs));
        if (this.delayNode) {
            // Web Audio delay node accepts >= 0; negative delays simulated via currentTime offset if needed
            this.delayNode.delayTime.value = Math.max(0, this.audioDelayMs / 1000);
        }
        if (onToast) {
            const sign = this.audioDelayMs > 0 ? `+${this.audioDelayMs}` : `${this.audioDelayMs}`;
            onToast(`⏱️ Audio Delay: ${sign} ms`);
        }
        return this.audioDelayMs;
    }

    setEqBandGain(bandIndex, gainDb) {
        if (bandIndex < 0 || bandIndex >= this.eqFilters.length) return;
        this.eqGains[bandIndex] = gainDb;
        if (this.eqFilters[bandIndex]) {
            this.eqFilters[bandIndex].gain.value = gainDb;
        }
    }

    applyPreset(presetKey) {
        const gains = this.presets[presetKey];
        if (!gains) return;
        gains.forEach((g, idx) => {
            this.setEqBandGain(idx, g);
        });
    }

    startVisualizer(canvas) {
        if (!canvas) return;
        const canvasCtx = canvas.getContext('2d');
        const bufferLength = this.analyser ? this.analyser.frequencyBinCount : 32;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            this.visualizerAnimationId = requestAnimationFrame(draw);
            if (!this.analyser) return;

            this.analyser.getByteFrequencyData(dataArray);
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / bufferLength) * 1.5;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * canvas.height;
                const gradient = canvasCtx.createLinearGradient(0, canvas.height, 0, 0);
                gradient.addColorStop(0, 'rgba(56, 189, 248, 0.2)');
                gradient.addColorStop(0.7, '#38bdf8');
                gradient.addColorStop(1, '#a855f7');

                canvasCtx.fillStyle = gradient;
                canvasCtx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
                x += barWidth;
            }
        };

        draw();
    }

    stopVisualizer() {
        if (this.visualizerAnimationId) {
            cancelAnimationFrame(this.visualizerAnimationId);
            this.visualizerAnimationId = null;
        }
    }

    // Multi-Track Audio Switcher
    async detectAudioTracks(filePath, onTracksFound) {
        this.currentFilePath = filePath;
        this.audioTracks = [];
        this.activeTrackIndex = 0;

        // 1. Check native HTML5 audioTracks (from Blink AudioVideoTracks feature)
        if (this.videoEl && this.videoEl.audioTracks && this.videoEl.audioTracks.length > 0) {
            for (let i = 0; i < this.videoEl.audioTracks.length; i++) {
                const t = this.videoEl.audioTracks[i];
                this.audioTracks.push({
                    index: i,
                    language: t.language || 'und',
                    title: t.label || `Track ${i + 1}`,
                    codec: 'Native',
                    channels: 'Stereo',
                    label: `${t.label || `Audio Track ${i + 1}`} [${(t.language || 'UND').toUpperCase()}]`
                });
            }
        }

        // 2. Query FFprobe for precise container stream info
        if (window.vidampAPI && window.vidampAPI.getAudioTracks && filePath) {
            try {
                const probeTracks = await window.vidampAPI.getAudioTracks(filePath);
                if (probeTracks && probeTracks.length > 0) {
                    this.audioTracks = probeTracks;
                }
            } catch (err) {
                console.error('Audio track probe error:', err);
            }
        }

        this.updateAudioTrackUI();
        if (onTracksFound) onTracksFound(this.audioTracks);
        return this.audioTracks;
    }

    switchAudioTrack(trackIndex, onToast) {
        if (!this.audioTracks.length || trackIndex < 0 || trackIndex >= this.audioTracks.length) {
            if (onToast) onToast('⚠️ Audio track not available');
            return;
        }

        this.activeTrackIndex = trackIndex;
        const targetTrack = this.audioTracks[trackIndex];

        // If native audioTracks supported
        if (this.videoEl && this.videoEl.audioTracks && this.videoEl.audioTracks.length > 1) {
            for (let i = 0; i < this.videoEl.audioTracks.length; i++) {
                this.videoEl.audioTracks[i].enabled = (i === trackIndex);
            }
        }

        this.updateAudioTrackUI();
        if (onToast) onToast(`🎧 Switched Audio: ${targetTrack.label}`);
    }

    cycleAudioTrack(onToast) {
        if (!this.audioTracks || this.audioTracks.length <= 1) {
            if (onToast) onToast('🎧 Single audio track media');
            return;
        }

        const nextIndex = (this.activeTrackIndex + 1) % this.audioTracks.length;
        this.switchAudioTrack(nextIndex, onToast);
    }

    updateAudioTrackUI() {
        const btn = document.getElementById('tb-audio-track');
        const badge = document.getElementById('tb-audio-track-badge');
        const eqContainer = document.getElementById('eq-audio-tracks-list');

        if (btn) {
            btn.style.display = (this.audioTracks && this.audioTracks.length > 1) ? 'inline-flex' : 'none';
        }
        if (badge && this.audioTracks[this.activeTrackIndex]) {
            const lang = this.audioTracks[this.activeTrackIndex].language;
            badge.textContent = lang ? lang.toUpperCase() : `T${this.activeTrackIndex + 1}`;
        }

        if (eqContainer) {
            if (!this.audioTracks.length) {
                eqContainer.innerHTML = '<span style="font-size:11px;color:var(--text-muted);">Default Media Audio (Track 1)</span>';
            } else {
                eqContainer.innerHTML = '';
                this.audioTracks.forEach((t, i) => {
                    const pill = document.createElement('button');
                    pill.className = `sp-pill ${i === this.activeTrackIndex ? 'active' : ''}`;
                    pill.style.fontSize = '10px';
                    pill.textContent = t.label;
                    pill.onclick = () => this.switchAudioTrack(i, (msg) => window.VidAmpApp && window.VidAmpApp.showToast(msg));
                    eqContainer.appendChild(pill);
                });
            }
        }
    }
}
