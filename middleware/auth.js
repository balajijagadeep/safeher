const jwt = require('jsonwebtoken');
const { getDatabase } = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'safeher_hackathon_super_secret_jwt_key_2025_safe_women';

/**
 * Middleware to authenticate requests using JWT
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const db = getDatabase();
        const user = db.prepare('SELECT id, name, email, phone, role, home_city, blood_group, allergies, emergency_note, language FROM users WHERE id = ?').get(decoded.id);

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid token: User no longer exists.' });
        }

        req.user = user;
        next();
    } catch (err) {
        return res.status(403).json({ success: false, message: 'Token is invalid or has expired.' });
    }
}

/**
 * Middleware to restrict access based on roles
 * @param  {...string} roles Allowed roles ('user', 'contact', 'police', 'hospital', 'admin')
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Authentication required.' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Requires one of the following roles: ${roles.join(', ')}`
            });
        }
        next();
    };
}

/**
 * Helper to generate JWT tokens
 */
function generateToken(user) {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name
        },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

module.exports = {
    authenticateToken,
    requireRole,
    generateToken
};
