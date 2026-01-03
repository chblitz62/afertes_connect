/**
 * Routes d'export des données (Excel/CSV)
 */

const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/export/students - Export des étudiants
router.get('/students', authenticateToken, requireRole('admin', 'secretary', 'trainer'), async (req, res) => {
    try {
        const { formation, year, format } = req.query;

        let sql = `
            SELECT
                u.last_name as "Nom",
                u.first_name as "Prénom",
                u.email as "Email",
                u.phone as "Téléphone",
                TO_CHAR(u.birth_date, 'DD/MM/YYYY') as "Date de naissance",
                u.social_security_number as "N° Sécurité Sociale",
                u.address as "Adresse",
                u.postal_code as "Code Postal",
                u.city as "Ville",
                f.name as "Formation",
                e.school_year as "Année scolaire",
                e.status as "Statut",
                CASE WHEN EXISTS (SELECT 1 FROM documents d WHERE d.user_id = u.id AND d.doc_type = 'identity') THEN 'Oui' ELSE 'Non' END as "Pièce d'identité",
                CASE WHEN EXISTS (SELECT 1 FROM documents d WHERE d.user_id = u.id AND d.doc_type = 'vitale') THEN 'Oui' ELSE 'Non' END as "Carte Vitale",
                CASE WHEN EXISTS (SELECT 1 FROM documents d WHERE d.user_id = u.id AND d.doc_type = 'photo') THEN 'Oui' ELSE 'Non' END as "Photo"
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

        // Log de l'export
        await query(
            'INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)',
            [req.user.id, 'export_students', JSON.stringify({ formation, year, count: result.rows.length }), req.ip]
        );

        // Retourner les données au format JSON (le frontend génèrera l'Excel)
        res.json({
            filename: `etudiants_afertes_${new Date().toISOString().split('T')[0]}.xlsx`,
            sheetName: 'Étudiants',
            data: result.rows
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/export/grades - Export des notes
router.get('/grades', authenticateToken, requireRole('admin', 'secretary', 'trainer'), async (req, res) => {
    try {
        const { formation, year, studentId } = req.query;

        let sql = `
            SELECT
                u.last_name as "Nom",
                u.first_name as "Prénom",
                f.name as "Formation",
                s.name as "Matière",
                s.coefficient as "Coefficient",
                g.grade as "Note",
                g.grade_type as "Type d'évaluation",
                TO_CHAR(g.date, 'DD/MM/YYYY') as "Date",
                g.comment as "Commentaire",
                t.first_name || ' ' || t.last_name as "Formateur"
            FROM grades g
            JOIN users u ON g.student_id = u.id
            JOIN subjects s ON g.subject_id = s.id
            JOIN formations f ON s.formation_id = f.id
            LEFT JOIN users t ON g.trainer_id = t.id
            WHERE 1=1
        `;
        const params = [];

        if (formation) {
            params.push(formation);
            sql += ` AND f.code = $${params.length}`;
        }

        if (studentId) {
            params.push(studentId);
            sql += ` AND u.id = $${params.length}`;
        }

        sql += ' ORDER BY u.last_name, u.first_name, s.name, g.date DESC';

        const result = await query(sql, params);

        await query(
            'INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)',
            [req.user.id, 'export_grades', JSON.stringify({ formation, count: result.rows.length }), req.ip]
        );

        res.json({
            filename: `notes_afertes_${new Date().toISOString().split('T')[0]}.xlsx`,
            sheetName: 'Notes',
            data: result.rows
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/export/bulletin/:studentId - Export du bulletin d'un étudiant
router.get('/bulletin/:studentId', authenticateToken, async (req, res) => {
    try {
        // Vérifier les droits
        if (req.user.role === 'student' && req.user.id !== parseInt(req.params.studentId)) {
            return res.status(403).json({ error: 'Accès non autorisé' });
        }

        // Infos étudiant
        const studentResult = await query(
            `SELECT u.first_name, u.last_name, u.birth_date,
                    f.name as formation_name, f.code as formation_code,
                    e.school_year
             FROM users u
             JOIN enrollments e ON u.id = e.student_id
             JOIN formations f ON e.formation_id = f.id
             WHERE u.id = $1`,
            [req.params.studentId]
        );

        if (studentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Étudiant non trouvé' });
        }

        const student = studentResult.rows[0];

        // Notes par matière
        const gradesResult = await query(
            `SELECT
                s.name as "Matière",
                s.coefficient as "Coefficient",
                ROUND(AVG(g.grade)::numeric, 2) as "Moyenne",
                COUNT(g.id) as "Nb évaluations"
             FROM grades g
             JOIN subjects s ON g.subject_id = s.id
             WHERE g.student_id = $1
             GROUP BY s.id, s.name, s.coefficient
             ORDER BY s.name`,
            [req.params.studentId]
        );

        // Calcul moyenne générale
        let totalWeighted = 0;
        let totalCoef = 0;
        gradesResult.rows.forEach(row => {
            totalWeighted += parseFloat(row.Moyenne) * parseFloat(row.Coefficient);
            totalCoef += parseFloat(row.Coefficient);
        });
        const generalAverage = totalCoef > 0 ? (totalWeighted / totalCoef).toFixed(2) : 'N/A';

        res.json({
            filename: `bulletin_${student.last_name}_${student.first_name}_${student.school_year}.xlsx`,
            student: {
                name: `${student.first_name} ${student.last_name}`,
                formation: student.formation_name,
                schoolYear: student.school_year
            },
            sheetName: 'Bulletin',
            data: gradesResult.rows,
            summary: {
                generalAverage,
                totalCoefficient: totalCoef
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/export/activity-logs - Export des logs d'activité (admin)
router.get('/activity-logs', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { dateFrom, dateTo, userId } = req.query;

        let sql = `
            SELECT
                TO_CHAR(al.created_at, 'DD/MM/YYYY HH24:MI') as "Date/Heure",
                u.username as "Utilisateur",
                u.role as "Rôle",
                al.action as "Action",
                al.ip_address as "Adresse IP",
                al.details::text as "Détails"
            FROM activity_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (dateFrom) {
            params.push(dateFrom);
            sql += ` AND al.created_at >= $${params.length}`;
        }

        if (dateTo) {
            params.push(dateTo);
            sql += ` AND al.created_at <= $${params.length}`;
        }

        if (userId) {
            params.push(userId);
            sql += ` AND al.user_id = $${params.length}`;
        }

        sql += ' ORDER BY al.created_at DESC LIMIT 10000';

        const result = await query(sql, params);

        res.json({
            filename: `logs_activite_${new Date().toISOString().split('T')[0]}.xlsx`,
            sheetName: 'Logs',
            data: result.rows
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
