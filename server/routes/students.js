/**
 * Routes spécifiques aux étudiants
 */

const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/students - Liste des étudiants
router.get('/', authenticateToken, requireRole('admin', 'secretary', 'trainer'), async (req, res) => {
    try {
        const { formation, year } = req.query;
        let sql = `
            SELECT
                u.id, u.username, u.first_name, u.last_name, u.email, u.phone,
                u.birth_date, u.social_security_number, u.address, u.postal_code, u.city,
                u.first_login_completed, u.created_at,
                f.name as formation_name, f.code as formation_code,
                e.school_year, e.status as enrollment_status,
                (SELECT COUNT(*) FROM documents d WHERE d.user_id = u.id) as doc_count
            FROM users u
            LEFT JOIN enrollments e ON u.id = e.student_id
            LEFT JOIN formations f ON e.formation_id = f.id
            WHERE u.role = 'student'
        `;
        const params = [];

        if (formation) {
            params.push(formation);
            sql += ` AND f.code = $${params.length}`;
        }

        if (year) {
            params.push(year);
            sql += ` AND e.school_year = $${params.length}`;
        }

        sql += ' ORDER BY u.last_name, u.first_name';

        const result = await query(sql, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/students/:id - Détails d'un étudiant
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        // Un étudiant ne peut voir que ses propres infos
        if (req.user.role === 'student' && req.user.id !== parseInt(req.params.id)) {
            return res.status(403).json({ error: 'Accès non autorisé' });
        }

        const result = await query(
            `SELECT
                u.id, u.username, u.first_name, u.last_name, u.email, u.phone,
                u.birth_date, u.social_security_number, u.address, u.postal_code, u.city,
                u.first_login_completed,
                f.name as formation_name, f.code as formation_code,
                e.school_year, e.enrollment_date, e.status as enrollment_status
            FROM users u
            LEFT JOIN enrollments e ON u.id = e.student_id AND e.status = 'active'
            LEFT JOIN formations f ON e.formation_id = f.id
            WHERE u.id = $1 AND u.role = 'student'`,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Étudiant non trouvé' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/students/:id/grades - Notes d'un étudiant
router.get('/:id/grades', authenticateToken, async (req, res) => {
    try {
        // Un étudiant ne peut voir que ses propres notes
        if (req.user.role === 'student' && req.user.id !== parseInt(req.params.id)) {
            return res.status(403).json({ error: 'Accès non autorisé' });
        }

        const result = await query(
            `SELECT
                g.id, g.grade, g.grade_type, g.date, g.comment,
                s.name as subject_name, s.code as subject_code, s.coefficient,
                t.first_name as trainer_first_name, t.last_name as trainer_last_name
            FROM grades g
            JOIN subjects s ON g.subject_id = s.id
            LEFT JOIN users t ON g.trainer_id = t.id
            WHERE g.student_id = $1
            ORDER BY g.date DESC, s.name`,
            [req.params.id]
        );

        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/students/:id/bulletin - Génération du bulletin
router.get('/:id/bulletin', authenticateToken, async (req, res) => {
    try {
        // Un étudiant ne peut voir que son propre bulletin
        if (req.user.role === 'student' && req.user.id !== parseInt(req.params.id)) {
            return res.status(403).json({ error: 'Accès non autorisé' });
        }

        // Infos étudiant
        const studentResult = await query(
            `SELECT u.*, f.name as formation_name, e.school_year
             FROM users u
             JOIN enrollments e ON u.id = e.student_id
             JOIN formations f ON e.formation_id = f.id
             WHERE u.id = $1`,
            [req.params.id]
        );

        if (studentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Étudiant non trouvé' });
        }

        // Notes groupées par matière
        const gradesResult = await query(
            `SELECT
                s.name as subject_name, s.coefficient,
                AVG(g.grade) as average,
                COUNT(g.id) as grade_count
             FROM grades g
             JOIN subjects s ON g.subject_id = s.id
             WHERE g.student_id = $1
             GROUP BY s.id, s.name, s.coefficient
             ORDER BY s.name`,
            [req.params.id]
        );

        // Calcul moyenne générale
        let totalWeighted = 0;
        let totalCoef = 0;
        gradesResult.rows.forEach(row => {
            totalWeighted += parseFloat(row.average) * parseFloat(row.coefficient);
            totalCoef += parseFloat(row.coefficient);
        });
        const generalAverage = totalCoef > 0 ? (totalWeighted / totalCoef).toFixed(2) : null;

        res.json({
            student: studentResult.rows[0],
            subjects: gradesResult.rows,
            generalAverage
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/students/:id/complete-first-login - Compléter première connexion
router.post('/:id/complete-first-login', authenticateToken, async (req, res) => {
    try {
        // Seul l'étudiant lui-même peut compléter son profil
        if (req.user.id !== parseInt(req.params.id)) {
            return res.status(403).json({ error: 'Accès non autorisé' });
        }

        const {
            firstName, lastName, email, phone, birthDate,
            socialSecurityNumber, address, postalCode, city
        } = req.body;

        // Validation
        if (!firstName || !lastName || !email || !phone || !birthDate ||
            !socialSecurityNumber || !address || !postalCode || !city) {
            return res.status(400).json({ error: 'Tous les champs sont obligatoires' });
        }

        // Validation numéro de sécu (15 chiffres)
        if (!/^\d{15}$/.test(socialSecurityNumber)) {
            return res.status(400).json({ error: 'Numéro de sécurité sociale invalide' });
        }

        // Validation code postal (5 chiffres)
        if (!/^\d{5}$/.test(postalCode)) {
            return res.status(400).json({ error: 'Code postal invalide' });
        }

        await query(
            `UPDATE users SET
                first_name = $1,
                last_name = $2,
                email = $3,
                phone = $4,
                birth_date = $5,
                social_security_number = $6,
                address = $7,
                postal_code = $8,
                city = $9,
                first_login_completed = TRUE,
                updated_at = NOW()
             WHERE id = $10`,
            [firstName, lastName, email, phone, birthDate,
             socialSecurityNumber, address, postalCode, city, req.params.id]
        );

        await query(
            'INSERT INTO activity_logs (user_id, action, ip_address) VALUES ($1, $2, $3)',
            [req.user.id, 'first_login_completed', req.ip]
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
