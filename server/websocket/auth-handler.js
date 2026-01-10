/**
 * Gestionnaire d'authentification pour les connexions WebSocket
 */

const jwt = require('jsonwebtoken');
const { query } = require('../database/db');
const { getDocumentPermission, hasPermission } = require('../middleware/document-access');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

/**
 * Vérifie un token JWT et retourne les informations utilisateur
 * @param {string} token - Token JWT
 * @returns {Promise<object|null>} - Utilisateur ou null si invalide
 */
async function verifyToken(token) {
    if (!token) {
        return null;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Récupérer les infos utilisateur à jour depuis la base
        const result = await query(
            `SELECT id, username, email, first_name, last_name, role
             FROM users WHERE id = $1`,
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0];
    } catch (error) {
        console.error('Erreur vérification token WebSocket:', error.message);
        return null;
    }
}

/**
 * Vérifie si un utilisateur peut accéder à un document
 * @param {object} user - Utilisateur authentifié
 * @param {string} documentSlug - Slug du document
 * @param {string} requiredPermission - Permission requise ('view', 'edit')
 * @returns {Promise<{allowed: boolean, permission: string, documentId: string|null}>}
 */
async function checkDocumentAccess(user, documentSlug, requiredPermission = 'view') {
    try {
        // Récupérer le document par son slug
        const docResult = await query(
            'SELECT id FROM collaborative_documents WHERE slug = $1',
            [documentSlug]
        );

        if (docResult.rows.length === 0) {
            return { allowed: false, permission: 'none', documentId: null };
        }

        const documentId = docResult.rows[0].id;
        const permission = await getDocumentPermission(user.id, user.role, documentId);

        return {
            allowed: hasPermission(permission, requiredPermission),
            permission,
            documentId
        };
    } catch (error) {
        console.error('Erreur vérification accès document:', error);
        return { allowed: false, permission: 'none', documentId: null };
    }
}

/**
 * Génère une couleur unique pour un utilisateur (pour le curseur)
 * @param {number} userId - ID utilisateur
 * @returns {string} - Couleur hexadécimale (#RRGGBB)
 */
function getUserColor(userId) {
    // Palette de couleurs distinctes
    const colors = [
        '#E53935', '#D81B60', '#8E24AA', '#5E35B1',
        '#3949AB', '#1E88E5', '#039BE5', '#00ACC1',
        '#00897B', '#43A047', '#7CB342', '#C0CA33',
        '#FDD835', '#FFB300', '#FB8C00', '#F4511E'
    ];
    return colors[userId % colors.length];
}

module.exports = {
    verifyToken,
    checkDocumentAccess,
    getUserColor
};
