/**
 * SafeHer Responder Command Center (Police / Hospital / Contact)
 */

let responderMap = null;
let alertMarkers = new Map();
let currentRole = 'police';

document.addEventListener('DOMContentLoaded', async () => {
    const token = API.getToken();
    const user = API.getUser();

    if (!token || !user) {
        window.location.href = '/auth.html';
        return;
    }

    currentRole = user.role;
    document.getElementById('responder-name').textContent = user.name;
    document.getElementById('responder-role-badge').textContent = user.role.toUpperCase();

    // Init Map
    responderMap = L.map('responder-map').setView([17.4156, 78.4350], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(responderMap);

    // Socket.IO Room
    const socket = initSocket();
    if (socket) {
        socket.emit('responder:join', user.role);

        socket.on('alert:created', (data) => {
            API.toast(`🚨 NEW INCOMING ALERT: ${data.alert.victim_name}`, 'danger');
            loadActiveAlerts();
            playEmergencySiren();
        });

        socket.on('alert:escalated', (data) => {
            API.toast(`⚠️ ALERT ESCALATED TO ${data.stage.toUpperCase()}: ${data.recipient}`, 'warning');
            loadActiveAlerts();
        });

        socket.on('alert:acknowledged', (data) => {
            API.toast(`Alert acknowledged by ${data.responderName}`, 'info');
            loadActiveAlerts();
        });

        socket.on('alert:resolved', () => {
            API.toast(`Alert marked resolved.`, 'success');
            loadActiveAlerts();
        });

        socket.on('alert:evidence_uploaded', (data) => {
            API.toast(`🎙️ Silent audio evidence uploaded for alert ${data.alertId}`, 'info');
            loadActiveAlerts();
        });
    }

    loadActiveAlerts();
    setInterval(loadActiveAlerts, 15000); // Polling backup
});

async function loadActiveAlerts() {
    try {
        const res = await API.request('/api/alerts/active');
        const container = document.getElementById('active-alerts-feed');
        const countBadge = document.getElementById('active-count');
        
        countBadge.textContent = res.alerts.length;

        if (res.alerts.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:40px; color:var(--text-muted);">
                    <div style="font-size:36px; margin-bottom:8px;">🛡️</div>
                    <strong>No Active Emergency Alerts</strong>
                    <p style="font-size:12px; margin-top:4px;">All sectors normal. Ready to dispatch on incoming signal.</p>
                </div>
            `;
            // Clear markers
            alertMarkers.forEach(m => m.remove());
            alertMarkers.clear();
            return;
        }

        container.innerHTML = res.alerts.map(a => renderAlertCard(a)).join('');
        updateMapMarkers(res.alerts);
    } catch (err) {
        console.error('Failed to load active alerts:', err);
    }
}

function renderAlertCard(alert) {
    const isEscalated = alert.status.includes('escalated');
    const isAck = alert.status === 'acknowledged';

    return `
        <div style="background:var(--bg-card); border-left:5px solid ${isAck ? '#10b981' : isEscalated ? '#ef4444' : '#f59e0b'}; border-radius:var(--radius-sm); padding:16px; margin-bottom:14px; box-shadow:var(--shadow-sm); border-top:1px solid var(--border-color); border-right:1px solid var(--border-color); border-bottom:1px solid var(--border-color);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                    <span class="badge ${isAck ? 'badge-success' : isEscalated ? 'badge-danger' : 'badge-warning'}">
                        ${alert.status.toUpperCase()}
                    </span>
                    <h3 style="margin:6px 0 2px; font-size:16px;">${alert.victim_name}</h3>
                    <div style="font-size:12px; color:var(--text-secondary);">
                        📞 <a href="tel:${alert.victim_phone}">${alert.victim_phone}</a> | Blood: <strong>${alert.blood_group || 'O+'}</strong>
                    </div>
                </div>
                <div style="font-size:11px; color:var(--text-muted);">
                    ${new Date(alert.created_at).toLocaleTimeString()}
                </div>
            </div>

            <div style="margin:10px 0; font-size:12px; background:var(--bg-main); padding:8px; border-radius:6px;">
                <strong>Medical Notes:</strong> ${alert.allergies || 'None'} • ${alert.emergency_note || 'None'}<br>
                <strong>Trigger:</strong> ${alert.trigger_type.toUpperCase()} • <strong>Coords:</strong> (${alert.lat.toFixed(4)}, ${alert.lng.toFixed(4)})
            </div>

            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
                <button class="btn btn-outline" onclick="focusOnAlert(${alert.lat}, ${alert.lng})" style="font-size:12px; padding:6px 12px;">
                    🎯 Center Map
                </button>
                <a href="/track.html?alert=${alert.id}" target="_blank" class="btn btn-outline" style="font-size:12px; padding:6px 12px;">
                    👁️ Full Tracker
                </a>
                ${!isAck ? `
                    <button class="btn btn-primary" onclick="acknowledgeAlertAction('${alert.id}')" style="font-size:12px; padding:6px 12px; background:#3b82f6;">
                        👮 Acknowledge & Dispatch
                    </button>
                ` : ''}
                <button class="btn btn-success" onclick="resolveAlertAction('${alert.id}')" style="font-size:12px; padding:6px 12px; background:#10b981; color:#fff;">
                    ✅ Resolve & Mark Safe
                </button>
            </div>
        </div>
    `;
}

function updateMapMarkers(alerts) {
    alertMarkers.forEach(m => m.remove());
    alertMarkers.clear();

    alerts.forEach(a => {
        const marker = L.marker([a.lat, a.lng]).addTo(responderMap);
        marker.bindPopup(`
            <strong>🚨 ${a.victim_name}</strong><br>
            Phone: ${a.victim_phone}<br>
            Status: ${a.status}<br>
            <button onclick="acknowledgeAlertAction('${a.id}')" style="margin-top:6px; padding:4px 8px; font-size:11px; background:#3b82f6; color:#fff; border-radius:4px;">Dispatch</button>
        `);
        alertMarkers.set(a.id, marker);
    });

    if (alerts.length > 0) {
        responderMap.setView([alerts[0].lat, alerts[0].lng], 14);
    }
}

function focusOnAlert(lat, lng) {
    responderMap.flyTo([lat, lng], 16);
}

async function acknowledgeAlertAction(alertId) {
    const note = prompt('Dispatch note (e.g., Patrol Unit 4 dispatched):', 'Patrol car dispatched to location.');
    try {
        await API.request(`/api/alerts/${alertId}/acknowledge`, {
            method: 'POST',
            body: JSON.stringify({ note })
        });
        API.toast('Alert acknowledged. Escalation sequence halted.', 'success');
        loadActiveAlerts();
    } catch (err) {
        API.toast(err.message, 'danger');
    }
}

async function resolveAlertAction(alertId) {
    if (!confirm('Mark this incident fully resolved and safe?')) return;
    try {
        await API.request(`/api/alerts/${alertId}/resolve`, { method: 'POST' });
        API.toast('Incident resolved and archived.', 'success');
        loadActiveAlerts();
    } catch (err) {
        API.toast(err.message, 'danger');
    }
}

function playEmergencySiren() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(500, ctx.currentTime + 0.4);
        gain.gain.value = 0.25;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        setTimeout(() => osc.stop(), 400);
    } catch(e){}
}
