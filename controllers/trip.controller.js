const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../db/database');

let ioInstance = null;
function setSocketIO(io) {
    ioInstance = io;
}

/**
 * Start a new live shared trip
 */
async function startTrip(req, res, next) {
    try {
        const { start_lat, start_lng, destination = 'Destination', duration_hours = 2 } = req.body;

        if (start_lat === undefined || start_lng === undefined) {
            return res.status(400).json({ success: false, message: 'Start coordinates are required.' });
        }

        const db = getDatabase();
        const tripId = 'trp-' + uuidv4().substring(0, 8);
        const shareToken = 'safe_' + uuidv4().replace(/-/g, '').substring(0, 16);

        const expiresAt = new Date(Date.now() + duration_hours * 60 * 60 * 1000).toISOString();

        db.prepare(`
            INSERT INTO trips (id, user_id, share_token, start_lat, start_lng, current_lat, current_lng, destination, status, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
        `).run(
            tripId,
            req.user.id,
            shareToken,
            parseFloat(start_lat),
            parseFloat(start_lng),
            parseFloat(start_lat),
            parseFloat(start_lng),
            destination,
            expiresAt
        );

        // Record first breadcrumb
        db.prepare(`
            INSERT INTO location_points (id, trip_id, lat, lng)
            VALUES (?, ?, ?, ?)
        `).run('loc-' + uuidv4().substring(0, 8), tripId, parseFloat(start_lat), parseFloat(start_lng));

        const shareUrl = `/track.html?token=${shareToken}`;

        res.status(201).json({
            success: true,
            message: 'Trip tracking activated!',
            tripId,
            shareToken,
            shareUrl,
            expiresAt
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Public Trip Tracking Data (No login needed for family/friends)
 */
async function getTripByToken(req, res, next) {
    try {
        const { token } = req.params;
        const db = getDatabase();

        const trip = db.prepare(`
            SELECT t.*, u.name as victim_name, u.phone as victim_phone
            FROM trips t
            JOIN users u ON t.user_id = u.id
            WHERE t.share_token = ?
        `).get(token);

        if (!trip) {
            return res.status(404).json({ success: false, message: 'Invalid or non-existent tracking link.' });
        }

        const breadcrumbs = db.prepare(`
            SELECT lat, lng, speed, battery, recorded_at
            FROM location_points
            WHERE trip_id = ?
            ORDER BY recorded_at ASC
        `).all(trip.id);

        res.json({
            success: true,
            trip: {
                id: trip.id,
                victimName: trip.victim_name,
                destination: trip.destination,
                status: trip.status,
                startLat: trip.start_lat,
                startLng: trip.start_lng,
                currentLat: trip.current_lat,
                currentLng: trip.current_lng,
                battery: trip.battery_pct,
                speed: trip.speed,
                startedAt: trip.started_at,
                expiresAt: trip.expires_at,
                isExpired: new Date(trip.expires_at) < new Date()
            },
            breadcrumbs
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Post live moving GPS updates during a trip
 */
async function updateTripLocation(req, res, next) {
    try {
        const { token } = req.params;
        const { lat, lng, speed = 0, battery = 100 } = req.body;

        const db = getDatabase();
        const trip = db.prepare('SELECT * FROM trips WHERE share_token = ?').get(token);

        if (!trip || trip.status !== 'active') {
            return res.status(404).json({ success: false, message: 'Trip is not active or token is invalid.' });
        }

        db.prepare(`
            UPDATE trips SET current_lat = ?, current_lng = ?, speed = ?, battery_pct = ? WHERE id = ?
        `).run(lat, lng, speed, battery, trip.id);

        const pointId = 'loc-' + uuidv4().substring(0, 8);
        db.prepare(`
            INSERT INTO location_points (id, trip_id, lat, lng, speed, battery)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(pointId, trip.id, lat, lng, speed, battery);

        if (ioInstance) {
            ioInstance.to(`trip:${token}`).emit('trip:location_update', {
                shareToken: token,
                lat,
                lng,
                speed,
                battery,
                timestamp: new Date().toISOString()
            });
        }

        res.json({ success: true, message: 'Location recorded.' });
    } catch (err) {
        next(err);
    }
}

/**
 * Finish a trip (User reached safely)
 */
async function completeTrip(req, res, next) {
    try {
        const { id } = req.params;
        const db = getDatabase();

        const trip = db.prepare('SELECT * FROM trips WHERE id = ? AND user_id = ?').get(id, req.user.id);
        if (!trip) {
            return res.status(404).json({ success: false, message: 'Trip not found.' });
        }

        db.prepare(`
            UPDATE trips SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(id);

        if (ioInstance) {
            ioInstance.to(`trip:${trip.share_token}`).emit('trip:completed', {
                shareToken: trip.share_token,
                message: 'Trip concluded safely by user.'
            });
        }

        res.json({ success: true, message: 'Trip ended safely. Live tracking expired.' });
    } catch (err) {
        next(err);
    }
}

/**
 * Get active user trip
 */
async function getActiveUserTrip(req, res, next) {
    try {
        const db = getDatabase();
        const trip = db.prepare(`
            SELECT * FROM trips WHERE user_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1
        `).get(req.user.id);

        res.json({ success: true, trip: trip || null });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    setSocketIO,
    startTrip,
    getTripByToken,
    updateTripLocation,
    completeTrip,
    getActiveUserTrip
};
