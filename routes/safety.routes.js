const express = require('express');
const router = express.Router();
const safetyController = require('../controllers/safety.controller');
const { authenticateToken } = require('../middleware/auth');

// Public safety queries
router.get('/score', safetyController.getSafetyScore);
router.get('/nearby', safetyController.getNearbyServices);
router.post('/routes', safetyController.getSafeRoutes);
router.get('/travel-guide', safetyController.getTravelGuide);

// Protected check-in dead-man's switch
router.post('/checkin', authenticateToken, safetyController.createCheckinTimer);
router.post('/checkin/:id/safe', authenticateToken, safetyController.markCheckinSafe);
router.get('/checkin/active', authenticateToken, safetyController.getActiveCheckin);

module.exports = router;
