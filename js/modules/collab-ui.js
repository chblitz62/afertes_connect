/**
 * Module d'interface utilisateur pour les documents collaboratifs
 * Supporte le mode démo avec localStorage
 */

let currentCollabDocuments = [];
let currentEditingDocument = null;

// Vérifie si on est en mode démo (pas de token JWT valide)
function isDemoMode() {
    const token = localStorage.getItem('token');
    return !token || token === 'demo';
}

// ==================== API Démo (localStorage) ====================

const DemoCollabAPI = {
    STORAGE_KEY: 'afertes_collab_documents',

    getDocuments() {
        return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
    },

    saveDocuments(docs) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(docs));
    },

    getAll() {
        const docs = this.getDocuments();
        const currentUser = window.currentUser || {};
        return docs.map(doc => ({
            ...doc,
            ownerName: doc.owner_id === currentUser.id
                ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email
                : 'Utilisateur',
            // En mode démo, tous les documents sont éditables/supprimables
            canEdit: true,
            active_users: 0
        }));
    },

    getById(id) {
        const docs = this.getDocuments();
        const doc = docs.find(d => d.id === id);
        if (!doc) throw new Error('Document non trouvé');

        const currentUser = window.currentUser || {};
        return {
            ...doc,
            ownerName: currentUser.firstName
                ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim()
                : 'Vous',
            canEdit: true,  // En mode démo, toujours éditable
            permission: 'admin'
        };
    },

    create(data) {
        const docs = this.getDocuments();
        const currentUser = window.currentUser || {};

        const newDoc = {
            id: 'doc_' + Date.now(),
            slug: this.generateSlug(data.title),
            title: data.title,
            visibility: data.visibility || 'private',
            owner_id: currentUser.id || 1,
            html_content: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        docs.push(newDoc);
        this.saveDocuments(docs);

        return {
            ...newDoc,
            ownerName: `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email,
            canEdit: true
        };
    },

    update(id, data) {
        const docs = this.getDocuments();
        const index = docs.findIndex(d => d.id === id);
        if (index === -1) throw new Error('Document non trouvé');

        docs[index] = {
            ...docs[index],
            ...data,
            updated_at: new Date().toISOString()
        };

        this.saveDocuments(docs);
        return docs[index];
    },

    delete(id) {
        const docs = this.getDocuments();
        const filtered = docs.filter(d => d.id !== id);
        this.saveDocuments(filtered);
    },

    generateSlug(title) {
        return title
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') + '-' + Date.now();
    },

    saveContent(id, content) {
        const docs = this.getDocuments();
        const index = docs.findIndex(d => d.id === id);
        if (index !== -1) {
            docs[index].html_content = content;
            docs[index].updated_at = new Date().toISOString();
            this.saveDocuments(docs);
        }
    },

    archive(id) {
        const docs = this.getDocuments();
        const index = docs.findIndex(d => d.id === id);
        if (index !== -1) {
            docs[index].archived = true;
            docs[index].archived_at = new Date().toISOString();
            this.saveDocuments(docs);
        }
    },

    unarchive(id) {
        const docs = this.getDocuments();
        const index = docs.findIndex(d => d.id === id);
        if (index !== -1) {
            docs[index].archived = false;
            docs[index].archived_at = null;
            this.saveDocuments(docs);
        }
    }
};

/**
 * Charge et affiche la liste des documents collaboratifs
 */
async function loadCollabDocuments() {
    const container = document.getElementById('collab-docs-list');
    if (!container) return;

    try {
        container.innerHTML = '<div class="loading-placeholder"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>';

        let documents;
        if (isDemoMode()) {
            documents = DemoCollabAPI.getAll();
        } else {
            documents = await API.getCollabDocuments();
        }

        currentCollabDocuments = documents;
        filterCollabDocs(); // Appliquer le filtre (masque les archivés par défaut)
    } catch (error) {
        console.error('Erreur chargement documents collaboratifs:', error);
        // En cas d'erreur, essayer le mode démo
        if (!isDemoMode()) {
            console.log('Basculement vers le mode démo');
            currentCollabDocuments = DemoCollabAPI.getAll();
            filterCollabDocs();
        } else {
            container.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Erreur lors du chargement des documents</p>
                    <button class="btn btn-secondary" onclick="loadCollabDocuments()">Réessayer</button>
                </div>
            `;
        }
    }
}

