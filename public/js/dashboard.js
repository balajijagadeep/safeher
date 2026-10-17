/**
 * SafeHer User Dashboard Logic
 */

let userLocation = { lat: 17.4156, lng: 78.4350 }; // Default Hyderabad
let sosCountdownInterval = null;
let sosRemainingSeconds = 5;
let activeAlertId = null;
let activeTripData = null;
let checkinCountdownInterval = null;
let nearbyMap = null;
let nearbyMarkersLayer = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check Authentication
    const token = API.getToken();
    const user = API.getUser();
    if (!token || !user) {
        window.location.href = '/auth.html';
        return;
    }

    // Set user headers
    document.getElementById('nav-user-name').textContent = user.name;
    document.getElementById('nav-user-role').textContent = user.role.toUpperCase();

    // Init Socket
    const socket = initSocket();
    if (socket) {
        socket.emit('responder:join', 'user');
    }

    // Detect GPS Location
    detectLocation();

    // Init Theme & Language
    const savedTheme = localStorage.getItem('safeher_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    I18N.applyToDOM();

    // Load Sections Data
    loadContacts();
    loadDevices();
    checkActiveTrip();
    checkActiveDeadmanTimer();
    loadSafetyScore();
    loadTravelGuide();

    // Voice & Shake Initializers
    VoiceShake.initVoice((type) => startSOSSequence(type));
});

function detectLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                userLocation.lat = pos.coords.latitude;
                userLocation.lng = pos.coords.longitude;
                console.log('[SafeHer GPS]', userLocation);
                loadSafetyScore();
            },
            (err) => {
                console.warn('Geolocation denied or unavailable. Using demo center coordinates.');
            },
            { enableHighAccuracy: true, timeout: 8000 }
        );
    }
}

// ========================================================
// 1. SOS ACTIVATION & 5-SECOND CANCEL COUNTDOWN
// ========================================================
function onSOSTap() {
    startSOSSequence('sos');
}

function startSOSSequence(triggerType = 'sos') {
    const modal = document.getElementById('sos-countdown-modal');
    const circle = document.getElementById('countdown-number');
    modal.classList.add('active');

    sosRemainingSeconds = 5;
    circle.textContent = sosRemainingSeconds;

    // Beep sound using Web Audio API
    playCountdownBeep(600);

    clearInterval(sosCountdownInterval);
    sosCountdownInterval = setInterval(() => {
        sosRemainingSeconds--;
        circle.textContent = sosRemainingSeconds;
        playCountdownBeep(700 + (5 - sosRemainingSeconds) * 80);

        if (sosRemainingSeconds <= 0) {
            clearInterval(sosCountdownInterval);
            dispatchSOSAlert(triggerType);
        }
    }, 1000);
}

function cancelSOSCountdown() {
    clearInterval(sosCountdownInterval);
    const modal = document.getElementById('sos-countdown-modal');
    modal.classList.remove('active');
    API.toast('SOS alert canceled. Stay safe!', 'success');
}

function instantSOSDispatch() {
    clearInterval(sosCountdownInterval);
    dispatchSOSAlert('sos');
}

async function dispatchSOSAlert(triggerType) {
    const modal = document.getElementById('sos-countdown-modal');
    modal.classList.remove('active');

    try {
        const res = await API.request('/api/alerts/sos', {
            method: 'POST',
            body: JSON.stringify({
                lat: userLocation.lat,
                lng: userLocation.lng,
                trigger_type: triggerType,
                address: 'Near current location'
            })
        });

        activeAlertId = res.alertId;
        API.toast('🚨 EMERGENCY ALERT SENT TO CONTACTS, POLICE & HOSPITAL!', 'danger');

        // Start Silent Audio Evidence recording if mic enabled
        VoiceShake.startSilentEvidenceRecording(res.alertId, 20);

        // Show active SOS banner
        showActiveSOSBanner(res.alertId);
    } catch (err) {
        API.toast('SOS dispatch error: ' + err.message, 'danger');
    }
}

