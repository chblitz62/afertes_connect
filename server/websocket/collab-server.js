/**
 * Serveur HocusPocus pour l'édition collaborative temps réel
 * Compatible avec @hocuspocus/server v3.x
 */

const { Server } = require('@hocuspocus/server');
const { Database } = require('@hocuspocus/extension-database');
const { verifyToken, checkDocumentAccess, getUserColor } = require('./auth-handler');
const {
    fetchDocument,
    storeDocument,
    updateSession,
    removeSession,
    cleanupInactiveSessions
} = require('./persistence-handler');

// Port WebSocket (séparé du serveur HTTP principal)
const COLLAB_PORT = process.env.COLLAB_WS_PORT || 1234;

// Debounce pour la sauvegarde (en ms)
const SAVE_DEBOUNCE = 1000;

/**
 * Crée et configure le serveur HocusPocus
 */
function createCollabServer() {
    const server = new Server({
        port: COLLAB_PORT,
        name: 'AFERTES-Collab',

        // Timeout pour les connexions inactives
        timeout: 30000,

        // Debounce pour les sauvegardes
        debounce: SAVE_DEBOUNCE,

        /**
         * Authentification lors de la connexion
         */
        async onAuthenticate(data) {
            const { token, documentName } = data;

            // Vérifier le token JWT
            const user = await verifyToken(token);
            if (!user) {
                throw new Error('Token invalide ou expiré');
            }

            // Vérifier l'accès au document
            const access = await checkDocumentAccess(user, documentName, 'view');
            if (!access.allowed) {
                throw new Error('Accès refusé à ce document');
            }

            // Déterminer si l'utilisateur peut éditer
            const canEdit = access.permission === 'edit' || access.permission === 'admin';

            // Retourner le contexte utilisateur
            return {
                user: {
                    id: user.id,
                    name: user.first_name && user.last_name
                        ? `${user.first_name} ${user.last_name}`
                        : user.username,
                    color: getUserColor(user.id),
                    role: user.role
                },
                documentId: access.documentId,
                permission: access.permission,
                canEdit
            };
        },

        /**
         * Connexion établie
         */
        async onConnect(data) {
            const { documentName, context } = data;

            if (context && context.documentId && context.user) {
                // Enregistrer la session
                await updateSession(
                    context.documentId,
                    context.user.id,
                    null,
                    context.user.color
                );

                console.log(`[Collab] ${context.user.name} connecté au document ${documentName}`);
            }
        },

        /**
         * Déconnexion
         */
        async onDisconnect(data) {
            const { documentName, context } = data;

            if (context && context.documentId && context.user) {
                // Supprimer la session
                await removeSession(context.documentId, context.user.id);

                console.log(`[Collab] ${context.user.name} déconnecté du document ${documentName}`);
            }
        },

        /**
         * Extension de persistance PostgreSQL
         */
        extensions: [
            new Database({
                /**
                 * Charger le document depuis PostgreSQL
                 */
                fetch: async ({ documentName }) => {
                    const state = await fetchDocument(documentName);
                    return state;
                },

                /**
                 * Sauvegarder le document dans PostgreSQL
                 */
                store: async ({ documentName, state, context }) => {
                    const userId = context?.user?.id || null;
                    await storeDocument(documentName, state, userId);
                }
            })
        ]
    });

    return server;
}

/**
 * Démarre le serveur de collaboration
 */
async function startCollabServer() {
    const server = createCollabServer();

    // Nettoyer les sessions inactives toutes les minutes
    setInterval(cleanupInactiveSessions, 60000);

    // Démarrer le serveur
    await server.listen();

    console.log(`[Collab] Serveur WebSocket démarré sur le port ${COLLAB_PORT}`);

    return server;
}

module.exports = {
    createCollabServer,
    startCollabServer
};
