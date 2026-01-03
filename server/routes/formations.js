/**
 * Routes de gestion des formations
 */

const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/formations - Liste des formations
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await query(
            `SELECT f.*,
                (SELECT COUNT(*) FROM enrollments e WHERE e.formation_id = f.id AND e.status = 'active') as student_count
             FROM formations f
             ORDER BY f.name`
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/formations/:code - Détails d'une formation
router.get('/:code', authenticateToken, async (req, res) => {
    try {
        const result = await query(
            `SELECT f.*,
                (SELECT COUNT(*) FROM enrollments e WHERE e.formation_id = f.id AND e.status = 'active') as student_count
             FROM formations f
             WHERE f.code = $1`,
            [req.params.code]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Formation non trouvée' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/formations/:code/subjects - Matières d'une formation
router.get('/:code/subjects', authenticateToken, async (req, res) => {
    try {
        const result = await query(
            `SELECT s.*
             FROM subjects s
             JOIN formations f ON s.formation_id = f.id
             WHERE f.code = $1
             ORDER BY s.name`,
            [req.params.code]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/formations/:code/students - Étudiants d'une formation
router.get('/:code/students', authenticateToken, requireRole('admin', 'secretary', 'trainer'), async (req, res) => {
    try {
        const { year } = req.query;
        let sql = `
            SELECT u.id, u.first_name, u.last_name, u.email, e.school_year, e.status
            FROM users u
            JOIN enrollments e ON u.id = e.student_id
            JOIN formations f ON e.formation_id = f.id
            WHERE f.code = $1
        `;
        const params = [req.params.code];

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

// POST /api/formations - Créer une formation (admin)
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { code, name, description, durationMonths } = req.body;

        if (!code || !name) {
            return res.status(400).json({ error: 'Code et nom requis' });
        }

        const result = await query(
            `INSERT INTO formations (code, name, description, duration_months)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [code, name, description, durationMonths]
        );

        res.status(201).json({ success: true, id: result.rows[0].id });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Ce code de formation existe déjà' });
        }
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/formations/:code/subjects - Ajouter une matière (admin)
router.post('/:code/subjects', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { subjectCode, name, coefficient } = req.body;

        const formation = await query('SELECT id FROM formations WHERE code = $1', [req.params.code]);
        if (formation.rows.length === 0) {
            return res.status(404).json({ error: 'Formation non trouvée' });
        }

        const result = await query(
            `INSERT INTO subjects (formation_id, code, name, coefficient)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [formation.rows[0].id, subjectCode, name, coefficient || 1.0]
        );

        res.status(201).json({ success: true, id: result.rows[0].id });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Cette matière existe déjà dans cette formation' });
        }
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
