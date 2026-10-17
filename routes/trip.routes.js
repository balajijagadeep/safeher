const express = require('express');
const router = express.Router();
const tripController = require('../controllers/trip.controller');
const { authenticateToken } = require('../middleware/auth');

// Public tracking links (No auth required)
router.get('/track/:token', tripController.getTripByToken);
router.post('/track/:token/location', tripController.updateTripLocation);

// Authenticated user trip control
router.post('/start', authenticateToken, tripController.startTrip);
router.get('/active', authenticateToken, tripController.getActiveUserTrip);
router.post('/:id/complete', authenticateToken, tripController.completeTrip);

module.exports = router;
