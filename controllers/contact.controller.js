const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../db/database');

/**
 * Get all trusted contacts for the logged-in user
 */
async function getContacts(req, res, next) {
    try {
        const db = getDatabase();
        const contacts = db.prepare(`
            SELECT * FROM trusted_contacts WHERE user_id = ? ORDER BY priority ASC, created_at ASC
        `).all(req.user.id);

        res.json({ success: true, contacts });
    } catch (err) {
        next(err);
    }
}

/**
 * Add a new trusted contact
 */
async function addContact(req, res, next) {
    try {
        const { name, phone, relationship, priority = 1 } = req.body;

        if (!name || !phone) {
            return res.status(400).json({ success: false, message: 'Contact name and phone are required.' });
        }

        const db = getDatabase();
        const contactId = 'cnt-' + uuidv4().substring(0, 8);

        db.prepare(`
            INSERT INTO trusted_contacts (id, user_id, name, phone, relationship, priority)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(contactId, req.user.id, name.trim(), phone.trim(), relationship || 'Friend', priority);

        const newContact = db.prepare('SELECT * FROM trusted_contacts WHERE id = ?').get(contactId);

        res.status(201).json({
            success: true,
            message: 'Contact added successfully.',
            contact: newContact
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Update an existing contact
 */
async function updateContact(req, res, next) {
    try {
        const { id } = req.params;
        const { name, phone, relationship, priority } = req.body;

        const db = getDatabase();
        const contact = db.prepare('SELECT * FROM trusted_contacts WHERE id = ? AND user_id = ?').get(id, req.user.id);

        if (!contact) {
            return res.status(404).json({ success: false, message: 'Contact not found.' });
        }

        db.prepare(`
            UPDATE trusted_contacts SET
                name = COALESCE(?, name),
                phone = COALESCE(?, phone),
                relationship = COALESCE(?, relationship),
                priority = COALESCE(?, priority)
            WHERE id = ? AND user_id = ?
        `).run(name, phone, relationship, priority, id, req.user.id);

        const updated = db.prepare('SELECT * FROM trusted_contacts WHERE id = ?').get(id);

        res.json({
            success: true,
            message: 'Contact updated.',
            contact: updated
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Delete a contact
 */
async function deleteContact(req, res, next) {
    try {
        const { id } = req.params;
        const db = getDatabase();

        const result = db.prepare('DELETE FROM trusted_contacts WHERE id = ? AND user_id = ?').run(id, req.user.id);

        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: 'Contact not found or already removed.' });
        }

        res.json({ success: true, message: 'Contact removed successfully.' });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getContacts,
    addContact,
    updateContact,
    deleteContact
};