function showActiveSOSBanner(alertId) {
    let banner = document.getElementById('active-sos-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'active-sos-banner';
        banner.style.background = '#dc2626';
        banner.style.color = '#fff';
        banner.style.padding = '16px';
        banner.style.textAlign = 'center';
        banner.style.borderRadius = '12px';
        banner.style.margin = '20px 0';
        banner.style.fontWeight = 'bold';
        banner.style.boxShadow = '0 0 25px rgba(239,68,68,0.5)';
        document.querySelector('.container').prepend(banner);
    }

    banner.innerHTML = `
        <div style="font-size:18px; margin-bottom:8px;">🚨 ACTIVE SOS IN PROGRESS (ID: ${alertId})</div>
        <p style="font-size:13px; font-weight:normal; margin-bottom:12px;">Alert dispatched. Responders can track your live location. Micro-escalation timers running.</p>
        <button class="btn btn-secondary" onclick="markSOSSafe('${alertId}')" style="background:#fff; color:#dc2626; font-weight:700;">
            ✅ I Am Safe Now (Resolve Alert)
        </button>
    `;
}

async function markSOSSafe(alertId) {
    try {
        await API.request(`/api/alerts/${alertId}/resolve`, { method: 'POST' });
        API.toast('Alert marked resolved. Your contacts and dispatch have been notified.', 'success');
        const banner = document.getElementById('active-sos-banner');
        if (banner) banner.remove();
    } catch (err) {
        API.toast('Error resolving alert: ' + err.message, 'danger');
    }
}

function playCountdownBeep(freq = 600) {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        gain.gain.value = 0.2;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        setTimeout(() => osc.stop(), 250);
    } catch (e) {}
}

// ========================================================
// 2. LIVE TRIP SHARING (/track/:token)
// ========================================================
async function startShareTrip() {
    const dest = prompt('Enter your destination (e.g. Inorbit Mall, Hitec City):', 'Home');
    if (!dest) return;

    try {
        const res = await API.request('/api/trips/start', {
            method: 'POST',
            body: JSON.stringify({
                start_lat: userLocation.lat,
                start_lng: userLocation.lng,
                destination: dest,
                duration_hours: 2
            })
        });

        const fullUrl = `${window.location.origin}${res.shareUrl}`;
        activeTripData = res;

        // Display modal with shareable link
        document.getElementById('trip-share-link').value = fullUrl;
        document.getElementById('trip-wa-btn').href = `https://api.whatsapp.com/send?text=${encodeURIComponent('Track my live trip on SafeHer: ' + fullUrl)}`;
        document.getElementById('trip-modal').classList.add('active');

        API.toast('Live trip active! Share link with loved ones.', 'success');
        renderActiveTripCard(res);
    } catch (err) {
        API.toast('Could not start trip: ' + err.message, 'danger');
    }
}

function copyTripLink() {
    const input = document.getElementById('trip-share-link');
    input.select();
    navigator.clipboard.writeText(input.value);
    API.toast('Tracking link copied to clipboard!', 'success');
}

async function checkActiveTrip() {
    try {
        const res = await API.request('/api/trips/active');
        if (res.trip) {
            renderActiveTripCard(res.trip);
        }
    } catch (e) {}
}

function renderActiveTripCard(trip) {
    const container = document.getElementById('active-trip-status-card');
    if (!container) return;
    container.style.display = 'block';
    container.innerHTML = `
        <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:16px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:gap;">
            <div>
                <span class="badge badge-success">● TRIP IN PROGRESS</span>
                <h4 style="margin:6px 0 2px;">Destination: ${trip.destination || 'Ongoing Trip'}</h4>
                <p style="font-size:12px; color:var(--text-muted);">Family can view live coordinates without login</p>
            </div>
            <div style="display:flex; gap:8px;">
                <a href="/track.html?token=${trip.share_token || trip.shareToken}" target="_blank" class="btn btn-outline" style="font-size:12px;">
                    👁️ View Map
                </a>
                <button class="btn btn-primary" onclick="endCurrentTrip('${trip.id}')" style="font-size:12px;">
                    🏁 Reached Safely
                </button>
            </div>
        </div>
    `;
}

async function endCurrentTrip(tripId) {
    try {
        await API.request(`/api/trips/${tripId}/complete`, { method: 'POST' });
        API.toast('Trip concluded safely! Tracking link deactivated.', 'success');
        document.getElementById('active-trip-status-card').style.display = 'none';
    } catch (err) {
        API.toast('Error ending trip: ' + err.message, 'danger');
    }
}

