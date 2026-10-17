/**
 * SafeHer Voice & Shake SOS Trigger + Silent Audio Evidence Recorder
 */

const VoiceShake = {
    recognition: null,
    isVoiceEnabled: false,
    isShakeEnabled: false,
    mediaRecorder: null,
    audioChunks: [],
    lastShakeTime: 0,
    shakeThreshold: 22, // Acceleration magnitude threshold

    // 1. Voice Recognition ("help me" / "safeher sos")
    initVoice(triggerSOSCallback) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('Web Speech API not supported on this browser.');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event) => {
            const last = event.results.length - 1;
            const text = event.results[last][0].transcript.trim().toLowerCase();
            console.log('[SafeHer Voice Keyword Detected]:', text);

            if (text.includes('help me') || text.includes('safeher') || text.includes('emergency') || text.includes('bachao')) {
                API.toast(`Voice SOS trigger recognized: "${text}"`, 'danger');
                if (triggerSOSCallback) triggerSOSCallback('voice');
            }
        };

        this.recognition.onerror = (err) => {
            console.warn('Speech recognition error:', err.error);
        };
    },

    toggleVoice(enable, callback) {
        if (!this.recognition) this.initVoice(callback);
        this.isVoiceEnabled = enable;

        if (enable && this.recognition) {
            try {
                this.recognition.start();
                API.toast('Voice SOS Active! Speak "help me" or "emergency" to trigger.', 'success');
            } catch(e) {}
        } else if (this.recognition) {
            try {
                this.recognition.stop();
                API.toast('Voice SOS deactivated.', 'info');
            } catch(e) {}
        }
    },

    // 2. Shake Detection (DeviceMotionEvent)
    toggleShake(enable, callback) {
        this.isShakeEnabled = enable;

        const handleMotion = (e) => {
            if (!this.isShakeEnabled) return;
            const acc = e.accelerationIncludingGravity || e.acceleration;
            if (!acc) return;

            const magnitude = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);

            if (magnitude > this.shakeThreshold) {
                const now = Date.now();
                if (now - this.lastShakeTime > 3000) { // Debounce 3s
                    this.lastShakeTime = now;
                    API.toast('Violent phone shake detected! Triggering SOS...', 'danger');
                    if (callback) callback('shake');
                }
            }
        };

        if (enable) {
            if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
                DeviceMotionEvent.requestPermission().then(state => {
                    if (state === 'granted') {
                        window.addEventListener('devicemotion', handleMotion);
                        API.toast('Shake SOS enabled! Vigorously shake phone to trigger.', 'success');
                    }
                }).catch(() => API.toast('Motion sensors not permitted.', 'warning'));
            } else {
                window.addEventListener('devicemotion', handleMotion);
                API.toast('Shake SOS enabled!', 'success');
            }
        } else {
            window.removeEventListener('devicemotion', handleMotion);
            API.toast('Shake SOS disabled.', 'info');
        }
    },

    // 3. Silent Audio Evidence Recording (MediaRecorder)
    async startSilentEvidenceRecording(alertId, durationSec = 15) {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.warn('Microphone access not supported on this browser.');
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    this.audioChunks.push(e.data);
                }
            };

            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = async () => {
                    const base64Audio = reader.result;
                    try {
                        await API.request(`/api/alerts/${alertId}/evidence`, {
                            method: 'POST',
                            body: JSON.stringify({ audioBase64: base64Audio, durationSec })
                        });
                        API.toast('Silent audio evidence recorded & securely synced.', 'success');
                    } catch (err) {
                        console.error('Failed to upload evidence:', err);
                    }
                };

                // Stop tracks to release mic
                stream.getTracks().forEach(t => t.stop());
            };

            this.mediaRecorder.start();
            console.log(`[SafeHer Evidence] 🎙️ Silent recording started (${durationSec}s)...`);

            setTimeout(() => {
                if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                    this.mediaRecorder.stop();
                }
            }, durationSec * 1000);
        } catch (err) {
            console.warn('[SafeHer Evidence] Mic capture declined or unavailable:', err.message);
        }
    }
};