/**
 * Affiche les documents collaboratifs
 */
function renderCollabDocuments(documents) {
    const container = document.getElementById('collab-docs-list');
    if (!container) return;

    if (documents.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-file-alt"></i>
                <h3>Aucun document</h3>
                <p>Créez votre premier document collaboratif</p>
                <button class="btn btn-primary" onclick="showNewDocumentModal()">
                    <i class="fas fa-plus"></i> Nouveau document
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = documents.map(doc => `
        <div class="collab-doc-card" data-id="${doc.id}">
            <div class="doc-card-content" onclick="openDocument('${doc.id}', '${escapeHtml(doc.slug)}')">
                <div class="doc-title">
                    <i class="fas fa-file-alt"></i>
                    ${escapeHtml(doc.title)}
                    ${doc.archived ? '<span class="archived-badge"><i class="fas fa-archive"></i></span>' : ''}
                </div>
                <div class="doc-meta">
                    <span><i class="fas fa-user"></i> ${escapeHtml(doc.ownerName || 'Inconnu')}</span>
                    <span><i class="fas fa-clock"></i> ${formatDate(doc.updated_at)}</span>
                </div>
                <div class="doc-footer">
                    <span class="doc-visibility ${doc.visibility}">
                        ${getVisibilityLabel(doc.visibility)}
                    </span>
                    <span class="active-users ${doc.active_users > 0 ? 'has-users' : ''}">
                        <i class="fas fa-users"></i> ${doc.active_users || 0}
                    </span>
                </div>
            </div>
            ${doc.canEdit ? `
            <div class="doc-actions">
                <button class="btn-icon btn-archive" onclick="event.stopPropagation(); ${doc.archived ? `unarchiveDocument('${doc.id}')` : `archiveDocument('${doc.id}')`}" title="${doc.archived ? 'Désarchiver' : 'Archiver'}">
                    <i class="fas fa-${doc.archived ? 'box-open' : 'archive'}"></i>
                </button>
                <button class="btn-icon btn-delete" onclick="event.stopPropagation(); confirmDeleteDocument('${doc.id}', '${escapeHtml(doc.title)}')" title="Supprimer">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            ` : ''}
        </div>
    `).join('');
}

/**
 * Filtre les documents collaboratifs
 */
function filterCollabDocs() {
    const search = document.getElementById('collab-search')?.value.toLowerCase() || '';
    const visibility = document.getElementById('collab-visibility-filter')?.value || '';
    const showArchived = document.getElementById('show-archived')?.checked || false;

    const filtered = currentCollabDocuments.filter(doc => {
        const matchesSearch = !search ||
            doc.title.toLowerCase().includes(search) ||
            (doc.ownerName && doc.ownerName.toLowerCase().includes(search));

        const matchesVisibility = !visibility || doc.visibility === visibility;

        const matchesArchived = showArchived || !doc.archived;

        return matchesSearch && matchesVisibility && matchesArchived;
    });

    renderCollabDocuments(filtered);
}

/**
 * Affiche la modale de création de document
 */
function showNewDocumentModal() {
    const modal = document.getElementById('new-doc-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.getElementById('new-doc-title-input')?.focus();
    }
}

/**
 * Ferme la modale de création de document
 */
function closeNewDocModal() {
    const modal = document.getElementById('new-doc-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.getElementById('new-doc-form')?.reset();
    }
}

/**
 * Crée un nouveau document collaboratif
 */
async function createCollabDocument(event) {
    event.preventDefault();

    const title = document.getElementById('new-doc-title-input')?.value.trim();
    const visibility = document.getElementById('new-doc-visibility')?.value || 'private';

    if (!title) {
        showToast('Le titre est requis', 'error');
        return;
    }

    try {
        let doc;
        if (isDemoMode()) {
            doc = DemoCollabAPI.create({ title, visibility });
        } else {
            doc = await API.createCollabDocument({ title, visibility });
        }

        closeNewDocModal();
        showToast('Document créé avec succès', 'success');

        // Ouvrir directement le document
        openDocument(doc.id, doc.slug);
    } catch (error) {
        console.error('Erreur création document:', error);
        showToast(error.message || 'Erreur lors de la création', 'error');
    }
}

/**
 * Ouvre un document pour édition
 */
async function openDocument(documentId, documentSlug) {
    try {
        let doc;
        if (isDemoMode()) {
            doc = DemoCollabAPI.getById(documentId);
        } else {
            doc = await API.getCollabDocument(documentId);
        }

        currentEditingDocument = doc;

        // Mettre à jour le titre
        const titleInput = document.getElementById('doc-title');
        if (titleInput) {
            titleInput.value = doc.title;
            titleInput.disabled = !doc.canEdit;
        }

        // Afficher la page éditeur
        document.getElementById('page-editor')?.classList.remove('hidden');
        document.getElementById('page-collaborative-docs')?.classList.add('hidden');

        // Initialiser l'éditeur
        const editorContainer = document.getElementById('editor-content');
        if (editorContainer) {
            editorContainer.innerHTML = '';
        }

        // En mode démo, utiliser un éditeur Quill simple sans WebSocket
        if (isDemoMode()) {
            initDemoEditor(doc);
        } else {
            await CollaborativeEditor.open(documentSlug, 'editor-content', {
                readOnly: !doc.canEdit,
                onReady: () => {
                    console.log('Éditeur prêt');
                    if (CollaborativeEditor.provider) {
                        CollabPresence.init(CollaborativeEditor.provider);
                    }
                }
            });
        }

    } catch (error) {
        console.error('Erreur ouverture document:', error);
        showToast(error.message || 'Erreur lors de l\'ouverture', 'error');
    }
}

/**
 * Initialise l'éditeur en mode démo (sans collaboration temps réel)
 */
function initDemoEditor(doc) {
    const container = document.getElementById('editor-content');
    if (!container || typeof Quill === 'undefined') {
        console.error('Quill ou conteneur non disponible');
        return;
    }

    // Créer l'éditeur Quill
    window.demoQuill = new Quill(container, {
        theme: 'snow',
        readOnly: !doc.canEdit,
        placeholder: 'Commencez à écrire...',
        modules: {
            toolbar: doc.canEdit ? [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'color': [] }, { 'background': [] }],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                [{ 'align': [] }],
                ['blockquote', 'code-block'],
                ['link', 'image'],
                ['clean']
            ] : false
        }
    });

    // Charger le contenu existant
    if (doc.html_content) {
        window.demoQuill.clipboard.dangerouslyPasteHTML(doc.html_content);
    }

    // Sauvegarder automatiquement les changements
    let saveTimeout;
    window.demoQuill.on('text-change', () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            const content = window.demoQuill.root.innerHTML;
            DemoCollabAPI.saveContent(doc.id, content);
            console.log('Document sauvegardé (démo)');
        }, 1000);
    });

    // Mettre à jour le statut de connexion
    const indicator = document.getElementById('connection-status');
    if (indicator) {
        indicator.className = 'connection-status local';
        indicator.innerHTML = '<i class="fas fa-laptop"></i> Mode démo';
    }
}

