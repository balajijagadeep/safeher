const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../db/database');
const { sendEmergencyNotification } = require('./notification.service');

// Store active escalation timeouts in memory: alertId -> [timeout1, timeout2]
const activeTimers = new Map();
let ioInstance = null;

function setSocketIO(io) {
    ioInstance = io;
}

/**
 * Start the 3-stage escalation lifecycle for an alert
 */
function startEscalation(alertId, originUrl = 'http://localhost:3000') {
    const db = getDatabase();

    const alert = db.prepare(`
        SELECT a.*, u.name as victim_name, u.phone as victim_phone, u.blood_group, u.allergies, u.emergency_note
        FROM alerts a
        JOIN users u ON a.user_id = u.id
        WHERE a.id = ?
    `).get(alertId);

    if (!alert) return;

    // Clear any previous timers for this alert
    clearTimers(alertId);
    activeTimers.set(alertId, []);

    const stage1Seconds = parseInt(process.env.ESCALATION_STAGE_1_SECONDS || '60', 10);
    const stage2Seconds = parseInt(process.env.ESCALATION_STAGE_2_SECONDS || '120', 10);

    // ==========================================
    // STAGE 1: IMMEDIATE -> TRUSTED CONTACTS
    // ==========================================
    const contacts = db.prepare(`
        SELECT * FROM trusted_contacts WHERE user_id = ? ORDER BY priority ASC
    `).all(alert.user_id);

    const trackingUrl = `${originUrl}/track.html?alert=${alert.id}`;

    // Log Stage 1 event
    const event1Id = 'evt-' + uuidv4().substring(0, 8);
    db.prepare(`
        INSERT INTO alert_events (id, alert_id, stage, recipient, note)
        VALUES (?, ?, 'contacts_notified', ?, ?)
    `).run(event1Id, alert.id, 'Trusted Contacts (' + contacts.length + ')', 'Notified via SMS & WebSocket');

    contacts.forEach(contact => {
        sendEmergencyNotification({
            recipientPhone: contact.phone,
            recipientName: contact.name,
            alertId: alert.id,
            victimName: alert.victim_name,
            lat: alert.lat,
            lng: alert.lng,
            triggerType: alert.trigger_type,
            trackingUrl
        });
    });

    if (ioInstance) {
        ioInstance.emit('alert:created', {
            alert,
            stage: 'contacts_notified',
            nextEscalationIn: stage1Seconds
        });
    }

    // ==========================================
    // STAGE 2: 60s ESCALATION -> POLICE
    // ==========================================
    const timer1 = setTimeout(() => {
        try {
            const current = db.prepare('SELECT status FROM alerts WHERE id = ?').get(alertId);
            if (!current || current.status === 'acknowledged' || current.status === 'resolved') {
                return;
            }

            // Update alert status
            db.prepare('UPDATE alerts SET status = ? WHERE id = ?').run('escalated_police', alertId);

            // Find nearest police station
            const policeStation = db.prepare(`
                SELECT * FROM emergency_services WHERE type = 'police'
                ORDER BY ((lat - ?) * (lat - ?) + (lng - ?) * (lng - ?)) ASC LIMIT 1
            `).get(alert.lat, alert.lat, alert.lng, alert.lng);

            const policeName = policeStation ? policeStation.name : 'Central ERSS 112 Command';
            const policePhone = policeStation ? policeStation.phone : '112';

            const evtId = 'evt-' + uuidv4().substring(0, 8);
            db.prepare(`
                INSERT INTO alert_events (id, alert_id, stage, recipient, note)
                VALUES (?, ?, 'police_escalated', ?, ?)
            `).run(evtId, alertId, policeName, 'No contact acknowledged within 60s. Auto-escalated to Police.');

            sendEmergencyNotification({
                recipientPhone: policePhone,
                recipientName: policeName,
                alertId,
                victimName: alert.victim_name,
                lat: alert.lat,
                lng: alert.lng,
                triggerType: alert.trigger_type,
                trackingUrl
            });

            console.log(`[SafeHer Escalation] ⚠️ Alert ${alertId} escalated to POLICE: ${policeName}`);

            if (ioInstance) {
                ioInstance.emit('alert:escalated', {
                    alertId,
                    stage: 'police_escalated',
                    recipient: policeName,
                    nextEscalationIn: stage2Seconds - stage1Seconds
                });
            }
        } catch (err) {
            console.error('[SafeHer Escalation] Error in police escalation stage:', err);
        }
    }, stage1Seconds * 1000);

    // ==========================================
    // STAGE 3: 120s ESCALATION -> HOSPITAL / EMS
    // ==========================================
    const timer2 = setTimeout(() => {
        try {
            const current = db.prepare('SELECT status FROM alerts WHERE id = ?').get(alertId);
            if (!current || current.status === 'acknowledged' || current.status === 'resolved') {
                return;
            }

            db.prepare('UPDATE alerts SET status = ? WHERE id = ?').run('escalated_hospital', alertId);

            // Find nearest hospital
            const hospital = db.prepare(`
                SELECT * FROM emergency_services WHERE type = 'hospital'
                ORDER BY ((lat - ?) * (lat - ?) + (lng - ?) * (lng - ?)) ASC LIMIT 1
            `).get(alert.lat, alert.lat, alert.lng, alert.lng);

            const hospitalName = hospital ? hospital.name : 'Nearest Trauma Emergency 108';
            const hospitalPhone = hospital ? hospital.phone : '108';

            const evtId = 'evt-' + uuidv4().substring(0, 8);
            db.prepare(`
                INSERT INTO alert_events (id, alert_id, stage, recipient, note)
                VALUES (?, ?, 'hospital_escalated', ?, ?)
            `).run(evtId, alertId, hospitalName, 'Unacknowledged at 120s. Auto-escalated to Ambulance / Trauma.');

            sendEmergencyNotification({
                recipientPhone: hospitalPhone,
                recipientName: hospitalName,
                alertId,
                victimName: alert.victim_name,
                lat: alert.lat,
                lng: alert.lng,
                triggerType: alert.trigger_type,
                trackingUrl
            });

            console.log(`[SafeHer Escalation] 🚨 Alert ${alertId} escalated to HOSPITAL: ${hospitalName}`);

            if (ioInstance) {
                ioInstance.emit('alert:escalated', {
                    alertId,
                    stage: 'hospital_escalated',
                    recipient: hospitalName
                });
            }
        } catch (err) {
            console.error('[SafeHer Escalation] Error in hospital escalation stage:', err);
        }
    }, stage2Seconds * 1000);

    activeTimers.get(alertId).push(timer1, timer2);
}

