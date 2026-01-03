/**
 * Routes de gestion des documents
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { query } = require('../database/db');
const { authenticateToken, requireRole, requireSelfOrAdmin } = require('../middleware/auth');

// Configuration du stockage des fichiers
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = process.env.UPLOAD_DIR || './uploads';
        const userDir = path.join(uploadDir, req.user.id.toString());

        // Créer le dossier utilisateur s'il n'existe pas
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }

        cb(null, userDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const filename = `${req.body.docType || 'document'}_${Date.now()}${ext}`;
        cb(null, filename);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB max
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Type de fichier non autorisé'), false);
        }
    }
});

// GET /api/documents - Liste des documents de l'utilisateur connecté
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await query(
            `SELECT id, doc_type, file_name, mime_type, file_size, uploaded_at
             FROM documents
             WHERE user_id = $1
             ORDER BY uploaded_at DESC`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/documents/user/:userId - Liste des documents d'un utilisateur (admin/secretary)
router.get('/user/:userId', authenticateToken, requireRole('admin', 'secretary'), async (req, res) => {
    try {
        const result = await query(
            `SELECT id, doc_type, file_name, mime_type, file_size, uploaded_at
             FROM documents
             WHERE user_id = $1
             ORDER BY doc_type, uploaded_at DESC`,
            [req.params.userId]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/documents/:id - Télécharger un document
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const result = await query(
            'SELECT * FROM documents WHERE id = $1',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Document non trouvé' });
        }

        const doc = result.rows[0];

        // Vérifier les droits d'accès
        if (doc.user_id !== req.user.id &&
            !['admin', 'secretary'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Accès non autorisé' });
        }

        const filePath = doc.file_path;
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Fichier non trouvé' });
        }

        res.download(filePath, doc.file_name);
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/documents/:id/view - Afficher un document (inline)
router.get('/:id/view', authenticateToken, async (req, res) => {
    try {
        const result = await query(
            'SELECT * FROM documents WHERE id = $1',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Document non trouvé' });
        }

        const doc = result.rows[0];

        // Vérifier les droits d'accès
        if (doc.user_id !== req.user.id &&
            !['admin', 'secretary'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Accès non autorisé' });
        }

        const filePath = doc.file_path;
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Fichier non trouvé' });
        }

        res.setHeader('Content-Type', doc.mime_type);
        res.setHeader('Content-Disposition', `inline; filename="${doc.file_name}"`);
        fs.createReadStream(filePath).pipe(res);
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/documents - Upload un document
router.post('/', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Aucun fichier fourni' });
        }

        const docType = req.body.docType || 'other';
        const validTypes = ['identity', 'vitale', 'photo', 'other'];
        if (!validTypes.includes(docType)) {
            return res.status(400).json({ error: 'Type de document invalide' });
        }

        // Supprimer l'ancien document du même type si existant
        const existing = await query(
            'SELECT file_path FROM documents WHERE user_id = $1 AND doc_type = $2',
            [req.user.id, docType]
        );

        if (existing.rows.length > 0) {
            const oldPath = existing.rows[0].file_path;
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
            await query('DELETE FROM documents WHERE user_id = $1 AND doc_type = $2', [req.user.id, docType]);
        }

        // Enregistrer le nouveau document
        const result = await query(
            `INSERT INTO documents (user_id, doc_type, file_name, file_path, mime_type, file_size)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id`,
            [req.user.id, docType, req.file.originalname, req.file.path, req.file.mimetype, req.file.size]
        );

        await query(
            'INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)',
            [req.user.id, 'document_uploaded', JSON.stringify({ docType }), req.ip]
        );

        res.status(201).json({ success: true, id: result.rows[0].id });
    } catch (error) {
        console.error('Erreur upload:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// DELETE /api/documents/:id - Supprimer un document
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const result = await query(
            'SELECT * FROM documents WHERE id = $1',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Document non trouvé' });
        }

        const doc = result.rows[0];

        // Vérifier les droits
        if (doc.user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Accès non autorisé' });
        }

        // Supprimer le fichier
        if (fs.existsSync(doc.file_path)) {
            fs.unlinkSync(doc.file_path);
        }

        // Supprimer l'enregistrement
        await query('DELETE FROM documents WHERE id = $1', [req.params.id]);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
