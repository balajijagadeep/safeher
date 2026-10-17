const express = require('express');
const router = express.Router();
const incidentController = require('../controllers/incident.controller');

router.get('/', incidentController.getIncidents);
router.post('/', incidentController.reportIncident);

module.exports = router;