// ========================================================
// 3. DEAD-MAN'S SAFETY CHECK-IN SWITCH
// ========================================================
async function scheduleCheckinTimer() {
    const mins = prompt('I will reach in how many minutes?', '30');
    if (!mins || isNaN(mins)) return;

    try {
        const res = await API.request('/api/safety/checkin', {
            method: 'POST',
            body: JSON.stringify({
                minutes: parseInt(mins, 10),
                destination: 'Destination',
                lat: userLocation.lat,
                lng: userLocation.lng
            })
        });

        API.toast(res.message, 'success');
        renderActiveDeadmanCard(res.checkinId, res.expectedReachTime);
    } catch (err) {
        API.toast('Error scheduling checkin: ' + err.message, 'danger');
    }
}

async function checkActiveDeadmanTimer() {
    try {
        const res = await API.request('/api/safety/checkin/active');
        if (res.checkin) {
            renderActiveDeadmanCard(res.checkin.id, res.checkin.expected_reach_time);
        }
    } catch (e) {}
}

function renderActiveDeadmanCard(checkinId, reachTimeStr) {
    const container = document.getElementById('deadman-status-card');
    if (!container) return;
    container.style.display = 'block';

    const targetTime = new Date(reachTimeStr).getTime();

    clearInterval(checkinCountdownInterval);
    checkinCountdownInterval = setInterval(() => {
        const now = Date.now();
        const diff = targetTime - now;

        if (diff <= 0) {
            clearInterval(checkinCountdownInterval);
            container.innerHTML = `<span class="badge badge-danger">CHECK-IN EXPIRED - SOS AUTOMATICALLY FIRED</span>`;
            return;
        }

        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);

        container.innerHTML = `
            <div style="background:var(--bg-card); border:1px solid #f59e0b; border-radius:var(--radius-md); padding:16px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <span class="badge badge-warning">⏳ DEAD-MAN SWITCH ACTIVE</span>
                    <h4 style="margin:4px 0;">Time remaining: <strong>${m}m ${s}s</strong></h4>
                    <p style="font-size:12px; color:var(--text-muted);">If not safe before timer ends, automated SOS will trigger</p>
                </div>
                <button class="btn btn-success" onclick="confirmCheckinSafe('${checkinId}')" style="background:#10b981; color:#fff;">
                    🛡️ I'm Safe (Cancel)
                </button>
            </div>
        `;
    }, 1000);
}

async function confirmCheckinSafe(checkinId) {
    try {
        await API.request(`/api/safety/checkin/${checkinId}/safe`, { method: 'POST' });
        API.toast('Confirmed safe! Timer cancelled.', 'success');
        clearInterval(checkinCountdownInterval);
        document.getElementById('deadman-status-card').style.display = 'none';
    } catch (err) {
        API.toast('Error: ' + err.message, 'danger');
    }
}

// ========================================================
// 4. TRUSTED CONTACTS
// ========================================================
async function loadContacts() {
    try {
        const res = await API.request('/api/contacts');
        const list = document.getElementById('contacts-list');
        if (!list) return;

        if (res.contacts.length === 0) {
            list.innerHTML = `<p style="font-size:13px; color:var(--text-muted); padding:10px 0;">No contacts added yet. Add family or friends who should receive your emergency alerts.</p>`;
            return;
        }

        list.innerHTML = res.contacts.map(c => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid var(--border-color);">
                <div>
                    <strong>${c.name}</strong> <span style="font-size:12px; color:var(--text-muted);">(${c.relationship})</span>
                    <div style="font-size:12px; color:var(--text-secondary);">${c.phone}</div>
                </div>
                <button onclick="deleteContact('${c.id}')" style="background:none; color:var(--sos-red); font-size:16px;" title="Remove contact">
                    🗑️
                </button>
            </div>
        `).join('');
    } catch (err) {
        console.warn('Error loading contacts:', err);
    }
}

async function addNewContactPrompt() {
    const name = prompt('Contact Name:');
    if (!name) return;
    const phone = prompt('Mobile Phone Number (with +91 or country code):');
    if (!phone) return;
    const relationship = prompt('Relationship (e.g. Father, Sister, Roommate):', 'Family');

    try {
        await API.request('/api/contacts', {
            method: 'POST',
            body: JSON.stringify({ name, phone, relationship, priority: 1 })
        });
        API.toast('Trusted contact added!', 'success');
        loadContacts();
    } catch (err) {
        API.toast(err.message, 'danger');
    }
}

async function deleteContact(id) {
    if (!confirm('Remove this emergency contact?')) return;
    try {
        await API.request(`/api/contacts/${id}`, { method: 'DELETE' });
        API.toast('Contact removed.', 'info');
        loadContacts();
    } catch (err) {
        API.toast(err.message, 'danger');
    }
}

// ========================================================
// 5. WEARABLE IOT DEVICES
// ========================================================
async function loadDevices() {
    try {
        const res = await API.request('/api/devices');
        const list = document.getElementById('devices-list');
        if (!list) return;

        if (res.devices.length === 0) {
            list.innerHTML = `<p style="font-size:13px; color:var(--text-muted); padding:10px 0;">No wearable devices paired. Pair a smartband, watch, or pendant.</p>`;
            return;
        }

        list.innerHTML = res.devices.map(d => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-sm); margin-bottom:8px;">
                <div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <strong>${d.device_name}</strong>
                        <span class="badge ${d.status === 'online' ? 'badge-success' : 'badge-warning'}">${d.status.toUpperCase()}</span>
                    </div>
                    <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                        ID: <code>${d.device_id}</code> | Type: ${d.type} | Battery: ${d.battery_pct}%
                    </div>
                </div>
                <button class="btn btn-outline" onclick="showDeviceKey('${d.device_id}', '${d.api_key}')" style="font-size:11px; padding:6px 10px;">
                    🔑 API Key
                </button>
            </div>
        `).join('');
    } catch (e) {}
}

