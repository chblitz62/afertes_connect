/**
 * Routes de gestion des notes
 */

const express = require('express');
const router = express.Router();
const { query, transaction } = require('../database/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/grades - Liste des notes (avec filtres)
router.get('/', authenticateToken, requireRole('admin', 'secretary', 'trainer'), async (req, res) => {
    try {
        const { studentId, subjectId, formation, dateFrom, dateTo } = req.query;

        let sql = `
            SELECT
                g.id, g.grade, g.grade_type, g.date, g.comment,
                u.id as student_id, u.first_name as student_first_name, u.last_name as student_last_name,
                s.id as subject_id, s.name as subject_name, s.code as subject_code, s.coefficient,
                f.code as formation_code, f.name as formation_name,
                t.first_name as trainer_first_name, t.last_name as trainer_last_name
            FROM grades g
            JOIN users u ON g.student_id = u.id
            JOIN subjects s ON g.subject_id = s.id
            JOIN formations f ON s.formation_id = f.id
            LEFT JOIN users t ON g.trainer_id = t.id
            WHERE 1=1
        `;
        const params = [];

        if (studentId) {
            params.push(studentId);
            sql += ` AND g.student_id = $${params.length}`;
        }

        if (subjectId) {
            params.push(subjectId);
            sql += ` AND g.subject_id = $${params.length}`;
        }

        if (formation) {
            params.push(formation);
            sql += ` AND f.code = $${params.length}`;
        }

        if (dateFrom) {
            params.push(dateFrom);
            sql += ` AND g.date >= $${params.length}`;
        }

        if (dateTo) {
            params.push(dateTo);
            sql += ` AND g.date <= $${params.length}`;
        }

        sql += ' ORDER BY g.date DESC, u.last_name, u.first_name';

        const result = await query(sql, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/grades - Ajouter une note
router.post('/', authenticateToken, requireRole('admin', 'trainer'), async (req, res) => {
    try {
        const { studentId, subjectId, grade, gradeType, date, comment } = req.body;

        if (!studentId || !subjectId || grade === undefined) {
            return res.status(400).json({ error: 'Champs requis manquants' });
        }

        if (grade < 0 || grade > 20) {
            return res.status(400).json({ error: 'La note doit être entre 0 et 20' });
        }

        const result = await query(
            `INSERT INTO grades (student_id, subject_id, grade, grade_type, date, trainer_id, comment)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [studentId, subjectId, grade, gradeType || 'Évaluation', date || new Date(), req.user.id, comment]
        );

        await query(
            'INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)',
            [req.user.id, 'grade_added', JSON.stringify({ studentId, subjectId, grade }), req.ip]
        );

        res.status(201).json({ success: true, id: result.rows[0].id });
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ error: 'Cette note existe déjà' });
        }
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PUT /api/grades/:id - Modifier une note
router.put('/:id', authenticateToken, requireRole('admin', 'trainer'), async (req, res) => {
    try {
        const { grade, gradeType, date, comment } = req.body;

        if (grade !== undefined && (grade < 0 || grade > 20)) {
            return res.status(400).json({ error: 'La note doit être entre 0 et 20' });
        }

        await query(
            `UPDATE grades SET
                grade = COALESCE($1, grade),
                grade_type = COALESCE($2, grade_type),
                date = COALESCE($3, date),
                comment = COALESCE($4, comment)
             WHERE id = $5`,
            [grade, gradeType, date, comment, req.params.id]
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// DELETE /api/grades/:id - Supprimer une note
router.delete('/:id', authenticateToken, requireRole('admin', 'trainer'), async (req, res) => {
    try {
        await query('DELETE FROM grades WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/grades/bulk - Import en masse des notes
router.post('/bulk', authenticateToken, requireRole('admin', 'trainer'), async (req, res) => {
    try {
        const { grades } = req.body;

        if (!Array.isArray(grades)) {
            return res.status(400).json({ error: 'Format invalide' });
        }

        const results = await transaction(async (client) => {
            let added = 0;
            let errors = [];

            for (const g of grades) {
                try {
                    await client.query(
                        `INSERT INTO grades (student_id, subject_id, grade, grade_type, date, trainer_id)
                         VALUES ($1, $2, $3, $4, $5, $6)
                         ON CONFLICT DO NOTHING`,
                        [g.studentId, g.subjectId, g.grade, g.gradeType || 'Évaluation', g.date || new Date(), req.user.id]
                    );
                    added++;
                } catch (e) {
                    errors.push({ studentId: g.studentId, error: e.message });
                }
            }

            return { added, errors };
        });

        res.json(results);
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
