const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../db/database');
const { generateToken } = require('../middleware/auth');

/**
 * Register a new user
 */
async function register(req, res, next) {
    try {
        const { name, email, phone, password, home_city, role = 'user', blood_group = 'O+', allergies = 'None', emergency_note = '' } = req.body;

        if (!name || !email || !phone || !password) {
            return res.status(400).json({ success: false, message: 'Name, email, phone, and password are required.' });
        }

        const db = getDatabase();

        // Check if email already registered
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
        if (existing) {
            return res.status(409).json({ success: false, message: 'Email is already registered. Please login.' });
        }

        const salt = bcrypt.genSaltSync(10);
        const password_hash = bcrypt.hashSync(password, salt);
        const userId = 'usr-' + uuidv4().substring(0, 8);

        db.prepare(`
            INSERT INTO users (id, name, email, phone, password_hash, role, home_city, blood_group, allergies, emergency_note, language)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'en')
        `).run(
            userId,
            name.trim(),
            email.toLowerCase().trim(),
            phone.trim(),
            password_hash,
            role,
            home_city || 'Hyderabad',
            blood_group,
            allergies,
            emergency_note
        );

        const newUser = db.prepare('SELECT id, name, email, phone, role, home_city, blood_group, allergies, emergency_note, language FROM users WHERE id = ?').get(userId);
        const token = generateToken(newUser);

        res.status(201).json({
            success: true,
            message: 'Registration successful!',
            token,
            user: newUser
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Login user with email & password
 */
async function login(req, res, next) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required.' });
        }

        const db = getDatabase();
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        const isMatch = bcrypt.compareSync(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        const token = generateToken(user);
        const sanitizedUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            home_city: user.home_city,
            blood_group: user.blood_group,
            allergies: user.allergies,
            emergency_note: user.emergency_note,
            language: user.language
        };

        res.json({
            success: true,
            message: 'Login successful.',
            token,
            user: sanitizedUser
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Get current authenticated profile
 */
async function getProfile(req, res, next) {
    try {
        res.json({
            success: true,
            user: req.user
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Update user settings & medical profile
 */
async function updateProfile(req, res, next) {
    try {
        const { name, phone, home_city, blood_group, allergies, emergency_note, language } = req.body;
        const db = getDatabase();

        db.prepare(`
            UPDATE users SET
                name = COALESCE(?, name),
                phone = COALESCE(?, phone),
                home_city = COALESCE(?, home_city),
                blood_group = COALESCE(?, blood_group),
                allergies = COALESCE(?, allergies),
                emergency_note = COALESCE(?, emergency_note),
                language = COALESCE(?, language)
            WHERE id = ?
        `).run(name, phone, home_city, blood_group, allergies, emergency_note, language, req.user.id);

        const updated = db.prepare('SELECT id, name, email, phone, role, home_city, blood_group, allergies, emergency_note, language FROM users WHERE id = ?').get(req.user.id);

        res.json({
            success: true,
            message: 'Profile updated successfully.',
            user: updated
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    register,
    login,
    getProfile,
    updateProfile
};
