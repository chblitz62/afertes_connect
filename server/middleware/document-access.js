/**
 * Middleware de vérification des permissions pour les documents collaboratifs
 */

const { query } = require('../database/db');

// Niveaux de permission (du plus bas au plus haut)
const PERMISSION_LEVELS = {
    'none': 0,
    'view': 1,
    'comment': 2,
    'edit': 3,
    'admin': 4
};

/**
 * Récupère la permission effective d'un utilisateur sur un document
 * @param {number} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur (student, trainer, etc.)
 * @param {string} documentId - UUID du document
 * @returns {Promise<string>} - Niveau de permission ('none', 'view', 'edit', 'admin')
 */
async function getDocumentPermission(userId, userRole, documentId) {
    // 1. Récupérer le document et ses infos de base
    const docResult = await query(
        `SELECT owner_id, visibility, formation_id
         FROM collaborative_documents WHERE id = $1`,
        [documentId]
    );

    if (docResult.rows.length === 0) {
        return 'none';
    }

    const doc = docResult.rows[0];

    // 2. Si l'utilisateur est le propriétaire -> admin
    if (doc.owner_id === userId) {
        return 'admin';
    }

    // 3. Récupérer toutes les permissions applicables
    const permResult = await query(
        `SELECT permission FROM document_permissions
         WHERE document_id = $1
         AND (
             user_id = $2
             OR role = $3
             OR formation_id IN (
                 SELECT formation_id FROM enrollments
                 WHERE user_id = $2 AND status = 'active'
             )
         )`,
        [documentId, userId, userRole]
    );

    // Trouver la permission maximale
    let maxPermission = 'none';
    for (const row of permResult.rows) {
        if (PERMISSION_LEVELS[row.permission] > PERMISSION_LEVELS[maxPermission]) {
            maxPermission = row.permission;
        }
    }

    // 4. Appliquer les règles de visibilité si aucune permission explicite
    if (maxPermission === 'none') {
        if (doc.visibility === 'public') {
            maxPermission = 'view';
        } else if (doc.visibility === 'formation' && doc.formation_id) {
            // Vérifier si l'utilisateur est dans la même formation
            const enrollResult = await query(
                `SELECT 1 FROM enrollments
                 WHERE user_id = $1 AND formation_id = $2 AND status = 'active'`,
                [userId, doc.formation_id]
            );
            if (enrollResult.rows.length > 0) {
                maxPermission = 'view';
            }
        }
    }

    return maxPermission;
}

/**
 * Vérifie si un utilisateur a au moins un certain niveau de permission
 * @param {string} userPermission - Permission de l'utilisateur
 * @param {string} requiredPermission - Permission requise
 * @returns {boolean}
 */
function hasPermission(userPermission, requiredPermission) {
    return PERMISSION_LEVELS[userPermission] >= PERMISSION_LEVELS[requiredPermission];
}

/**
 * Middleware Express pour vérifier l'accès à un document
 * @param {string} requiredPermission - Permission minimale requise ('view', 'edit', 'admin')
 */
function requireDocumentAccess(requiredPermission = 'view') {
    return async (req, res, next) => {
        try {
            const documentId = req.params.id || req.params.documentId;
            const userId = req.user.id;
            const userRole = req.user.role;

            if (!documentId) {
                return res.status(400).json({ error: 'ID du document requis' });
            }

            const permission = await getDocumentPermission(userId, userRole, documentId);

            if (!hasPermission(permission, requiredPermission)) {
                return res.status(403).json({
                    error: 'Accès refusé',
                    required: requiredPermission,
                    current: permission
                });
            }

            // Attacher la permission au request pour usage ultérieur
            req.documentPermission = permission;
            next();
        } catch (error) {
            console.error('Erreur vérification permission document:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    };
}

/**
 * Middleware pour vérifier que l'utilisateur est propriétaire du document
 */
async function requireDocumentOwner(req, res, next) {
    try {
        const documentId = req.params.id || req.params.documentId;
        const userId = req.user.id;

        const result = await query(
            'SELECT owner_id FROM collaborative_documents WHERE id = $1',
            [documentId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Document non trouvé' });
        }

        if (result.rows[0].owner_id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Seul le propriétaire peut effectuer cette action' });
        }

        next();
    } catch (error) {
        console.error('Erreur vérification propriétaire:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
}

module.exports = {
    getDocumentPermission,
    hasPermission,
    requireDocumentAccess,
    requireDocumentOwner,
    PERMISSION_LEVELS
};