/**
 * Ferme l'éditeur et retourne à la liste
 */
function closeEditor() {
    if (isDemoMode()) {
        // Sauvegarder le contenu final en mode démo
        if (window.demoQuill && currentEditingDocument) {
            const content = window.demoQuill.root.innerHTML;
            DemoCollabAPI.saveContent(currentEditingDocument.id, content);
        }
        window.demoQuill = null;
    } else {
        CollaborativeEditor.close();
        CollabPresence.destroy();
    }

    document.getElementById('page-editor')?.classList.add('hidden');
    document.getElementById('page-collaborative-docs')?.classList.remove('hidden');

    currentEditingDocument = null;

    // Recharger la liste des documents
    loadCollabDocuments();
}

/**
 * Met à jour le titre du document
 */
async function updateDocumentTitle() {
    if (!currentEditingDocument) return;

    const titleInput = document.getElementById('doc-title');
    const newTitle = titleInput?.value.trim();

    if (!newTitle || newTitle === currentEditingDocument.title) return;

    try {
        if (isDemoMode()) {
            DemoCollabAPI.update(currentEditingDocument.id, { title: newTitle });
        } else {
            await API.updateCollabDocument(currentEditingDocument.id, { title: newTitle });
        }
        currentEditingDocument.title = newTitle;
        showToast('Titre mis à jour', 'success');
    } catch (error) {
        console.error('Erreur mise à jour titre:', error);
        showToast(error.message || 'Erreur', 'error');
        if (titleInput) titleInput.value = currentEditingDocument.title;
    }
}

