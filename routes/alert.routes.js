const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alert.controller');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Public telemetry & evidence endpoints during active alert
router.post('/:id/location', alertController.updateAlertLocation);
router.post('/:id/evidence', alertController.uploadEvidence);
router.get('/:id', alertController.getAlertDetails);

// Protected routes
router.post('/sos', authenticateToken, alertController.triggerSOS);
router.get('/active', authenticateToken, alertController.getActiveAlerts);
router.get('/history', authenticateToken, alertController.getAlertHistory);

// Responder actions (police, hospital, contact, user)
router.post('/:id/acknowledge', authenticateToken, alertController.handleAcknowledge);
router.post('/:id/resolve', authenticateToken, alertController.handleResolve);

module.exports = router;
