/**
 * Module d'édition collaborative de documents
 * Utilise TipTap + Yjs pour l'édition temps réel
 */

const CollaborativeEditor = {
    editor: null,
    ydoc: null,
    provider: null,
    currentDocument: null,
    isReadOnly: false,
    autoSaveTimeout: null,

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
            // Créer le document Yjs
            this.ydoc = new Y.Doc();

            // Récupérer le token JWT
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Non authentifié');
            }

            // Connecter au serveur WebSocket
            this.provider = new WebsocketProvider(
                this.wsUrl,
                documentSlug,
                this.ydoc,
                {
                    params: { token },
                    connect: true,
                    awareness: new awarenessProtocol.Awareness(this.ydoc)
                }
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
                name: currentUser.first_name && currentUser.last_name
                    ? `${currentUser.first_name} ${currentUser.last_name}`
                    : currentUser.username || 'Anonyme',
                color: this.getUserColor(currentUser.id || 0)
            });

            // Créer l'éditeur TipTap
            const container = document.getElementById(containerId);
            if (!container) {
                throw new Error(`Conteneur #${containerId} non trouvé`);
            }

            // Configuration des extensions TipTap
            const extensions = [
                TipTap.StarterKit.configure({
                    history: false // Désactivé car Yjs gère l'historique
                }),
                TipTap.Collaboration.configure({
                    document: this.ydoc
                }),
                TipTap.CollaborationCursor.configure({
                    provider: this.provider,
                    user: awareness.getLocalState()?.user
                }),
                TipTap.Placeholder.configure({
                    placeholder: 'Commencez à écrire...'
                }),
                TipTap.Image,
                TipTap.Link.configure({
                    openOnClick: false
                }),
                TipTap.TaskList,
                TipTap.TaskItem.configure({
                    nested: true
                }),
                TipTap.Table.configure({
                    resizable: true
                }),
                TipTap.TableRow,
                TipTap.TableCell,
                TipTap.TableHeader,
                TipTap.Highlight,
                TipTap.TextAlign.configure({
                    types: ['heading', 'paragraph']
                }),
                TipTap.Underline
            ];

            this.editor = new TipTap.Editor({
                element: container,
                extensions,
                editable: !readOnly,
                autofocus: !readOnly,
                onUpdate: ({ editor }) => {
                    if (onChange) {
                        onChange(editor.getHTML());
                    }
                }
            });

            // Mettre à jour la toolbar
            this.setupToolbar();

            console.log('[Collab] Éditeur initialisé pour:', documentSlug);

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
        if (this.editor) {
            this.editor.destroy();
            this.editor = null;
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

        this.currentDocument = null;
    },

    /**
     * Configure la toolbar de l'éditeur
     */
    setupToolbar() {
        const toolbar = document.getElementById('editor-toolbar-actions');
        if (!toolbar || !this.editor) return;

        // Actions de la toolbar
        const actions = {
            'btn-bold': () => this.editor.chain().focus().toggleBold().run(),
            'btn-italic': () => this.editor.chain().focus().toggleItalic().run(),
            'btn-underline': () => this.editor.chain().focus().toggleUnderline().run(),
            'btn-strike': () => this.editor.chain().focus().toggleStrike().run(),
            'btn-heading-1': () => this.editor.chain().focus().toggleHeading({ level: 1 }).run(),
            'btn-heading-2': () => this.editor.chain().focus().toggleHeading({ level: 2 }).run(),
            'btn-heading-3': () => this.editor.chain().focus().toggleHeading({ level: 3 }).run(),
            'btn-bullet-list': () => this.editor.chain().focus().toggleBulletList().run(),
            'btn-ordered-list': () => this.editor.chain().focus().toggleOrderedList().run(),
            'btn-task-list': () => this.editor.chain().focus().toggleTaskList().run(),
            'btn-blockquote': () => this.editor.chain().focus().toggleBlockquote().run(),
            'btn-code-block': () => this.editor.chain().focus().toggleCodeBlock().run(),
            'btn-horizontal-rule': () => this.editor.chain().focus().setHorizontalRule().run(),
            'btn-align-left': () => this.editor.chain().focus().setTextAlign('left').run(),
            'btn-align-center': () => this.editor.chain().focus().setTextAlign('center').run(),
            'btn-align-right': () => this.editor.chain().focus().setTextAlign('right').run(),
            'btn-highlight': () => this.editor.chain().focus().toggleHighlight().run(),
            'btn-link': () => this.insertLink(),
            'btn-image': () => this.insertImage(),
            'btn-table': () => this.editor.chain().focus().insertTable({ rows: 3, cols: 3 }).run(),
            'btn-undo': () => this.editor.chain().focus().undo().run(),
            'btn-redo': () => this.editor.chain().focus().redo().run()
        };

        // Attacher les événements
        Object.entries(actions).forEach(([id, action]) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.onclick = (e) => {
                    e.preventDefault();
                    if (!this.isReadOnly) {
                        action();
                    }
                };
            }
        });

        // Désactiver la toolbar si lecture seule
        if (this.isReadOnly) {
            toolbar.querySelectorAll('button').forEach(btn => {
                btn.disabled = true;
                btn.classList.add('disabled');
            });
        }
    },

    /**
     * Insère un lien
     */
    insertLink() {
        const url = prompt('URL du lien:');
        if (url) {
            this.editor.chain().focus().setLink({ href: url }).run();
        }
    },

    /**
     * Insère une image
     */
    insertImage() {
        const url = prompt('URL de l\'image:');
        if (url) {
            this.editor.chain().focus().setImage({ src: url }).run();
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
            disconnected: { class: 'disconnected', text: 'Déconnecté', icon: 'fa-circle' }
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
            alert('Erreur: ' + message);
        }
    },

    /**
     * Récupère le contenu HTML actuel
     */
    getHTML() {
        return this.editor ? this.editor.getHTML() : '';
    },

    /**
     * Récupère le contenu texte
     */
    getText() {
        return this.editor ? this.editor.getText() : '';
    },

    /**
     * Vérifie si l'éditeur est vide
     */
    isEmpty() {
        return this.editor ? this.editor.isEmpty : true;
    }
};

// Initialiser au chargement
if (typeof window !== 'undefined') {
    CollaborativeEditor.init();
    window.CollaborativeEditor = CollaborativeEditor;
}
