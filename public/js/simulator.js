/**
 * SafeHer IoT Wearable Hardware Simulator (Interactive Judge Demo)
 */

let simulationMovingInterval = null;
let currentSimLat = 17.4156;
let currentSimLng = 78.4350;
let simulatedAlertId = null;

document.addEventListener('DOMContentLoaded', () => {
    initSocket();
});

function logEvent(message, isError = false) {
    const consoleEl = document.getElementById('simulator-console');
    const time = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.style.color = isError ? '#f87171' : '#38bdf8';
    line.style.marginBottom = '4px';
    line.textContent = `[${time}] ${message}`;
    consoleEl.prepend(line);
}

async function triggerWearableSimulation(type) {
    const deviceId = document.getElementById('sim-device-id').value;
    const apiKey = document.getElementById('sim-api-key').value;

    logEvent(`📡 Dispatching Wearable Signal: [${type.toUpperCase()}] for ${deviceId}...`);

    try {
        const response = await fetch('/api/device/alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deviceId,
                apiKey,
                lat: currentSimLat,
                lng: currentSimLng,
                type
            })
        });

        const data = await response.json();

        if (response.ok) {
            logEvent(`✅ SUCCESS! Server responded: ${data.message}`);
            if (data.alertId) {
                simulatedAlertId = data.alertId;
                document.getElementById('sim-active-alert-box').style.display = 'block';
                document.getElementById('sim-alert-id').textContent = data.alertId;
                document.getElementById('sim-track-btn').href = `/track.html?alert=${data.alertId}`;
            }
        } else {
            logEvent(`❌ FAILED: ${data.message}`, true);
        }
    } catch (err) {
        logEvent(`❌ Network Error: ${err.message}`, true);
    }
}

function startMovingGPSSimulator() {
    if (simulationMovingInterval) {
        clearInterval(simulationMovingInterval);
        simulationMovingInterval = null;
        document.getElementById('btn-moving-gps').textContent = '🚶 Start Live Moving GPS Walker';
        logEvent('⏹️ GPS movement simulation stopped.');
        return;
    }

    if (!simulatedAlertId) {
        alert('Please trigger a Wearable SOS or Fall Detection first so there is an active alert to move!');
        return;
    }

    document.getElementById('btn-moving-gps').textContent = '⏸️ Stop Moving GPS Walker';
    logEvent('🚀 Live GPS telemetry walker started! Moving coordinates along road...');

    let step = 0;
    simulationMovingInterval = setInterval(async () => {
        step++;
        currentSimLat += (Math.random() - 0.4) * 0.0008;
        currentSimLng += (Math.random() - 0.3) * 0.0008;

        const speed = Math.round(25 + Math.random() * 15); // Driving/auto speed
        const battery = Math.max(10, 94 - step);

        try {
            await fetch(`/api/alerts/${simulatedAlertId}/location`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lat: currentSimLat,
                    lng: currentSimLng,
                    speed,
                    battery
                })
            });

            logEvent(`📍 Telemetry Pushed: (${currentSimLat.toFixed(4)}, ${currentSimLng.toFixed(4)}) • Speed: ${speed} km/h • Battery: ${battery}%`);
        } catch (e) {
            logEvent('Error posting telemetry: ' + e.message, true);
        }
    }, 2500);
}