/**
 * Affiche la modale des permissions
 */
async function showPermissionsModal() {
    if (!currentEditingDocument) return;

    if (isDemoMode()) {
        showToast('Gestion des permissions non disponible en mode démo', 'info');
        return;
    }

    const modal = document.getElementById('permissions-modal');
    const list = document.getElementById('permissions-list');

    if (!modal || !list) return;

    try {
        const permissions = await API.getDocumentPermissions(currentEditingDocument.id);

        list.innerHTML = permissions.length === 0
            ? '<p class="text-secondary">Aucune permission spécifique</p>'
            : permissions.map(p => `
                <div class="permission-item" data-id="${p.id}">
                    <div class="permission-target">
                        <i class="fas fa-${p.user_id ? 'user' : 'users'}"></i>
                        <span>${escapeHtml(p.first_name && p.last_name
                            ? `${p.first_name} ${p.last_name}`
                            : p.role || p.formation_name || 'Inconnu')}</span>
                    </div>
                    <span class="permission-level">${getPermissionLabel(p.permission)}</span>
                    <button class="btn-icon btn-danger" onclick="removePermission(${p.id})" title="Supprimer">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `).join('');

        modal.classList.remove('hidden');
    } catch (error) {
        console.error('Erreur chargement permissions:', error);
        showToast('Erreur chargement des permissions', 'error');
    }
}

/**
 * Ferme la modale des permissions
 */
function closePermissionsModal() {
    document.getElementById('permissions-modal')?.classList.add('hidden');
}

/**
 * Ajoute une permission
 */
async function addPermission() {
    if (!currentEditingDocument || isDemoMode()) return;

    const type = document.getElementById('permission-type')?.value;
    const level = document.getElementById('permission-level')?.value;
    const target = document.getElementById('permission-target')?.value.trim();

    if (!target) {
        showToast('Veuillez saisir une cible', 'error');
        return;
    }

    try {
        const data = { permission: level };

        if (type === 'role') {
            data.role = target;
        } else {
            const users = await API.getUsers({ search: target });
            if (users.length === 0) {
                showToast('Utilisateur non trouvé', 'error');
                return;
            }
            data.user_id = users[0].id;
        }

        await API.addDocumentPermission(currentEditingDocument.id, data);
        showToast('Permission ajoutée', 'success');
        showPermissionsModal();
        document.getElementById('permission-target').value = '';
    } catch (error) {
        console.error('Erreur ajout permission:', error);
        showToast(error.message || 'Erreur', 'error');
    }
}

/**
 * Supprime une permission
 */
