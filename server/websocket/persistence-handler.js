/**
 * Gestionnaire de persistance PostgreSQL pour les documents Yjs
 */

const { query, transaction } = require('../database/db');

/**
 * Charge l'état Yjs d'un document depuis PostgreSQL
 * @param {string} documentSlug - Slug du document
 * @returns {Promise<Uint8Array|null>} - État Yjs ou null si nouveau
 */
async function fetchDocument(documentSlug) {
    try {
        const result = await query(
            'SELECT yjs_state FROM collaborative_documents WHERE slug = $1',
            [documentSlug]
        );

        if (result.rows.length === 0 || !result.rows[0].yjs_state) {
            return null;
        }

        // PostgreSQL retourne un Buffer, on le convertit en Uint8Array
        return new Uint8Array(result.rows[0].yjs_state);
    } catch (error) {
        console.error('Erreur chargement document Yjs:', error);
        return null;
    }
}

/**
 * Sauvegarde l'état Yjs d'un document dans PostgreSQL
 * @param {string} documentSlug - Slug du document
 * @param {Uint8Array} state - État Yjs sérialisé
 * @param {number} userId - ID de l'utilisateur qui a modifié
 */
async function storeDocument(documentSlug, state, userId = null) {
    try {
        await query(
            `UPDATE collaborative_documents
             SET yjs_state = $1,
                 updated_at = CURRENT_TIMESTAMP,
                 last_edited_by = $2
             WHERE slug = $3`,
            [Buffer.from(state), userId, documentSlug]
        );
    } catch (error) {
        console.error('Erreur sauvegarde document Yjs:', error);
        throw error;
    }
}

/**
 * Crée un snapshot/version du document
 * @param {string} documentId - UUID du document
 * @param {Uint8Array} state - État Yjs
 * @param {number} userId - ID utilisateur
 * @param {string} comment - Commentaire optionnel
 */
async function createVersion(documentId, state, userId, comment = null) {
    try {
        // Récupérer le dernier numéro de version
        const versionResult = await query(
            `SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
             FROM document_versions WHERE document_id = $1`,
            [documentId]
        );

        const nextVersion = versionResult.rows[0].next_version;

        await query(
            `INSERT INTO document_versions
             (document_id, yjs_snapshot, version_number, created_by, comment)
             VALUES ($1, $2, $3, $4, $5)`,
            [documentId, Buffer.from(state), nextVersion, userId, comment]
        );

        return nextVersion;
    } catch (error) {
        console.error('Erreur création version:', error);
        throw error;
    }
}

/**
 * Met à jour la session de présence d'un utilisateur
 * @param {string} documentId - UUID du document
 * @param {number} userId - ID utilisateur
 * @param {object} cursorPosition - Position du curseur (optionnel)
 * @param {string} color - Couleur du curseur
 */
async function updateSession(documentId, userId, cursorPosition = null, color = null) {
    try {
        await query(
            `INSERT INTO document_sessions (document_id, user_id, cursor_position, color, last_seen_at)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
             ON CONFLICT (document_id, user_id)
             DO UPDATE SET
                 cursor_position = EXCLUDED.cursor_position,
                 color = EXCLUDED.color,
                 last_seen_at = CURRENT_TIMESTAMP`,
            [documentId, userId, JSON.stringify(cursorPosition), color]
        );
    } catch (error) {
        console.error('Erreur mise à jour session:', error);
    }
}

/**
 * Supprime la session d'un utilisateur
 * @param {string} documentId - UUID du document
 * @param {number} userId - ID utilisateur
 */
async function removeSession(documentId, userId) {
    try {
        await query(
            'DELETE FROM document_sessions WHERE document_id = $1 AND user_id = $2',
            [documentId, userId]
        );
    } catch (error) {
        console.error('Erreur suppression session:', error);
    }
}

/**
 * Récupère les utilisateurs actifs sur un document
 * @param {string} documentId - UUID du document
 * @returns {Promise<Array>} - Liste des utilisateurs actifs
 */
async function getActiveSessions(documentId) {
    try {
        const result = await query(
            `SELECT ds.user_id, ds.cursor_position, ds.color, ds.last_seen_at,
                    u.first_name, u.last_name, u.username
             FROM document_sessions ds
             JOIN users u ON ds.user_id = u.id
             WHERE ds.document_id = $1
             AND ds.last_seen_at > CURRENT_TIMESTAMP - INTERVAL '5 minutes'`,
            [documentId]
        );

        return result.rows.map(row => ({
            userId: row.user_id,
            name: row.first_name && row.last_name
                ? `${row.first_name} ${row.last_name}`
                : row.username,
            color: row.color,
            cursorPosition: row.cursor_position,
            lastSeen: row.last_seen_at
        }));
    } catch (error) {
        console.error('Erreur récupération sessions:', error);
        return [];
    }
}

/**
 * Nettoie les sessions inactives
 */
async function cleanupInactiveSessions() {
    try {
        const result = await query(
            `DELETE FROM document_sessions
             WHERE last_seen_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes'
             RETURNING document_id, user_id`
        );

        if (result.rowCount > 0) {
            console.log(`Nettoyé ${result.rowCount} sessions inactives`);
        }
    } catch (error) {
        console.error('Erreur nettoyage sessions:', error);
    }
}

module.exports = {
    fetchDocument,
    storeDocument,
    createVersion,
    updateSession,
    removeSession,
    getActiveSessions,
    cleanupInactiveSessions
};