function showDeviceKey(devId, key) {
    prompt(`Secret Hardware API Key for ${devId} (Use in ESP32 / Arduino / Simulator):`, key);
}

async function pairNewDevicePrompt() {
    const name = prompt('Device Name (e.g., SafeHer Smart Watch, Safety Ring):');
    if (!name) return;
    const type = prompt('Type (watch / earring / band / pendant):', 'watch');

    try {
        const res = await API.request('/api/devices', {
            method: 'POST',
            body: JSON.stringify({ device_name: name, type })
        });
        API.toast('Wearable paired successfully!', 'success');
        prompt('Your Wearable Secret API Key (save into hardware):', res.device.api_key);
        loadDevices();
    } catch (err) {
        API.toast(err.message, 'danger');
    }
}

// ========================================================
// 6. AI AREA SAFETY SCORE GAUGE
// ========================================================
async function loadSafetyScore() {
    try {
        const res = await API.request(`/api/safety/score?lat=${userLocation.lat}&lng=${userLocation.lng}`);
        const assess = res.assessment;

        const scoreEl = document.getElementById('ai-score-number');
        const gaugeEl = document.getElementById('ai-score-gauge');
        const factorsEl = document.getElementById('ai-score-factors');

        if (scoreEl) scoreEl.textContent = assess.score;
        if (gaugeEl) {
            gaugeEl.style.borderColor = assess.color;
            gaugeEl.style.color = assess.color;
        }

        if (factorsEl) {
            factorsEl.innerHTML = assess.factors.map(f => `
                <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:6px; border-bottom:1px dashed var(--border-color); padding-bottom:4px;">
                    <span>${f.factor}: <small style="color:var(--text-muted);">${f.description}</small></span>
                    <strong style="color:${f.impact < 0 ? 'var(--sos-red)' : 'var(--success)'};">${f.impact > 0 ? '+' : ''}${f.impact}</strong>
                </div>
            `).join('');
        }
    } catch (e) {}
}

