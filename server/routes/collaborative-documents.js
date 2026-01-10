/**
 * Routes API pour les documents collaboratifs
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query, transaction } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const {
    requireDocumentAccess,
    requireDocumentOwner,
    getDocumentPermission
} = require('../middleware/document-access');

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

/**
 * Génère un slug unique à partir du titre
 */
function generateSlug(title) {
    const base = title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Supprimer accents
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    const random = Math.random().toString(36).substring(2, 8);
    return `${base}-${random}`;
}

/**
 * GET /api/collab/documents
 * Liste les documents accessibles par l'utilisateur
 */
router.get('/documents', async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const { visibility, formation_id, search, limit = 50, offset = 0, include_archived } = req.query;

        let sql = `
            SELECT DISTINCT cd.id, cd.title, cd.slug, cd.visibility, cd.formation_id,
                   cd.created_at, cd.updated_at, cd.owner_id, cd.archived,
                   u.first_name as owner_first_name, u.last_name as owner_last_name,
                   u.username as owner_username,
                   f.name as formation_name,
                   (SELECT COUNT(*) FROM document_sessions ds
                    WHERE ds.document_id = cd.id
                    AND ds.last_seen_at > CURRENT_TIMESTAMP - INTERVAL '5 minutes') as active_users
            FROM collaborative_documents cd
            LEFT JOIN users u ON cd.owner_id = u.id
            LEFT JOIN formations f ON cd.formation_id = f.id
            LEFT JOIN document_permissions dp ON cd.id = dp.document_id
            WHERE (
                cd.owner_id = $1
                OR cd.visibility = 'public'
                OR dp.user_id = $1
                OR dp.role = $2
                OR (cd.visibility = 'formation' AND cd.formation_id IN (
                    SELECT formation_id FROM enrollments
                    WHERE user_id = $1 AND status = 'active'
                ))
            )
        `;

        // Par défaut, exclure les documents archivés
        if (include_archived !== 'true') {
            sql += ` AND (cd.archived = FALSE OR cd.archived IS NULL)`;
        }

        const params = [userId, userRole];
        let paramIndex = 3;

        if (visibility) {
            sql += ` AND cd.visibility = $${paramIndex}`;
            params.push(visibility);
            paramIndex++;
        }

        if (formation_id) {
            sql += ` AND cd.formation_id = $${paramIndex}`;
            params.push(parseInt(formation_id));
            paramIndex++;
        }

        if (search) {
            sql += ` AND (cd.title ILIKE $${paramIndex} OR cd.html_content ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        sql += ` ORDER BY cd.updated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await query(sql, params);

        // Ajouter les permissions pour chaque document
        const documents = await Promise.all(result.rows.map(async (doc) => {
            const permission = await getDocumentPermission(userId, userRole, doc.id);
            return {
                ...doc,
                ownerName: doc.owner_first_name && doc.owner_last_name
                    ? `${doc.owner_first_name} ${doc.owner_last_name}`
                    : doc.owner_username,
                permission,
                canEdit: permission === 'edit' || permission === 'admin'
            };
        }));

        res.json(documents);
    } catch (error) {
        console.error('Erreur liste documents collaboratifs:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/collab/documents
 * Créer un nouveau document collaboratif
 */
router.post('/documents', async (req, res) => {
    try {
        const userId = req.user.id;
        const { title, visibility = 'private', formation_id = null } = req.body;

        if (!title || title.trim().length === 0) {
            return res.status(400).json({ error: 'Le titre est requis' });
        }

        if (title.length > 255) {
            return res.status(400).json({ error: 'Le titre ne peut pas dépasser 255 caractères' });
        }

        const validVisibilities = ['private', 'formation', 'public'];
        if (!validVisibilities.includes(visibility)) {
            return res.status(400).json({ error: 'Visibilité invalide' });
        }

        const slug = generateSlug(title.trim());

        const result = await query(
            `INSERT INTO collaborative_documents
             (title, slug, owner_id, visibility, formation_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, title, slug, visibility, formation_id, created_at`,
            [title.trim(), slug, userId, visibility, formation_id]
        );

        const document = result.rows[0];

        // Log de l'activité
        await query(
            `INSERT INTO activity_logs (user_id, action, details, ip_address)
             VALUES ($1, 'create_collaborative_document', $2, $3)`,
            [userId, JSON.stringify({ documentId: document.id, title }), req.ip]
        );

        res.status(201).json({
            ...document,
            permission: 'admin',
            canEdit: true
        });
    } catch (error) {
        console.error('Erreur création document collaboratif:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/collab/documents/:id
 * Récupérer les détails d'un document
 */
router.get('/documents/:id', requireDocumentAccess('view'), async (req, res) => {
    try {
        const documentId = req.params.id;

        const result = await query(
            `SELECT cd.*,
                    u.first_name as owner_first_name, u.last_name as owner_last_name,
                    u.username as owner_username,
                    f.name as formation_name
             FROM collaborative_documents cd
             LEFT JOIN users u ON cd.owner_id = u.id
             LEFT JOIN formations f ON cd.formation_id = f.id
             WHERE cd.id = $1`,
            [documentId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Document non trouvé' });
        }

        const doc = result.rows[0];

        res.json({
            ...doc,
            ownerName: doc.owner_first_name && doc.owner_last_name
                ? `${doc.owner_first_name} ${doc.owner_last_name}`
                : doc.owner_username,
            permission: req.documentPermission,
            canEdit: req.documentPermission === 'edit' || req.documentPermission === 'admin'
        });
    } catch (error) {
        console.error('Erreur récupération document:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * PUT /api/collab/documents/:id
 * Mettre à jour les métadonnées d'un document (titre, visibilité)
 */
router.put('/documents/:id', requireDocumentAccess('admin'), async (req, res) => {
    try {
        const documentId = req.params.id;
        const { title, visibility, formation_id } = req.body;

        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (title !== undefined) {
            if (title.trim().length === 0) {
                return res.status(400).json({ error: 'Le titre ne peut pas être vide' });
            }
            if (title.length > 255) {
                return res.status(400).json({ error: 'Le titre ne peut pas dépasser 255 caractères' });
            }
            updates.push(`title = $${paramIndex}`);
            params.push(title.trim());
            paramIndex++;
        }

        if (visibility !== undefined) {
            const validVisibilities = ['private', 'formation', 'public'];
            if (!validVisibilities.includes(visibility)) {
                return res.status(400).json({ error: 'Visibilité invalide' });
            }
            updates.push(`visibility = $${paramIndex}`);
            params.push(visibility);
            paramIndex++;
        }

        if (formation_id !== undefined) {
            updates.push(`formation_id = $${paramIndex}`);
            params.push(formation_id);
            paramIndex++;
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Aucune modification fournie' });
        }

        params.push(documentId);
        const result = await query(
            `UPDATE collaborative_documents
             SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
             WHERE id = $${paramIndex}
             RETURNING *`,
            params
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erreur mise à jour document:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * PUT /api/collab/documents/:id/archive
 * Archiver un document
 */
router.put('/documents/:id/archive', requireDocumentOwner, async (req, res) => {
    try {
        const documentId = req.params.id;
        const userId = req.user.id;

        const result = await query(
            `UPDATE collaborative_documents
             SET archived = TRUE, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING id, title, archived`,
            [documentId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Document non trouvé' });
        }

        // Log de l'activité
        await query(
            `INSERT INTO activity_logs (user_id, action, details, ip_address)
             VALUES ($1, 'archive_collaborative_document', $2, $3)`,
            [userId, JSON.stringify({ documentId, title: result.rows[0].title }), req.ip]
        );

        res.json({ message: 'Document archivé', document: result.rows[0] });
    } catch (error) {
        console.error('Erreur archivage document:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * PUT /api/collab/documents/:id/unarchive
 * Désarchiver un document
 */
router.put('/documents/:id/unarchive', requireDocumentOwner, async (req, res) => {
    try {
        const documentId = req.params.id;
        const userId = req.user.id;

        const result = await query(
            `UPDATE collaborative_documents
             SET archived = FALSE, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING id, title, archived`,
            [documentId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Document non trouvé' });
        }

        // Log de l'activité
        await query(
            `INSERT INTO activity_logs (user_id, action, details, ip_address)
             VALUES ($1, 'unarchive_collaborative_document', $2, $3)`,
            [userId, JSON.stringify({ documentId, title: result.rows[0].title }), req.ip]
        );

        res.json({ message: 'Document désarchivé', document: result.rows[0] });
    } catch (error) {
        console.error('Erreur désarchivage document:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * DELETE /api/collab/documents/:id
 * Supprimer un document
 */
router.delete('/documents/:id', requireDocumentOwner, async (req, res) => {
    try {
        const documentId = req.params.id;
        const userId = req.user.id;

        await query('DELETE FROM collaborative_documents WHERE id = $1', [documentId]);

        // Log de l'activité
        await query(
            `INSERT INTO activity_logs (user_id, action, details, ip_address)
             VALUES ($1, 'delete_collaborative_document', $2, $3)`,
            [userId, JSON.stringify({ documentId }), req.ip]
        );

        res.json({ message: 'Document supprimé' });
    } catch (error) {
        console.error('Erreur suppression document:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ============ PERMISSIONS ============

/**
 * GET /api/collab/documents/:id/permissions
 * Liste les permissions d'un document
 */
router.get('/documents/:id/permissions', requireDocumentAccess('admin'), async (req, res) => {
    try {
        const documentId = req.params.id;

        const result = await query(
            `SELECT dp.id, dp.user_id, dp.role, dp.formation_id, dp.permission, dp.created_at,
                    u.first_name, u.last_name, u.username, u.email,
                    f.name as formation_name
             FROM document_permissions dp
             LEFT JOIN users u ON dp.user_id = u.id
             LEFT JOIN formations f ON dp.formation_id = f.id
             WHERE dp.document_id = $1
             ORDER BY dp.created_at DESC`,
            [documentId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Erreur récupération permissions:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/collab/documents/:id/permissions
 * Ajouter une permission à un document
 */
router.post('/documents/:id/permissions', requireDocumentAccess('admin'), async (req, res) => {
    try {
        const documentId = req.params.id;
        const userId = req.user.id;
        const { user_id, role, formation_id, permission } = req.body;

        // Validation
        const validPermissions = ['view', 'comment', 'edit', 'admin'];
        if (!validPermissions.includes(permission)) {
            return res.status(400).json({ error: 'Permission invalide' });
        }

        // Une seule cible doit être spécifiée
        const targets = [user_id, role, formation_id].filter(t => t !== undefined && t !== null);
        if (targets.length !== 1) {
            return res.status(400).json({
                error: 'Exactement un type de cible doit être spécifié (user_id, role, ou formation_id)'
            });
        }

        // Validation du rôle si spécifié
        if (role) {
            const validRoles = ['student', 'trainer', 'secretary', 'admin'];
            if (!validRoles.includes(role)) {
                return res.status(400).json({ error: 'Rôle invalide' });
            }
        }

        const result = await query(
            `INSERT INTO document_permissions
             (document_id, user_id, role, formation_id, permission, created_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (document_id, user_id) DO UPDATE SET permission = $5
             RETURNING *`,
            [documentId, user_id || null, role || null, formation_id || null, permission, userId]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Erreur ajout permission:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * DELETE /api/collab/documents/:id/permissions/:permissionId
 * Supprimer une permission
 */
router.delete('/documents/:id/permissions/:permissionId', requireDocumentAccess('admin'), async (req, res) => {
    try {
        const { id: documentId, permissionId } = req.params;

        const result = await query(
            'DELETE FROM document_permissions WHERE id = $1 AND document_id = $2 RETURNING *',
            [permissionId, documentId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Permission non trouvée' });
        }

        res.json({ message: 'Permission supprimée' });
    } catch (error) {
        console.error('Erreur suppression permission:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ============ VERSIONS ============

/**
 * GET /api/collab/documents/:id/versions
 * Liste les versions d'un document
 */
router.get('/documents/:id/versions', requireDocumentAccess('view'), async (req, res) => {
    try {
        const documentId = req.params.id;

        const result = await query(
            `SELECT dv.id, dv.version_number, dv.comment, dv.created_at,
                    u.first_name, u.last_name, u.username
             FROM document_versions dv
             LEFT JOIN users u ON dv.created_by = u.id
             WHERE dv.document_id = $1
             ORDER BY dv.version_number DESC`,
            [documentId]
        );

        res.json(result.rows.map(v => ({
            ...v,
            createdBy: v.first_name && v.last_name
                ? `${v.first_name} ${v.last_name}`
                : v.username
        })));
    } catch (error) {
        console.error('Erreur récupération versions:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/collab/documents/:id/versions
 * Créer une nouvelle version (snapshot)
 */
router.post('/documents/:id/versions', requireDocumentAccess('edit'), async (req, res) => {
    try {
        const documentId = req.params.id;
        const userId = req.user.id;
        const { comment } = req.body;

        // Récupérer l'état actuel du document
        const docResult = await query(
            'SELECT yjs_state FROM collaborative_documents WHERE id = $1',
            [documentId]
        );

        if (docResult.rows.length === 0 || !docResult.rows[0].yjs_state) {
            return res.status(400).json({ error: 'Le document est vide' });
        }

        // Récupérer le prochain numéro de version
        const versionResult = await query(
            `SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
             FROM document_versions WHERE document_id = $1`,
            [documentId]
        );

        const nextVersion = versionResult.rows[0].next_version;

        // Créer la version
        const result = await query(
            `INSERT INTO document_versions
             (document_id, yjs_snapshot, version_number, created_by, comment)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, version_number, comment, created_at`,
            [documentId, docResult.rows[0].yjs_state, nextVersion, userId, comment || null]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Erreur création version:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ============ SESSIONS ACTIVES ============

/**
 * GET /api/collab/documents/:id/sessions
 * Liste les utilisateurs actuellement connectés au document
 */
router.get('/documents/:id/sessions', requireDocumentAccess('view'), async (req, res) => {
    try {
        const documentId = req.params.id;

        const result = await query(
            `SELECT ds.user_id, ds.color, ds.last_seen_at,
                    u.first_name, u.last_name, u.username
             FROM document_sessions ds
             JOIN users u ON ds.user_id = u.id
             WHERE ds.document_id = $1
             AND ds.last_seen_at > CURRENT_TIMESTAMP - INTERVAL '5 minutes'
             ORDER BY ds.last_seen_at DESC`,
            [documentId]
        );

        res.json(result.rows.map(s => ({
            userId: s.user_id,
            name: s.first_name && s.last_name
                ? `${s.first_name} ${s.last_name}`
                : s.username,
            color: s.color,
            lastSeen: s.last_seen_at
        })));
    } catch (error) {
        console.error('Erreur récupération sessions:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