async function removePermission(permissionId) {
    if (!currentEditingDocument || isDemoMode()) return;

    if (!confirm('Supprimer cette permission ?')) return;

    try {
        await API.removeDocumentPermission(currentEditingDocument.id, permissionId);
        showToast('Permission supprimée', 'success');
        showPermissionsModal();
    } catch (error) {
        console.error('Erreur suppression permission:', error);
        showToast(error.message || 'Erreur', 'error');
    }
}

/**
 * Affiche la modale de l'historique des versions
 */
async function showVersionsModal() {
    if (!currentEditingDocument) return;

    if (isDemoMode()) {
        showToast('Historique des versions non disponible en mode démo', 'info');
        return;
    }

    const modal = document.getElementById('versions-modal');
    const list = document.getElementById('versions-list');

    if (!modal || !list) return;

    try {
        const versions = await API.getDocumentVersions(currentEditingDocument.id);

        list.innerHTML = versions.length === 0
            ? '<p class="text-secondary">Aucune version sauvegardée</p>'
            : versions.map(v => `
                <div class="version-item">
                    <div class="version-info">
                        <strong>Version ${v.version_number}</strong>
                        <span>${formatDate(v.created_at)}</span>
                        <span>${escapeHtml(v.createdBy || 'Inconnu')}</span>
                    </div>
                    ${v.comment ? `<p class="version-comment">${escapeHtml(v.comment)}</p>` : ''}
                </div>
            `).join('');

        modal.classList.remove('hidden');
    } catch (error) {
        console.error('Erreur chargement versions:', error);
        showToast('Erreur chargement des versions', 'error');
    }
}

/**
 * Ferme la modale des versions
 */
function closeVersionsModal() {
    document.getElementById('versions-modal')?.classList.add('hidden');
}

/**
 * Crée un snapshot du document actuel
 */
async function createDocumentSnapshot() {
    if (!currentEditingDocument) return;

    if (isDemoMode()) {
        showToast('Sauvegarde de version non disponible en mode démo', 'info');
        return;
    }

    const comment = prompt('Commentaire pour cette version (optionnel):');

    try {
        await API.createDocumentVersion(currentEditingDocument.id, comment);
        showToast('Version sauvegardée', 'success');
    } catch (error) {
        console.error('Erreur création version:', error);
        showToast(error.message || 'Erreur', 'error');
    }
}

// ==================== Utilitaires ====================

function getVisibilityLabel(visibility) {
    const labels = {
        private: 'Privé',
        formation: 'Formation',
        public: 'Public'
    };
    return labels[visibility] || visibility;
}

function getPermissionLabel(permission) {
    const labels = {
        view: 'Lecture',
        comment: 'Commentaire',
        edit: 'Modification',
        admin: 'Admin'
    };
    return labels[permission] || permission;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'À l\'instant';
    if (diff < 3600000) {
        const mins = Math.floor(diff / 60000);
        return `Il y a ${mins} min`;
    }
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `Il y a ${hours}h`;
    }

    return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
}

if (typeof escapeHtml !== 'function') {
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }
}

// ==================== Archivage et Suppression ====================

/**
 * Archive un document
 */
async function archiveDocument(documentId) {
    try {
        if (isDemoMode()) {
            DemoCollabAPI.archive(documentId);
        } else {
            await API.archiveCollabDocument(documentId);
        }
        showToast('Document archivé', 'success');
        loadCollabDocuments();
    } catch (error) {
        console.error('Erreur archivage:', error);
        showToast(error.message || 'Erreur lors de l\'archivage', 'error');
    }
}

/**
 * Désarchive un document
 */
async function unarchiveDocument(documentId) {
    try {
        if (isDemoMode()) {
            DemoCollabAPI.unarchive(documentId);
        } else {
            await API.unarchiveCollabDocument(documentId);
        }
        showToast('Document restauré', 'success');
        loadCollabDocuments();
    } catch (error) {
        console.error('Erreur désarchivage:', error);
        showToast(error.message || 'Erreur lors de la restauration', 'error');
    }
}

