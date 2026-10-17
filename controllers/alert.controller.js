const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../db/database');
const { startEscalation, acknowledgeAlert, resolveAlert } = require('../services/escalation.service');

let ioInstance = null;
function setSocketIO(io) {
    ioInstance = io;
}

/**
 * Trigger SOS alert from User Dashboard
 */
async function triggerSOS(req, res, next) {
    try {
        const { lat, lng, trigger_type = 'sos', address = '' } = req.body;

        if (lat === undefined || lng === undefined) {
            return res.status(400).json({ success: false, message: 'Current coordinates (lat, lng) are required.' });
        }

        const db = getDatabase();
        const alertId = 'alt-' + uuidv4().substring(0, 8);

        db.prepare(`
            INSERT INTO alerts (id, user_id, trigger_type, status, lat, lng, address)
            VALUES (?, ?, ?, 'active', ?, ?, ?)
        `).run(alertId, req.user.id, trigger_type, parseFloat(lat), parseFloat(lng), address);

        // Record initial location point
        db.prepare(`
            INSERT INTO location_points (id, alert_id, lat, lng)
            VALUES (?, ?, ?, ?)
        `).run('loc-' + uuidv4().substring(0, 8), alertId, parseFloat(lat), parseFloat(lng));

        // Start 3-stage escalation lifecycle
        startEscalation(alertId);

        res.status(201).json({
            success: true,
            message: 'EMERGENCY SOS ALERT ACTIVATED!',
            alertId,
            status: 'active',
            nextEscalationSeconds: 60
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Get all active alerts (for Responder Command Center & Users)
 */
async function getActiveAlerts(req, res, next) {
    try {
        const db = getDatabase();
        let alerts;

        if (req.user.role === 'police' || req.user.role === 'hospital' || req.user.role === 'admin') {
            alerts = db.prepare(`
                SELECT a.*, u.name as victim_name, u.phone as victim_phone, u.blood_group, u.allergies, u.emergency_note, u.home_city
                FROM alerts a
                JOIN users u ON a.user_id = u.id
                WHERE a.status != 'resolved'
                ORDER BY a.created_at DESC
            `).all();
        } else {
            alerts = db.prepare(`
                SELECT a.*, u.name as victim_name, u.phone as victim_phone, u.blood_group, u.allergies, u.emergency_note
                FROM alerts a
                JOIN users u ON a.user_id = u.id
                WHERE a.user_id = ? AND a.status != 'resolved'
                ORDER BY a.created_at DESC
            `).all(req.user.id);
        }

        res.json({ success: true, alerts });
    } catch (err) {
        next(err);
    }
}

/**
 * Get past alert history
 */
async function getAlertHistory(req, res, next) {
    try {
        const db = getDatabase();
        const alerts = db.prepare(`
            SELECT a.*, u.name as victim_name
            FROM alerts a
            JOIN users u ON a.user_id = u.id
            WHERE a.user_id = ?
            ORDER BY a.created_at DESC
            LIMIT 50
        `).all(req.user.id);

        res.json({ success: true, alerts });
    } catch (err) {
        next(err);
    }
}

/**
 * Get alert details, event timeline & breadcrumbs
 */
async function getAlertDetails(req, res, next) {
    try {
        const { id } = req.params;
        const db = getDatabase();

        const alert = db.prepare(`
            SELECT a.*, u.name as victim_name, u.phone as victim_phone, u.blood_group, u.allergies, u.emergency_note
            FROM alerts a
            JOIN users u ON a.user_id = u.id
            WHERE a.id = ?
        `).get(id);

        if (!alert) {
            return res.status(404).json({ success: false, message: 'Alert not found.' });
        }

        const events = db.prepare(`
            SELECT * FROM alert_events WHERE alert_id = ? ORDER BY timestamp ASC
        `).all(id);

        const breadcrumbs = db.prepare(`
            SELECT * FROM location_points WHERE alert_id = ? ORDER BY recorded_at ASC
        `).all(id);

        const evidence = db.prepare(`
            SELECT * FROM evidence_files WHERE alert_id = ?
        `).all(id);

        res.json({
            success: true,
            alert,
            events,
            breadcrumbs,
            evidence
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Acknowledge an alert (Responder action)
 */
async function handleAcknowledge(req, res, next) {
    try {
        const { id } = req.params;
        const { note = '' } = req.body;
        const responderName = `${req.user.name} (${req.user.role.toUpperCase()})`;

        const result = acknowledgeAlert(id, responderName, note);
        res.json(result);
    } catch (err) {
        next(err);
    }
}

/**
 * Resolve an alert (Safe / Emergency handled)
 */
async function handleResolve(req, res, next) {
    try {
        const { id } = req.params;
        const resolvedBy = `${req.user.name} (${req.user.role.toUpperCase()})`;

        const result = resolveAlert(id, resolvedBy);
        res.json(result);
    } catch (err) {
        next(err);
    }
}

/**
 * Push moving GPS update during active SOS
 */
async function updateAlertLocation(req, res, next) {
    try {
        const { id } = req.params;
        const { lat, lng, speed = 0, battery = 100 } = req.body;

        const db = getDatabase();
        db.prepare(`UPDATE alerts SET lat = ?, lng = ?, battery_pct = ? WHERE id = ?`).run(lat, lng, battery, id);

        const ptId = 'loc-' + uuidv4().substring(0, 8);
        db.prepare(`
            INSERT INTO location_points (id, alert_id, lat, lng, speed, battery)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(ptId, id, lat, lng, speed, battery);

        if (ioInstance) {
            ioInstance.to(`alert:${id}`).emit('location:update', {
                alertId: id,
                lat,
                lng,
                speed,
                battery,
                timestamp: new Date().toISOString()
            });
            ioInstance.emit('responder:location_update', { alertId: id, lat, lng });
        }

        res.json({ success: true, message: 'Telemetry updated.' });
    } catch (err) {
        next(err);
    }
}

/**
 * Upload silent recorded audio evidence (Base64 or multipart)
 */
async function uploadEvidence(req, res, next) {
    try {
        const { id } = req.params;
        const { audioBase64, durationSec = 15 } = req.body;

        if (!audioBase64) {
            return res.status(400).json({ success: false, message: 'Audio payload required.' });
        }

        const evidenceDir = path.resolve(__dirname, '..', 'public', 'evidence');
        if (!fs.existsSync(evidenceDir)) {
            fs.mkdirSync(evidenceDir, { recursive: true });
        }

        const fileName = `evidence_${id}_${Date.now()}.webm`;
        const filePath = path.join(evidenceDir, fileName);
        const buffer = Buffer.from(audioBase64.replace(/^data:audio\/\w+;base64,/, ''), 'base64');
        fs.writeFileSync(filePath, buffer);

        const db = getDatabase();
        const evidenceId = 'evd-' + uuidv4().substring(0, 8);
        const webUrl = `/evidence/${fileName}`;

        db.prepare(`
            INSERT INTO evidence_files (id, alert_id, user_id, file_path, duration_sec)
            VALUES (?, ?, ?, ?, ?)
        `).run(evidenceId, id, req.user ? req.user.id : 'unknown', webUrl, durationSec);

        db.prepare(`UPDATE alerts SET audio_evidence_id = ? WHERE id = ?`).run(evidenceId, id);

        if (ioInstance) {
            ioInstance.emit('alert:evidence_uploaded', {
                alertId: id,
                evidenceUrl: webUrl,
                durationSec
            });
        }

        res.json({
            success: true,
            message: 'Silent audio evidence saved securely.',
            evidenceUrl: webUrl
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    setSocketIO,
    triggerSOS,
    getActiveAlerts,
    getAlertHistory,
    getAlertDetails,
    handleAcknowledge,
    handleResolve,
    updateAlertLocation,
    uploadEvidence
};
