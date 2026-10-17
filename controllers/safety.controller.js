const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../db/database');
const { computeAreaSafetyScore, calculateDistanceKm } = require('../services/safetyScore.service');
const { generateSafeRoutes } = require('../services/route.service');
const { startEscalation } = require('../services/escalation.service');

// Map of active check-in timers: checkinId -> setTimeout
const activeCheckinTimers = new Map();

/**
 * Compute AI Safety Score for a location
 */
async function getSafetyScore(req, res, next) {
    try {
        const lat = parseFloat(req.query.lat) || 17.4156;
        const lng = parseFloat(req.query.lng) || 78.4350;

        const assessment = await computeAreaSafetyScore(lat, lng);
        res.json({ success: true, assessment });
    } catch (err) {
        next(err);
    }
}

/**
 * Get nearby emergency services (Police, Hospitals, 24x7 Pharmacies)
 */
async function getNearbyServices(req, res, next) {
    try {
        const lat = parseFloat(req.query.lat) || 17.4156;
        const lng = parseFloat(req.query.lng) || 78.4350;

        const db = getDatabase();
        const services = db.prepare('SELECT * FROM emergency_services').all();

        const enriched = services.map(s => {
            const distanceKm = calculateDistanceKm(lat, lng, s.lat, s.lng);
            return {
                ...s,
                distanceKm: parseFloat(distanceKm.toFixed(2))
            };
        });

        // Sort by closest distance
        enriched.sort((a, b) => a.distanceKm - b.distanceKm);

        res.json({
            success: true,
            userLocation: { lat, lng },
            services: enriched
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Safe Route Suggestions comparing multiple paths
 */
async function getSafeRoutes(req, res, next) {
    try {
        const { startLat, startLng, endLat, endLng } = req.body;

        if (startLat === undefined || endLat === undefined) {
            return res.status(400).json({ success: false, message: 'Start and destination coordinates are required.' });
        }

        const routeData = await generateSafeRoutes(
            parseFloat(startLat),
            parseFloat(startLng),
            parseFloat(endLat),
            parseFloat(endLng)
        );

        res.json({ success: true, ...routeData });
    } catch (err) {
        next(err);
    }
}

/**
 * Set Safety Check-in Timer (Dead-man's switch)
 */
async function createCheckinTimer(req, res, next) {
    try {
        const { minutes = 30, destination = 'Destination', lat = 17.4156, lng = 78.4350 } = req.body;
        const db = getDatabase();

        const checkinId = 'chk-' + uuidv4().substring(0, 8);
        const expectedTime = new Date(Date.now() + minutes * 60 * 1000).toISOString();

        db.prepare(`
            INSERT INTO checkins (id, user_id, expected_reach_time, destination, status)
            VALUES (?, ?, ?, ?, 'pending')
        `).run(checkinId, req.user.id, expectedTime, destination);

        // Schedule dead-man switch trigger
        const timer = setTimeout(() => {
            try {
                const check = db.prepare('SELECT status FROM checkins WHERE id = ?').get(checkinId);
                if (check && check.status === 'pending') {
                    // Time elapsed without confirmation! Trigger automated SOS!
                    db.prepare("UPDATE checkins SET status = 'expired_alerted' WHERE id = ?").run(checkinId);

                    const alertId = 'alt-' + uuidv4().substring(0, 8);
                    db.prepare(`
                        INSERT INTO alerts (id, user_id, trigger_type, status, lat, lng, address)
                        VALUES (?, ?, 'timer_missed', 'active', ?, ?, ?)
                    `).run(alertId, req.user.id, lat, lng, `Dead-man switch expired for destination: ${destination}`);

                    startEscalation(alertId);
                    console.log(`[SafeHer Dead-Man Switch] ⚠️ User missed check-in! Automated SOS fired: ${alertId}`);
                }
            } catch (timerErr) {
                console.error('[SafeHer Checkin Timer] Error on expiry:', timerErr);
            }
        }, minutes * 60 * 1000);

        activeCheckinTimers.set(checkinId, timer);

        res.status(201).json({
            success: true,
            message: `Safety check-in active for ${minutes} minutes. If you do not mark 'I am safe' before expiry, an SOS will auto-trigger.`,
            checkinId,
            expectedReachTime: expectedTime
        });
    } catch (err) {
        next(err);
    }
}

/**
 * User taps "I'm Safe" to cancel Dead-man's switch
 */
async function markCheckinSafe(req, res, next) {
    try {
        const { id } = req.params;
        const db = getDatabase();

        const checkin = db.prepare('SELECT * FROM checkins WHERE id = ? AND user_id = ?').get(id, req.user.id);
        if (!checkin) {
            return res.status(404).json({ success: false, message: 'Check-in timer not found.' });
        }

        if (activeCheckinTimers.has(id)) {
            clearTimeout(activeCheckinTimers.get(id));
            activeCheckinTimers.delete(id);
        }

        db.prepare("UPDATE checkins SET status = 'safe' WHERE id = ?").run(id);

        res.json({
            success: true,
            message: 'Check-in confirmed! You are marked safe.'
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Get active pending checkin for user
 */
async function getActiveCheckin(req, res, next) {
    try {
        const db = getDatabase();
        const checkin = db.prepare(`
            SELECT * FROM checkins WHERE user_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1
        `).get(req.user.id);

        res.json({ success: true, checkin: checkin || null });
    } catch (err) {
        next(err);
    }
}

/**
 * New-Area Travel Guide & Emergency Directory
 */
async function getTravelGuide(req, res, next) {
    try {
        const city = req.query.city || 'Hyderabad';

        const guide = {
            city,
            emergencyNumbers: [
                { service: 'Unified Emergency (Police/Fire/Ambulance)', number: '112', icon: '🚨' },
                { service: 'National Women Helpline', number: '1091', icon: '👩' },
                { service: 'Women in Distress (NCW)', number: '7827170170', icon: '🛡️' },
                { service: 'Ambulance Emergency', number: '108', icon: '🚑' },
                { service: 'She Teams / Anti-Harassment Patrol', number: '100', icon: '👮‍♀️' }
            ],
            safeAreasToStay: [
                { name: 'Banjara Hills / Jubilee Hills', safetyRating: 'High', reason: 'High security presence, 24/7 commercial activity, active street lighting' },
                { name: 'Madhapur / Hitec City', safetyRating: 'High', reason: 'IT corridor with continuous police patrolling and high CCTV density' },
                { name: 'Gachibowli', safetyRating: 'Moderate to High', reason: 'Well-connected transit hubs and multi-specialty hospitals' }
            ],
            safetyTips: [
                'Always share live trip link with at least one family member before boarding cabs late night.',
                'Verify child-lock on car doors and check driver details against the cab app.',
                'Keep SafeHer wearable paired or keep phone accessible with Voice/Shake SOS enabled.',
                'Avoid poorly lit underpasses or isolated alleys without open commercial establishments.'
            ]
        };

        res.json({ success: true, guide });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getSafetyScore,
    getNearbyServices,
    getSafeRoutes,
    createCheckinTimer,
    markCheckinSafe,
    getActiveCheckin,
    getTravelGuide
};
