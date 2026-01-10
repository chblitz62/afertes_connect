/**
 * Module d'édition collaborative de documents
 * Utilise Quill + Yjs pour l'édition temps réel
 */

const CollaborativeEditor = {
    quill: null,
    ydoc: null,
    provider: null,
    binding: null,
    currentDocument: null,
    isReadOnly: false,

    // Configuration WebSocket
    wsUrl: null,

    /**
     * Initialise la configuration WebSocket
     */
    init() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        const port = 1234; // Port WebSocket collaboration
        this.wsUrl = `${protocol}//${host}:${port}`;
    },

    /**
     * Ouvre un document pour édition
     * @param {string} documentSlug - Slug du document
     * @param {string} containerId - ID du conteneur HTML
     * @param {object} options - Options (readOnly, onReady, onChange)
     */
    async open(documentSlug, containerId, options = {}) {
        const { readOnly = false, onReady = null, onChange = null } = options;

        this.isReadOnly = readOnly;
        this.currentDocument = documentSlug;

        // Nettoyer l'éditeur précédent si existant
        this.close();

        try {
            // Vérifier que Quill et Yjs sont chargés
            if (typeof Quill === 'undefined') {
                throw new Error('Quill non chargé');
            }
            if (typeof Y === 'undefined') {
                throw new Error('Yjs non chargé');
            }

            // Créer le document Yjs
            this.ydoc = new Y.Doc();

            // Récupérer le token JWT
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Non authentifié');
            }

            // Connecter au serveur WebSocket
            if (typeof WebsocketProvider !== 'undefined') {
                this.provider = new WebsocketProvider(
                    this.wsUrl,
                    documentSlug,
                    this.ydoc,
                    { params: { token } }
                );

                // Gérer les événements de connexion
                this.provider.on('status', (event) => {
                    console.log('[Collab] Status:', event.status);
                    this.updateConnectionStatus(event.status);
                });

                this.provider.on('sync', (isSynced) => {
                    console.log('[Collab] Synced:', isSynced);
                    if (isSynced && onReady) {
                        onReady();
                    }
                });

                // Configurer l'awareness (présence des utilisateurs)
                const awareness = this.provider.awareness;
                const currentUser = window.currentUser || {};

                awareness.setLocalStateField('user', {
                    name: currentUser.firstName && currentUser.lastName
                        ? `${currentUser.firstName} ${currentUser.lastName}`
                        : currentUser.email || 'Anonyme',
                    color: this.getUserColor(currentUser.id || Math.floor(Math.random() * 100))
                });

                // Observer les changements d'awareness pour la présence
                awareness.on('change', () => {
                    this.updatePresence(awareness);
                });
            }

            // Créer le conteneur Quill
            const container = document.getElementById(containerId);
            if (!container) {
                throw new Error(`Conteneur #${containerId} non trouvé`);
            }

            // Nettoyer le conteneur
            container.innerHTML = '';

            // Créer l'éditeur Quill
            this.quill = new Quill(container, {
                theme: 'snow',
                readOnly: readOnly,
                placeholder: 'Commencez à écrire...',
                modules: {
                    toolbar: readOnly ? false : [
                        [{ 'header': [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ 'color': [] }, { 'background': [] }],
                        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                        [{ 'align': [] }],
                        ['blockquote', 'code-block'],
                        ['link', 'image'],
                        ['clean']
                    ]
                }
            });

            // Lier Quill à Yjs
            const ytext = this.ydoc.getText('quill');
            if (typeof QuillBinding !== 'undefined') {
                this.binding = new QuillBinding(ytext, this.quill, this.provider?.awareness);
            }

            // Écouter les changements
            if (onChange) {
                this.quill.on('text-change', () => {
                    onChange(this.getHTML());
                });
            }

            // Mettre à jour le statut initial
            this.updateConnectionStatus(this.provider ? 'connecting' : 'local');

            console.log('[Collab] Éditeur Quill initialisé pour:', documentSlug);

            if (!this.provider && onReady) {
                onReady();
            }

        } catch (error) {
            console.error('[Collab] Erreur ouverture document:', error);
            this.showError(error.message);
            throw error;
        }
    },

    /**
     * Ferme l'éditeur et nettoie les ressources
     */
    close() {
        if (this.binding) {
            this.binding.destroy();
            this.binding = null;
        }

        if (this.provider) {
            this.provider.disconnect();
            this.provider.destroy();
            this.provider = null;
        }

        if (this.ydoc) {
            this.ydoc.destroy();
            this.ydoc = null;
        }

        if (this.quill) {
            // Quill n'a pas de méthode destroy, on nettoie le DOM
            const container = this.quill.container;
            if (container && container.parentNode) {
                container.innerHTML = '';
            }
            this.quill = null;
        }

        this.currentDocument = null;
    },

    /**
     * Met à jour l'affichage de la présence des utilisateurs
     */
    updatePresence(awareness) {
        const states = awareness.getStates();
        const users = [];

        states.forEach((state, clientId) => {
            if (state.user && clientId !== awareness.clientID) {
                users.push({
                    name: state.user.name,
                    color: state.user.color
                });
            }
        });

        // Mettre à jour l'affichage
        if (typeof CollabPresence !== 'undefined') {
            CollabPresence.update(users);
        }
    },

    /**
     * Met à jour l'affichage du statut de connexion
     */
    updateConnectionStatus(status) {
        const indicator = document.getElementById('connection-status');
        if (!indicator) return;

        const states = {
            connected: { class: 'connected', text: 'Connecté', icon: 'fa-circle' },
            connecting: { class: 'connecting', text: 'Connexion...', icon: 'fa-spinner fa-spin' },
            disconnected: { class: 'disconnected', text: 'Déconnecté', icon: 'fa-circle' },
            local: { class: 'local', text: 'Mode local', icon: 'fa-laptop' }
        };

        const state = states[status] || states.disconnected;
        indicator.className = `connection-status ${state.class}`;
        indicator.innerHTML = `<i class="fas ${state.icon}"></i> ${state.text}`;
    },

    /**
     * Génère une couleur unique pour un utilisateur
     */
    getUserColor(userId) {
        const colors = [
            '#E53935', '#D81B60', '#8E24AA', '#5E35B1',
            '#3949AB', '#1E88E5', '#039BE5', '#00ACC1',
            '#00897B', '#43A047', '#7CB342', '#C0CA33',
            '#FDD835', '#FFB300', '#FB8C00', '#F4511E'
        ];
        return colors[userId % colors.length];
    },

    /**
     * Affiche une erreur
     */
    showError(message) {
        if (typeof showToast === 'function') {
            showToast(message, 'error');
        } else {
            console.error('Erreur éditeur:', message);
        }
    },

    /**
     * Récupère le contenu HTML actuel
     */
    getHTML() {
        if (!this.quill) return '';
        return this.quill.root.innerHTML;
    },

    /**
     * Récupère le contenu texte
     */
    getText() {
        if (!this.quill) return '';
        return this.quill.getText();
    },

    /**
     * Définit le contenu HTML
     */
    setHTML(html) {
        if (!this.quill) return;
        this.quill.clipboard.dangerouslyPasteHTML(html);
    },

    /**
     * Vérifie si l'éditeur est vide
     */
    isEmpty() {
        if (!this.quill) return true;
        const text = this.quill.getText().trim();
        return text.length === 0;
    }
};

// Initialiser au chargement
if (typeof window !== 'undefined') {
    CollaborativeEditor.init();
    window.CollaborativeEditor = CollaborativeEditor;
}
