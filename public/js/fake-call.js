/**
 * SafeHer Fake Incoming Call Generator
 * Uses Web Audio API for zero-asset realistic telephone ringing cadence.
 */

const FakeCall = {
    audioCtx: null,
    ringInterval: null,
    callDurationInterval: null,
    callDurationSeconds: 0,

    initAudio() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.audioCtx = new AudioContext();
            }
        }
    },

    playRingBeep() {
        if (!this.audioCtx) return;
        try {
            const osc1 = this.audioCtx.createOscillator();
            const osc2 = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc1.type = 'sine';
            osc2.type = 'sine';
            osc1.frequency.setValueAtTime(440, this.audioCtx.currentTime);
            osc2.frequency.setValueAtTime(480, this.audioCtx.currentTime);

            gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc1.start();
            osc2.start();

            // Ring for 1.8 seconds then stop
            setTimeout(() => {
                try {
                    osc1.stop();
                    osc2.stop();
                } catch(e){}
            }, 1800);
        } catch (e) {
            console.warn('Audio ringtone error:', e);
        }
    },

    schedule(callerName = 'Mom', delaySeconds = 5) {
        API.toast(`Fake call from "${callerName}" scheduled in ${delaySeconds} seconds.`, 'info');
        setTimeout(() => {
            this.trigger(callerName);
        }, delaySeconds * 1000);
    },

    trigger(callerName = 'Mom') {
        this.initAudio();
        const overlay = document.getElementById('fake-call-modal');
        const callerEl = document.getElementById('fake-caller-name');
        const statusEl = document.getElementById('fake-call-status');

        if (!overlay) return;

        callerEl.textContent = callerName;
        statusEl.textContent = 'Incoming Call...';
        overlay.style.display = 'flex';

        // Play initial ring
        this.playRingBeep();
        if (navigator.vibrate) {
            navigator.vibrate([400, 200, 400, 1000]);
        }

        // Loop ring every 3 seconds
        this.ringInterval = setInterval(() => {
            this.playRingBeep();
            if (navigator.vibrate) {
                navigator.vibrate([400, 200, 400, 1000]);
            }
        }, 3000);
    },

    accept() {
        clearInterval(this.ringInterval);
        const statusEl = document.getElementById('fake-call-status');
        const actionsEl = document.querySelector('.fake-call-actions');
        
        statusEl.textContent = '00:00';
        this.callDurationSeconds = 0;

        // Change actions to single End Call button
        actionsEl.innerHTML = `
            <button class="call-btn call-btn-decline" onclick="FakeCall.dismiss()" title="End Call">
                📞
            </button>
        `;

        this.callDurationInterval = setInterval(() => {
            this.callDurationSeconds++;
            const mins = String(Math.floor(this.callDurationSeconds / 60)).padStart(2, '0');
            const secs = String(this.callDurationSeconds % 60).padStart(2, '0');
            statusEl.textContent = `${mins}:${secs}`;
        }, 1000);
    },

    dismiss() {
        clearInterval(this.ringInterval);
        clearInterval(this.callDurationInterval);
        if (navigator.vibrate) {
            navigator.vibrate(0);
        }

        const overlay = document.getElementById('fake-call-modal');
        if (overlay) {
            overlay.style.display = 'none';
        }

        // Reset actions buttons for next time
        const actionsEl = document.querySelector('.fake-call-actions');
        if (actionsEl) {
            actionsEl.innerHTML = `
                <button class="call-btn call-btn-decline" onclick="FakeCall.dismiss()" title="Decline">
                    ✕
                </button>
                <button class="call-btn call-btn-accept" onclick="FakeCall.accept()" title="Answer">
                    📞
                </button>
            `;
        }
    }
};
