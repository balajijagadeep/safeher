const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../db/database');
const { startEscalation } = require('../services/escalation.service');

let ioInstance = null;
function setSocketIO(io) {
    ioInstance = io;
}

/**
 * Get all paired wearable devices for user
 */
async function getUserDevices(req, res, next) {
    try {
        const db = getDatabase();
        const devices = db.prepare(`
            SELECT id, device_id, device_name, type, api_key, battery_pct, status, last_seen, created_at
            FROM devices
            WHERE user_id = ?
            ORDER BY created_at DESC
        `).all(req.user.id);

        res.json({ success: true, devices });
    } catch (err) {
        next(err);
    }
}

/**
 * Pair a new wearable device
 */
async function registerDevice(req, res, next) {
    try {
        const { device_name, type = 'watch', device_id } = req.body;

        if (!device_name) {
            return res.status(400).json({ success: false, message: 'Device name is required.' });
        }

        const db = getDatabase();
        const devIdString = device_id || 'DEV-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        const apiKey = 'safeher_live_key_' + uuidv4().substring(0, 12);
        const recordId = 'dev-' + uuidv4().substring(0, 8);

        db.prepare(`
            INSERT INTO devices (id, user_id, device_id, device_name, type, api_key, battery_pct, status)
            VALUES (?, ?, ?, ?, ?, ?, 100, 'online')
        `).run(recordId, req.user.id, devIdString, device_name.trim(), type, apiKey);

        const newDevice = db.prepare('SELECT * FROM devices WHERE id = ?').get(recordId);

        res.status(201).json({
            success: true,
            message: 'Wearable device paired successfully!',
            device: newDevice
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Unpair device
 */
async function deleteDevice(req, res, next) {
    try {
        const { id } = req.params;
        const db = getDatabase();

        const result = db.prepare('DELETE FROM devices WHERE id = ? AND user_id = ?').run(id, req.user.id);

        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: 'Device not found.' });
        }

        res.json({ success: true, message: 'Device unpaired.' });
    } catch (err) {
        next(err);
    }
}

/**
 * Direct Wearable Hardware Endpoint (ESP32 / BLE / Simulator)
 * Accessible WITHOUT phone or browser session. Uses deviceId + apiKey.
 */
async function handleWearableAlert(req, res, next) {
    try {
        const { deviceId, apiKey, lat, lng, type = 'sos' } = req.body;

        if (!deviceId || !apiKey) {
            return res.status(401).json({ success: false, message: 'Missing deviceId or apiKey authentication.' });
        }

        const db = getDatabase();
        const device = db.prepare(`
            SELECT d.*, u.name as victim_name, u.phone as victim_phone
            FROM devices d
            JOIN users u ON d.user_id = u.id
            WHERE d.device_id = ? AND d.api_key = ?
        `).get(deviceId, apiKey);

        if (!device) {
            return res.status(403).json({ success: false, message: 'Invalid device credentials. Device not recognized.' });
        }

        const latitude = parseFloat(lat) || 17.4156;
        const longitude = parseFloat(lng) || 78.4350;

        // Update device last seen & status
        db.prepare(`
            UPDATE devices SET last_seen = CURRENT_TIMESTAMP, status = 'online' WHERE id = ?
        `).run(device.id);

        if (type === 'low-battery') {
            db.prepare(`UPDATE devices SET battery_pct = 12 WHERE id = ?`).run(device.id);
            if (ioInstance) {
                ioInstance.emit('device:low_battery', {
                    deviceId: device.device_id,
                    deviceName: device.device_name,
                    batteryPct: 12
                });
            }
            return res.json({ success: true, message: 'Low battery telemetry logged.' });
        }

        // Create Alert
        const alertId = 'alt-' + uuidv4().substring(0, 8);
        db.prepare(`
            INSERT INTO alerts (id, user_id, device_id, trigger_type, status, lat, lng, battery_pct)
            VALUES (?, ?, ?, ?, 'active', ?, ?, ?)
        `).run(alertId, device.user_id, device.id, type, latitude, longitude, device.battery_pct);

        // Record breadcrumb
        db.prepare(`
            INSERT INTO location_points (id, alert_id, lat, lng, battery)
            VALUES (?, ?, ?, ?, ?)
        `).run('loc-' + uuidv4().substring(0, 8), alertId, latitude, longitude, device.battery_pct);

        // Initiate escalation
        startEscalation(alertId);

        console.log(`[SafeHer Wearable Engine] ⚡ Alert fired from Wearable ${device.device_name} (${type})`);

        res.status(201).json({
            success: true,
            message: `Alert triggered from wearable device [${type.toUpperCase()}]`,
            alertId,
            victim: device.victim_name,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Wearable Telemetry Ping (heartbeat / battery / coordinates)
 */
async function handleWearableTelemetry(req, res, next) {
    try {
        const { deviceId, apiKey, battery_pct, lat, lng } = req.body;
        const db = getDatabase();

        const device = db.prepare('SELECT * FROM devices WHERE device_id = ? AND api_key = ?').get(deviceId, apiKey);
        if (!device) {
            return res.status(403).json({ success: false, message: 'Unauthorized device.' });
        }

        const battery = battery_pct !== undefined ? parseInt(battery_pct, 10) : device.battery_pct;
        db.prepare(`
            UPDATE devices SET battery_pct = ?, last_seen = CURRENT_TIMESTAMP, status = 'online' WHERE id = ?
        `).run(battery, device.id);

        if (ioInstance) {
            ioInstance.emit('device:telemetry', {
                deviceId: device.device_id,
                batteryPct: battery,
                lat,
                lng,
                lastSeen: new Date().toISOString()
            });
        }

        res.json({ success: true, message: 'Telemetry received.' });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    setSocketIO,
    getUserDevices,
    registerDevice,
    deleteDevice,
    handleWearableAlert,
    handleWearableTelemetry
};
