/**
 * Middleware d'authentification JWT
 */

const jwt = require('jsonwebtoken');
const { query } = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_production';

// Vérification du token JWT
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Token d\'authentification requis' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Vérifier que l'utilisateur existe toujours
        const result = await query(
            'SELECT id, username, role, first_name, last_name, first_login_completed FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Utilisateur non trouvé' });
        }

        req.user = result.rows[0];
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expiré' });
        }
        return res.status(403).json({ error: 'Token invalide' });
    }
};

// Vérification du rôle
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Non authentifié' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Accès non autorisé',
                required: roles,
                current: req.user.role
            });
        }

        next();
    };
};

// Vérification que c'est l'utilisateur lui-même ou un admin
const requireSelfOrAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Non authentifié' });
    }

    const targetUserId = parseInt(req.params.id || req.params.userId);

    if (req.user.id !== targetUserId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Accès non autorisé' });
    }

    next();
};

// Générer un token JWT
const generateToken = (user) => {
    return jwt.sign(
        {
            userId: user.id,
            username: user.username,
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
};

module.exports = {
    authenticateToken,
    requireRole,
    requireSelfOrAdmin,
    generateToken
};
