const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/device.controller');
const { authenticateToken } = require('../middleware/auth');

// Public hardware endpoints (Authenticated via deviceId + apiKey in body)
router.post('/alert', deviceController.handleWearableAlert);
router.post('/telemetry', deviceController.handleWearableTelemetry);

// Protected user management endpoints
router.get('/', authenticateToken, deviceController.getUserDevices);
router.post('/', authenticateToken, deviceController.registerDevice);
router.delete('/:id', authenticateToken, deviceController.deleteDevice);

module.exports = router;
