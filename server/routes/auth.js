/**
 * Routes d'authentification
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { query } = require('../database/db');
const { generateToken, authenticateToken } = require('../middleware/auth');

// POST /api/auth/login - Connexion
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
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
            return res.status(401).json({ error: 'Identifiants incorrects' });
        }

        const user = result.rows[0];

        // Vérifier le mot de passe
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Identifiants incorrects' });
        }

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

        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
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
