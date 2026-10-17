const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contact.controller');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', contactController.getContacts);
router.post('/', contactController.addContact);
router.put('/:id', contactController.updateContact);
router.delete('/:id', contactController.deleteContact);

module.exports = router;
