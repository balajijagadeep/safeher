/**
 * SafeHer Public Real-Time Map Tracker
 * Works WITHOUT login for family, friends, and responders!
 */

let map = null;
let victimMarker = null;
let pathPolyline = null;
let breadcrumbCoords = [];

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const alertId = urlParams.get('alert');

    // Initialize Leaflet Map
    map = L.map('live-map').setView([17.4156, 78.4350], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    pathPolyline = L.polyline([], { color: '#7c3aed', weight: 4, opacity: 0.8, dashArray: '6, 8' }).addTo(map);

    const socket = initSocket();

    if (token) {
        // Track Shared Trip
        loadTripData(token);
        if (socket) {
            socket.emit('trip:join', token);
            socket.on('trip:location_update', (data) => {
                updateLocationPoint(data.lat, data.lng, data.speed, data.battery);
            });
            socket.on('trip:completed', () => {
                document.getElementById('tracking-status-badge').className = 'badge badge-success';
                document.getElementById('tracking-status-badge').textContent = 'TRIP COMPLETED SAFELY';
                alert('Trip completed! The user has reached their destination safely.');
            });
        }
    } else if (alertId) {
        // Track Emergency SOS Alert
        loadAlertData(alertId);
        if (socket) {
            socket.emit('alert:join', alertId);
            socket.on('location:update', (data) => {
                updateLocationPoint(data.lat, data.lng, data.speed, data.battery);
            });
            socket.on('alert:resolved', () => {
                document.getElementById('tracking-status-badge').className = 'badge badge-success';
                document.getElementById('tracking-status-badge').textContent = 'ALERT RESOLVED';
                alert('This emergency alert has been resolved and marked safe.');
            });
        }
    } else {
        alert('Invalid tracking link. Please check your SMS or shared message.');
    }
});

async function loadTripData(token) {
    try {
        const res = await fetch(`/api/trips/track/${token}`).then(r => r.json());
        if (!res.success) throw new Error(res.message);

        const trip = res.trip;
        document.getElementById('victim-name').textContent = trip.victimName;
        document.getElementById('trip-destination').textContent = `To: ${trip.destination || 'Destination'}`;
        document.getElementById('battery-status').textContent = `Battery: ${trip.battery}%`;
        document.getElementById('speed-status').textContent = `Speed: ${trip.speed} km/h`;

        const badge = document.getElementById('tracking-status-badge');
        if (trip.status === 'completed') {
            badge.className = 'badge badge-success';
            badge.textContent = 'REACHED SAFELY';
        } else if (trip.isExpired) {
            badge.className = 'badge badge-warning';
            badge.textContent = 'EXPIRED';
        } else {
            badge.className = 'badge badge-danger';
            badge.textContent = '● LIVE TRACKING';
        }

        // Draw initial breadcrumbs
        if (res.breadcrumbs && res.breadcrumbs.length > 0) {
            breadcrumbCoords = res.breadcrumbs.map(b => [b.lat, b.lng]);
            pathPolyline.setLatLngs(breadcrumbCoords);
        }

        updateLocationPoint(trip.currentLat, trip.currentLng, trip.speed, trip.battery);
    } catch (err) {
        console.error('Failed to load trip:', err);
        document.getElementById('victim-name').textContent = 'Tracking link inactive or expired';
    }
}

async function loadAlertData(alertId) {
    try {
        const res = await fetch(`/api/alerts/${alertId}`).then(r => r.json());
        if (!res.success) throw new Error(res.message);

        const alert = res.alert;
        document.getElementById('victim-name').textContent = `🚨 ${alert.victim_name} (SOS ALERT)`;
        document.getElementById('trip-destination').textContent = `Trigger: ${alert.trigger_type.toUpperCase()} • Blood Group: ${alert.blood_group || 'N/A'}`;
        document.getElementById('battery-status').textContent = `Battery: ${alert.battery_pct}%`;

        const badge = document.getElementById('tracking-status-badge');
        badge.className = 'badge badge-danger';
        badge.textContent = `EMERGENCY: ${alert.status.toUpperCase()}`;

        if (res.breadcrumbs && res.breadcrumbs.length > 0) {
            breadcrumbCoords = res.breadcrumbs.map(b => [b.lat, b.lng]);
            pathPolyline.setLatLngs(breadcrumbCoords);
        }

        updateLocationPoint(alert.lat, alert.lng, 0, alert.battery_pct);
    } catch (err) {
        console.error('Failed to load alert:', err);
    }
}

function updateLocationPoint(lat, lng, speed = 0, battery = 100) {
    const latLng = [lat, lng];
    breadcrumbCoords.push(latLng);
    pathPolyline.setLatLngs(breadcrumbCoords);

    if (!victimMarker) {
        const pulsingIcon = L.divIcon({
            html: `
                <div style="position:relative; width:28px; height:28px;">
                    <div style="position:absolute; width:28px; height:28px; background:rgba(239,68,68,0.4); border-radius:50%; animation:sosPulse 1.5s infinite;"></div>
                    <div style="position:absolute; top:4px; left:4px; width:20px; height:20px; background:#ef4444; border:3px solid white; border-radius:50%; box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>
                </div>
            `,
            className: ''
        });

        victimMarker = L.marker(latLng, { icon: pulsingIcon }).addTo(map);
        victimMarker.bindPopup(`<strong>Live Position</strong><br>Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);
    } else {
        victimMarker.setLatLng(latLng);
    }

    map.panTo(latLng);

    if (speed !== undefined) {
        const speedEl = document.getElementById('speed-status');
        if (speedEl) speedEl.textContent = `Speed: ${speed} km/h`;
    }
    if (battery !== undefined) {
        const batEl = document.getElementById('battery-status');
        if (batEl) batEl.textContent = `Battery: ${battery}%`;
    }
}
