/**
 * Module de gestion de la présence pour les documents collaboratifs
 * Affiche les utilisateurs actuellement connectés au document
 */

const CollabPresence = {
    containerId: 'active-users',
    users: new Map(),
    awareness: null,

    /**
     * Initialise le suivi de présence
     * @param {object} provider - Provider WebSocket Yjs
     */
    init(provider) {
        if (!provider || !provider.awareness) {
            console.warn('[Presence] Provider ou awareness non disponible');
            return;
        }

        this.awareness = provider.awareness;

        // Écouter les changements d'awareness
        this.awareness.on('change', () => {
            this.updateUsers();
        });

        // Mise à jour initiale
        this.updateUsers();
    },

    /**
     * Met à jour la liste des utilisateurs
     */
    updateUsers() {
        if (!this.awareness) return;

        this.users.clear();

        // Récupérer tous les états d'awareness
        this.awareness.getStates().forEach((state, clientId) => {
            if (state.user) {
                this.users.set(clientId, {
                    name: state.user.name || 'Anonyme',
                    color: state.user.color || '#888888',
                    isLocal: clientId === this.awareness.clientID
                });
            }
        });

        this.render();
    },

    /**
     * Affiche les avatars des utilisateurs
     */
    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        // Trier : utilisateur local en premier
        const sortedUsers = Array.from(this.users.entries())
            .sort((a, b) => {
                if (a[1].isLocal) return -1;
                if (b[1].isLocal) return 1;
                return a[1].name.localeCompare(b[1].name);
            });

        // Générer le HTML
        const maxVisible = 5;
        const visibleUsers = sortedUsers.slice(0, maxVisible);
        const hiddenCount = Math.max(0, sortedUsers.length - maxVisible);

        let html = '<div class="presence-avatars">';

        visibleUsers.forEach(([clientId, user]) => {
            const initials = this.getInitials(user.name);
            const isLocalClass = user.isLocal ? 'is-local' : '';

            html += `
                <div class="presence-avatar ${isLocalClass}"
                     style="background-color: ${user.color}"
                     title="${this.escapeHtml(user.name)}${user.isLocal ? ' (vous)' : ''}">
                    ${initials}
                </div>
            `;
        });

        if (hiddenCount > 0) {
            html += `
                <div class="presence-avatar presence-more"
                     title="${hiddenCount} autre(s) utilisateur(s)">
                    +${hiddenCount}
                </div>
            `;
        }

        html += '</div>';

        // Ajouter le compteur
        const count = this.users.size;
        html += `
            <span class="presence-count">
                <i class="fas fa-users"></i> ${count} connecté${count > 1 ? 's' : ''}
            </span>
        `;

        container.innerHTML = html;
    },

    /**
     * Récupère les initiales d'un nom
     */
    getInitials(name) {
        if (!name) return '?';

        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    },

    /**
     * Échappe le HTML
     */
    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    /**
     * Nettoie les ressources
     */
    destroy() {
        this.users.clear();
        this.awareness = null;

        const container = document.getElementById(this.containerId);
        if (container) {
            container.innerHTML = '';
        }
    }
};

// Export global
if (typeof window !== 'undefined') {
    window.CollabPresence = CollabPresence;
}