// ========================================================
// 7. NEARBY HELP FINDER (Leaflet Map)
// ========================================================
async function initNearbyHelpMap() {
    const modal = document.getElementById('nearby-map-modal');
    modal.classList.add('active');

    setTimeout(async () => {
        if (!nearbyMap) {
            nearbyMap = L.map('nearby-map-container').setView([userLocation.lat, userLocation.lng], 14);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap'
            }).addTo(nearbyMap);
            nearbyMarkersLayer = L.layerGroup().addTo(nearbyMap);
        } else {
            nearbyMap.invalidateSize();
            nearbyMap.setView([userLocation.lat, userLocation.lng], 14);
        }

        nearbyMarkersLayer.clearLayers();

        // Victim / User Marker
        const userIcon = L.divIcon({
            html: '<div style="background:#7c3aed; width:16px; height:16px; border-radius:50%; border:3px solid white; box-shadow:0 0 10px rgba(124,58,237,0.8);"></div>',
            className: ''
        });
        L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(nearbyMarkersLayer)
            .bindPopup('<strong>📍 You are here</strong>').openPopup();

        // Fetch nearby services
        try {
            const res = await API.request(`/api/safety/nearby?lat=${userLocation.lat}&lng=${userLocation.lng}`);
            res.services.forEach(s => {
                const iconChar = s.type === 'police' ? '👮' : s.type === 'hospital' ? '🏥' : '💊';
                const srvMarker = L.marker([s.lat, s.lng]).addTo(nearbyMarkersLayer);
                srvMarker.bindPopup(`
                    <div style="font-size:13px;">
                        <strong>${iconChar} ${s.name}</strong><br>
                        <span style="color:#64748b;">Distance: ${s.distanceKm} km | Phone: ${s.phone}</span><br>
                        <a href="https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}" target="_blank" style="display:inline-block; margin-top:6px; color:#7c3aed; font-weight:600;">
                            🧭 Open GPS Navigation
                        </a>
                    </div>
                `);
            });
        } catch (e) {}
    }, 200);
}

// ========================================================
// 8. SAFE ROUTE COMPARISON
// ========================================================
async function openSafeRouteModal() {
    const modal = document.getElementById('safe-route-modal');
    modal.classList.add('active');

    // Default route query: ~2km destination from current position
    try {
        const res = await API.request('/api/safety/routes', {
            method: 'POST',
            body: JSON.stringify({
                startLat: userLocation.lat,
                startLng: userLocation.lng,
                endLat: userLocation.lat + 0.018,
                endLng: userLocation.lng + 0.015
            })
        });

        const list = document.getElementById('routes-list');
        list.innerHTML = res.routes.map(r => `
            <div style="background:var(--bg-card); border:${r.isRecommended ? '2px solid #10b981' : '1px solid var(--border-color)'}; border-radius:var(--radius-sm); padding:14px; margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        ${r.isRecommended ? '<span class="badge badge-success">⭐ SAFEST RECOMMENDED</span>' : '<span class="badge badge-info">ALTERNATIVE</span>'}
                        <h4 style="margin:4px 0;">${r.name}</h4>
                        <div style="font-size:12px; color:var(--text-muted);">
                            Distance: ${r.distanceKm} km • Est: ${r.estMinutes} mins • Lighting: <strong>${r.lightingStatus}</strong>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:22px; font-weight:800; color:${r.safetyScore > 75 ? '#10b981' : '#f59e0b'};">
                            ${r.safetyScore}
                        </div>
                        <div style="font-size:10px; color:var(--text-muted);">SAFETY INDEX</div>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (e) {}
}

// ========================================================
// 9. COMMUNITY HAZARD REPORTING
// ========================================================
function openIncidentModal() {
    document.getElementById('incident-modal').classList.add('active');
}

async function submitIncidentReport() {
    const category = document.getElementById('incident-category').value;
    const address = document.getElementById('incident-address').value;
    const desc = document.getElementById('incident-desc').value;

    try {
        await API.request('/api/incidents', {
            method: 'POST',
            body: JSON.stringify({
                category,
                lat: userLocation.lat,
                lng: userLocation.lng,
                address,
                description: desc
            })
        });

        API.toast('Hazard report saved anonymously. This feeds the AI Safety Score.', 'success');
        document.getElementById('incident-modal').classList.remove('active');
        loadSafetyScore();
    } catch (err) {
        API.toast(err.message, 'danger');
    }
}

// ========================================================
// 10. TRAVEL GUIDE & EMERGENCY NUMBERS
// ========================================================
async function loadTravelGuide() {
    try {
        const res = await API.request('/api/safety/travel-guide?city=Hyderabad');
        const guide = res.guide;

        const numbersEl = document.getElementById('emergency-numbers-strip');
        if (numbersEl) {
            numbersEl.innerHTML = guide.emergencyNumbers.map(n => `
                <a href="tel:${n.number}" class="badge badge-danger" style="padding:6px 12px; text-decoration:none; font-size:12px;">
                    ${n.icon} ${n.service}: <strong>${n.number}</strong>
                </a>
            `).join('');
        }
    } catch (e) {}
}

// UI Helpers
function toggleDarkMode() {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('safeher_theme', next);
}

function changeLanguage(lang) {
    I18N.setLanguage(lang);
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}
