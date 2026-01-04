/**
 * Routes d'authentification
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { query } = require('../database/db');
const { generateToken, authenticateToken } = require('../middleware/auth');

// ==========================================
// RATE LIMITING (protection brute force)
// ==========================================

const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip) {
    const now = Date.now();
    const attempts = loginAttempts.get(ip);

    if (!attempts) return { allowed: true };

    // Nettoyer les anciennes entrées
    if (now - attempts.lastAttempt > LOCKOUT_TIME) {
        loginAttempts.delete(ip);
        return { allowed: true };
    }

    if (attempts.count >= MAX_ATTEMPTS) {
        const remainingTime = Math.ceil((LOCKOUT_TIME - (now - attempts.lastAttempt)) / 1000 / 60);
        return { allowed: false, remainingMinutes: remainingTime };
    }

    return { allowed: true };
}

function recordFailedAttempt(ip) {
    const attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
    attempts.count++;
    attempts.lastAttempt = Date.now();
    loginAttempts.set(ip, attempts);
}

function resetAttempts(ip) {
    loginAttempts.delete(ip);
}

// ==========================================
// VALIDATION DES ENTRÉES
// ==========================================

function validateUsername(username) {
    if (!username || typeof username !== 'string') return false;
    // Username: 3-50 caractères alphanumériques, points et underscores
    return /^[a-zA-Z0-9._]{3,50}$/.test(username.trim());
}

function validatePassword(password) {
    if (!password || typeof password !== 'string') return false;
    // Mot de passe: 8-100 caractères
    return password.length >= 8 && password.length <= 100;
}

function validateNewPassword(password) {
    if (!validatePassword(password)) return { valid: false, message: 'Le mot de passe doit contenir entre 8 et 100 caractères' };
    // Au moins une majuscule, une minuscule et un chiffre
    if (!/[A-Z]/.test(password)) return { valid: false, message: 'Le mot de passe doit contenir au moins une majuscule' };
    if (!/[a-z]/.test(password)) return { valid: false, message: 'Le mot de passe doit contenir au moins une minuscule' };
    if (!/[0-9]/.test(password)) return { valid: false, message: 'Le mot de passe doit contenir au moins un chiffre' };
    return { valid: true };
}

// POST /api/auth/login - Connexion
router.post('/login', async (req, res) => {
    try {
        const clientIp = req.ip || req.connection.remoteAddress;

        // Vérifier le rate limiting
        const rateCheck = checkRateLimit(clientIp);
        if (!rateCheck.allowed) {
            return res.status(429).json({
                error: `Trop de tentatives. Réessayez dans ${rateCheck.remainingMinutes} minutes.`
            });
        }

        const { username, password } = req.body;

        // Validation des entrées
        if (!username || !password) {
            return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
        }

        if (!validateUsername(username)) {
            recordFailedAttempt(clientIp);
            return res.status(400).json({ error: 'Format d\'identifiant invalide' });
        }

        if (!validatePassword(password)) {
            recordFailedAttempt(clientIp);
            return res.status(400).json({ error: 'Format de mot de passe invalide' });
        }

        // Rechercher l'utilisateur
        const result = await query(
            `SELECT u.*, f.name as formation_name, f.code as formation_code
             FROM users u
             LEFT JOIN enrollments e ON u.id = e.student_id AND e.status = 'active'
             LEFT JOIN formations f ON e.formation_id = f.id
             WHERE u.username = $1`,
            [username]
        );

        if (result.rows.length === 0) {
            recordFailedAttempt(clientIp);
            // Message générique pour éviter l'énumération d'utilisateurs
            return res.status(401).json({ error: 'Identifiants incorrects' });
        }

        const user = result.rows[0];

        // Vérifier le mot de passe
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            recordFailedAttempt(clientIp);
            return res.status(401).json({ error: 'Identifiants incorrects' });
        }

        // Connexion réussie - réinitialiser les tentatives
        resetAttempts(clientIp);

        // Générer le token
        const token = generateToken(user);

        // Log de connexion
        await query(
            'INSERT INTO activity_logs (user_id, action, ip_address) VALUES ($1, $2, $3)',
            [user.id, 'login', req.ip]
        );

        // Retourner les infos utilisateur (sans le mot de passe)
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                firstName: user.first_name,
                lastName: user.last_name,
                email: user.email,
                formation: user.formation_name,
                formationCode: user.formation_code,
                firstLoginCompleted: user.first_login_completed
            }
        });

    } catch (error) {
        console.error('Erreur login:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/auth/logout - Déconnexion
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        await query(
            'INSERT INTO activity_logs (user_id, action, ip_address) VALUES ($1, $2, $3)',
            [req.user.id, 'logout', req.ip]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/auth/me - Récupérer l'utilisateur courant
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const result = await query(
            `SELECT u.*, f.name as formation_name, f.code as formation_code
             FROM users u
             LEFT JOIN enrollments e ON u.id = e.student_id AND e.status = 'active'
             LEFT JOIN formations f ON e.formation_id = f.id
             WHERE u.id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        const user = result.rows[0];
        res.json({
            id: user.id,
            username: user.username,
            role: user.role,
            firstName: user.first_name,
            lastName: user.last_name,
            email: user.email,
            phone: user.phone,
            birthDate: user.birth_date,
            socialSecurityNumber: user.social_security_number,
            address: user.address,
            postalCode: user.postal_code,
            city: user.city,
            formation: user.formation_name,
            formationCode: user.formation_code,
            firstLoginCompleted: user.first_login_completed
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/auth/change-password - Changer le mot de passe
router.post('/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Mots de passe requis' });
        }

        // Validation du nouveau mot de passe
        const passwordValidation = validateNewPassword(newPassword);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.message });
        }

        // Vérifier que le nouveau mot de passe est différent
        if (currentPassword === newPassword) {
            return res.status(400).json({ error: 'Le nouveau mot de passe doit être différent de l\'ancien' });
        }

        // Vérifier l'ancien mot de passe
        const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
        const validPassword = await bcrypt.compare(currentPassword, result.rows[0].password_hash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
        }

        // Hasher et sauvegarder le nouveau mot de passe
        const hash = await bcrypt.hash(newPassword, 10);
        await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.user.id]);

        await query(
            'INSERT INTO activity_logs (user_id, action, ip_address) VALUES ($1, $2, $3)',
            [req.user.id, 'password_change', req.ip]
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