/**
 * Affiche la confirmation de suppression
 */
function confirmDeleteDocument(documentId, documentTitle) {
    // Créer la modale de confirmation
    const existingModal = document.getElementById('delete-confirm-modal');
    if (existingModal) {
        existingModal.remove();
    }

    const overlay = document.createElement('div');
    overlay.id = 'delete-confirm-modal';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal delete-confirm-modal">
            <button class="modal-close" onclick="closeDeleteModal()">&times;</button>
            <div class="modal-content">
                <h2><i class="fas fa-exclamation-triangle" style="color: var(--error-color, #f44336);"></i> Supprimer le document</h2>
                <p class="delete-warning">
                    <strong>Attention :</strong> Cette action est irréversible !
                </p>
                <p>Êtes-vous sûr de vouloir supprimer définitivement le document :</p>
                <p class="delete-doc-title"><i class="fas fa-file-alt"></i> ${escapeHtml(documentTitle)}</p>
                <p class="delete-suggestion">
                    <i class="fas fa-lightbulb"></i>
                    <em>Conseil : Vous pouvez aussi archiver le document pour le conserver sans l'afficher.</em>
                </p>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeDeleteModal()">
                        <i class="fas fa-times"></i> Annuler
                    </button>
                    <button class="btn btn-warning" onclick="closeDeleteModal(); archiveDocument('${documentId}')">
                        <i class="fas fa-archive"></i> Archiver plutôt
                    </button>
                    <button class="btn btn-danger" onclick="deleteDocument('${documentId}')">
                        <i class="fas fa-trash"></i> Supprimer définitivement
                    </button>
                </div>
            </div>
        </div>
    `;

    // Fermer en cliquant sur l'overlay
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeDeleteModal();
    });

    document.body.appendChild(overlay);
}

/**
 * Ferme la modale de confirmation
 */
function closeDeleteModal() {
    const modal = document.getElementById('delete-confirm-modal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Supprime définitivement un document
 */
async function deleteDocument(documentId) {
    try {
        closeDeleteModal();

        if (isDemoMode()) {
            DemoCollabAPI.delete(documentId);
        } else {
            await API.deleteCollabDocument(documentId);
        }

        showToast('Document supprimé définitivement', 'success');
        loadCollabDocuments();
    } catch (error) {
        console.error('Erreur suppression:', error);
        showToast(error.message || 'Erreur lors de la suppression', 'error');
    }
}

/**
 * Filtre pour afficher/masquer les documents archivés
 */
function toggleArchivedDocs() {
    const showArchived = document.getElementById('show-archived')?.checked || false;
    const filtered = currentCollabDocuments.filter(doc => {
        if (showArchived) return true;
        return !doc.archived;
    });
    renderCollabDocuments(filtered);
}

// Exposer les fonctions globalement
window.loadCollabDocuments = loadCollabDocuments;
window.filterCollabDocs = filterCollabDocs;
window.showNewDocumentModal = showNewDocumentModal;
window.closeNewDocModal = closeNewDocModal;
window.createCollabDocument = createCollabDocument;
window.openDocument = openDocument;
window.closeEditor = closeEditor;
window.updateDocumentTitle = updateDocumentTitle;
window.showPermissionsModal = showPermissionsModal;
window.closePermissionsModal = closePermissionsModal;
window.addPermission = addPermission;
window.removePermission = removePermission;
window.showVersionsModal = showVersionsModal;
window.closeVersionsModal = closeVersionsModal;
window.createDocumentSnapshot = createDocumentSnapshot;
window.archiveDocument = archiveDocument;
window.unarchiveDocument = unarchiveDocument;
window.confirmDeleteDocument = confirmDeleteDocument;
window.closeDeleteModal = closeDeleteModal;
window.deleteDocument = deleteDocument;
window.toggleArchivedDocs = toggleArchivedDocs;
