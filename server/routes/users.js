/**
 * Routes de gestion des utilisateurs
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { query, transaction } = require('../database/db');
const { authenticateToken, requireRole, requireSelfOrAdmin } = require('../middleware/auth');

// GET /api/users - Liste des utilisateurs (admin/secretary)
router.get('/', authenticateToken, requireRole('admin', 'secretary'), async (req, res) => {
    try {
        const { role, formation } = req.query;
        let sql = `
            SELECT u.id, u.username, u.role, u.first_name, u.last_name, u.email,
                   u.phone, u.first_login_completed, u.created_at,
                   f.name as formation_name, f.code as formation_code
            FROM users u
            LEFT JOIN enrollments e ON u.id = e.student_id AND e.status = 'active'
            LEFT JOIN formations f ON e.formation_id = f.id
            WHERE 1=1
        `;
        const params = [];

        if (role) {
            params.push(role);
            sql += ` AND u.role = $${params.length}`;
        }

        if (formation) {
            params.push(formation);
            sql += ` AND f.code = $${params.length}`;
        }

        sql += ' ORDER BY u.last_name, u.first_name';

        const result = await query(sql, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/users/:id - Détails d'un utilisateur
router.get('/:id', authenticateToken, requireSelfOrAdmin, async (req, res) => {
    try {
        const result = await query(
            `SELECT u.*, f.name as formation_name, f.code as formation_code
             FROM users u
             LEFT JOIN enrollments e ON u.id = e.student_id AND e.status = 'active'
             LEFT JOIN formations f ON e.formation_id = f.id
             WHERE u.id = $1`,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        const user = result.rows[0];
        delete user.password_hash;
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/users - Créer un utilisateur (admin)
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { username, password, role, firstName, lastName, email, formationCode } = req.body;

        if (!username || !password || !role) {
            return res.status(400).json({ error: 'Champs requis manquants' });
        }

        // Vérifier si l'utilisateur existe déjà
        const existing = await query('SELECT id FROM users WHERE username = $1', [username]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Cet identifiant existe déjà' });
        }

        const hash = await bcrypt.hash(password, 10);

        const result = await transaction(async (client) => {
            // Créer l'utilisateur
            const userResult = await client.query(
                `INSERT INTO users (username, password_hash, role, first_name, last_name, email)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id`,
                [username, hash, role, firstName, lastName, email]
            );

            const userId = userResult.rows[0].id;

            // Si c'est un étudiant, l'inscrire à une formation
            if (role === 'student' && formationCode) {
                const formation = await client.query('SELECT id FROM formations WHERE code = $1', [formationCode]);
                if (formation.rows.length > 0) {
                    const schoolYear = new Date().getFullYear() + '-' + (new Date().getFullYear() + 1);
                    await client.query(
                        `INSERT INTO enrollments (student_id, formation_id, school_year)
                         VALUES ($1, $2, $3)`,
                        [userId, formation.rows[0].id, schoolYear]
                    );
                }
            }

            return userId;
        });

        res.status(201).json({ success: true, id: result });
    } catch (error) {
        console.error('Erreur création utilisateur:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PUT /api/users/:id - Mettre à jour un utilisateur
router.put('/:id', authenticateToken, requireSelfOrAdmin, async (req, res) => {
    try {
        const {
            firstName, lastName, email, phone, birthDate,
            socialSecurityNumber, address, postalCode, city,
            firstLoginCompleted
        } = req.body;

        await query(
            `UPDATE users SET
                first_name = COALESCE($1, first_name),
                last_name = COALESCE($2, last_name),
                email = COALESCE($3, email),
                phone = COALESCE($4, phone),
                birth_date = COALESCE($5, birth_date),
                social_security_number = COALESCE($6, social_security_number),
                address = COALESCE($7, address),
                postal_code = COALESCE($8, postal_code),
                city = COALESCE($9, city),
                first_login_completed = COALESCE($10, first_login_completed),
                updated_at = NOW()
             WHERE id = $11`,
            [firstName, lastName, email, phone, birthDate,
             socialSecurityNumber, address, postalCode, city,
             firstLoginCompleted, req.params.id]
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// DELETE /api/users/:id - Supprimer un utilisateur (admin)
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        // Ne pas supprimer son propre compte
        if (parseInt(req.params.id) === req.user.id) {
            return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
        }

        await query('DELETE FROM users WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/users/bulk - Import en masse (admin)
router.post('/bulk', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { users } = req.body;

        if (!Array.isArray(users)) {
            return res.status(400).json({ error: 'Format invalide' });
        }

        const results = await transaction(async (client) => {
            const created = [];
            const errors = [];

            for (const userData of users) {
                try {
                    const hash = await bcrypt.hash(userData.password || 'Afertes2024!', 10);
                    const result = await client.query(
                        `INSERT INTO users (username, password_hash, role, first_name, last_name, email)
                         VALUES ($1, $2, $3, $4, $5, $6)
                         ON CONFLICT (username) DO NOTHING
                         RETURNING id`,
                        [userData.username, hash, userData.role || 'student',
                         userData.firstName, userData.lastName, userData.email]
                    );
                    if (result.rows.length > 0) {
                        created.push(userData.username);
                    }
                } catch (e) {
                    errors.push({ username: userData.username, error: e.message });
                }
            }

            return { created, errors };
        });

        res.json(results);
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
