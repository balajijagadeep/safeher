/**
 * SafeHer Socket.IO Client Wrapper
 */

let socket = null;

function initSocket() {
    if (typeof io === 'undefined') {
        console.warn('Socket.IO library not loaded yet.');
        return null;
    }

    if (!socket) {
        socket = io();

        socket.on('connect', () => {
            console.log('[SafeHer Socket] Connected to real-time engine:', socket.id);
        });

        // Listen for simulated notifications (SMS / Calls)
        socket.on('notification:simulated', (notif) => {
            console.log('[SafeHer Socket] Simulated SMS received:', notif);
            showSimulatedSMSBanner(notif);
        });
    }

    return socket;
}

function showSimulatedSMSBanner(notif) {
    let feed = document.getElementById('sms-simulation-feed');
    if (!feed) {
        feed = document.createElement('div');
        feed.id = 'sms-simulation-feed';
        feed.style.position = 'fixed';
        feed.style.bottom = '20px';
        feed.style.right = '20px';
        feed.style.zIndex = '9998';
        feed.style.maxWidth = '360px';
        feed.style.display = 'flex';
        feed.style.flexDirection = 'column';
        feed.style.gap = '10px';
        document.body.appendChild(feed);
    }

    const card = document.createElement('div');
    card.style.background = '#1e293b';
    card.style.color = '#ffffff';
    card.style.borderRadius = '12px';
    card.style.padding = '14px 16px';
    card.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)';
    card.style.borderLeft = '5px solid #ef4444';
    card.style.fontSize = '13px';
    card.style.animation = 'toastSlide 0.3s ease-out';

    card.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-weight:700; color:#f87171;">
            <span>📱 SIMULATED SMS ALERT</span>
            <span style="font-size:10px; color:#94a3b8;">${new Date().toLocaleTimeString()}</span>
        </div>
        <div style="font-size:11px; color:#cbd5e1; margin-bottom:6px;">
            To: <strong>${notif.recipientName}</strong> (${notif.recipientPhone})
        </div>
        <div style="background:#0f172a; padding:8px; border-radius:6px; font-family:monospace; font-size:11px; white-space:pre-wrap; color:#38bdf8;">${notif.messageBody}</div>
    `;

    feed.prepend(card);

    setTimeout(() => {
        card.style.opacity = '0';
        setTimeout(() => card.remove(), 400);
    }, 8000);
}