/**
 * Responder acknowledges the alert (halts pending escalations)
 */
function acknowledgeAlert(alertId, responderName, note = '') {
    clearTimers(alertId);
    const db = getDatabase();

    db.prepare('UPDATE alerts SET status = ? WHERE id = ?').run('acknowledged', alertId);

    const eventId = 'evt-' + uuidv4().substring(0, 8);
    db.prepare(`
        INSERT INTO alert_events (id, alert_id, stage, recipient, note)
        VALUES (?, ?, 'acknowledged', ?, ?)
    `).run(eventId, alertId, responderName, note || 'Response unit dispatched. Investigation in progress.');

    if (ioInstance) {
        ioInstance.emit('alert:acknowledged', {
            alertId,
            responderName,
            note
        });
    }

    return { success: true, message: 'Alert successfully acknowledged.' };
}

/**
 * Mark alert resolved
 */
function resolveAlert(alertId, resolvedBy = 'User / Police') {
    clearTimers(alertId);
    const db = getDatabase();

    db.prepare(`
        UPDATE alerts SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(alertId);

    const eventId = 'evt-' + uuidv4().substring(0, 8);
    db.prepare(`
        INSERT INTO alert_events (id, alert_id, stage, recipient, note)
        VALUES (?, ?, 'resolved', ?, 'Alert marked safe and resolved.')
    `).run(eventId, alertId, resolvedBy);

    if (ioInstance) {
        ioInstance.emit('alert:resolved', { alertId, resolvedBy });
    }

    return { success: true, message: 'Alert marked safe and resolved.' };
}

function clearTimers(alertId) {
    if (activeTimers.has(alertId)) {
        const timers = activeTimers.get(alertId);
        timers.forEach(t => clearTimeout(t));
        activeTimers.delete(alertId);
    }
}

module.exports = {
    setSocketIO,
    startEscalation,
    acknowledgeAlert,
    resolveAlert
};
