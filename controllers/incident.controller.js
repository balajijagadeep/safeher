const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../db/database');

let ioInstance = null;
function setSocketIO(io) {
    ioInstance = io;
}

/**
 * Get all community incident reports
 */
async function getIncidents(req, res, next) {
    try {
        const db = getDatabase();
        const incidents = db.prepare(`
            SELECT id, category, lat, lng, address, description, reported_at
            FROM incident_reports
            ORDER BY reported_at DESC
            LIMIT 100
        `).all();

        res.json({ success: true, incidents });
    } catch (err) {
        next(err);
    }
}

/**
 * Submit an anonymous community incident report
 */
async function reportIncident(req, res, next) {
    try {
        const { category, lat, lng, address = '', description = '' } = req.body;

        if (!category || lat === undefined || lng === undefined) {
            return res.status(400).json({ success: false, message: 'Category and coordinates are required.' });
        }

        const allowedCategories = ['poor_lighting', 'harassment', 'isolated_area', 'stalking', 'suspicious_activity'];
        if (!allowedCategories.includes(category)) {
            return res.status(400).json({ success: false, message: 'Invalid incident category.' });
        }

        const db = getDatabase();
        const incidentId = 'inc-' + uuidv4().substring(0, 8);
        const reporterId = req.user ? req.user.id : 'anonymous';

        db.prepare(`
            INSERT INTO incident_reports (id, reporter_id, category, lat, lng, address, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(incidentId, reporterId, category, parseFloat(lat), parseFloat(lng), address, description);

        const newIncident = db.prepare('SELECT id, category, lat, lng, address, description, reported_at FROM incident_reports WHERE id = ?').get(incidentId);

        if (ioInstance) {
            ioInstance.emit('incident:new', newIncident);
        }

        res.status(201).json({
            success: true,
            message: 'Community incident report submitted. Thank you for making our streets safer.',
            incident: newIncident
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    setSocketIO,
    getIncidents,
    reportIncident
};
