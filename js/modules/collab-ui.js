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

// ============================================
// TÉLÉCHARGEMENT DE DOCUMENTS
// ============================================

/**
 * Affiche/masque le menu de téléchargement
 */
function toggleDownloadMenu() {
    const menu = document.getElementById('download-menu');
    if (menu) {
        menu.classList.toggle('hidden');

        // Fermer le menu si on clique ailleurs
        if (!menu.classList.contains('hidden')) {
            setTimeout(() => {
                document.addEventListener('click', closeDownloadMenuOnClickOutside);
            }, 0);
        }
    }
}

function closeDownloadMenuOnClickOutside(e) {
    const menu = document.getElementById('download-menu');
    const dropdown = e.target.closest('.dropdown');
    if (!dropdown && menu) {
        menu.classList.add('hidden');
        document.removeEventListener('click', closeDownloadMenuOnClickOutside);
    }
}

/**
 * Télécharge le document dans le format spécifié
 */
async function downloadDocument(format) {
    const menu = document.getElementById('download-menu');
    if (menu) menu.classList.add('hidden');

    if (!currentEditingDocument) {
        showToast('Aucun document ouvert', 'error');
        return;
    }

    const title = document.getElementById('doc-title')?.value || currentEditingDocument.title || 'document';
    const quill = window.demoQuill;

    if (!quill) {
        showToast('Éditeur non disponible', 'error');
        return;
    }

    showToast('Préparation du téléchargement...', 'info');

    try {
        const htmlContent = quill.root.innerHTML;

        switch (format) {
            case 'html':
                downloadAsHtml(title, htmlContent);
                break;
            case 'pdf':
                await downloadAsPdf(title, htmlContent);
                break;
            case 'docx':
                await downloadAsDocx(title, htmlContent);
                break;
            default:
                showToast('Format non supporté', 'error');
        }
    } catch (error) {
        console.error('Erreur téléchargement:', error);
        showToast('Erreur lors du téléchargement', 'error');
    }
}

/**
 * Télécharge en HTML
 */
function downloadAsHtml(title, content) {
    const fullHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }
        h1, h2, h3 { color: #253672; }
        .page-break { page-break-after: always; border-top: 2px dashed #ccc; margin: 40px 0; }
        .section-break { border-top: 3px solid #253672; margin: 30px 0; padding-top: 20px; }
        .table-of-contents { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .table-of-contents h2 { margin-top: 0; }
        .toc-item { padding: 5px 0; }
        .toc-item.level-2 { padding-left: 20px; }
        .toc-item.level-3 { padding-left: 40px; }
    </style>
</head>
<body>
    <h1>${escapeHtml(title)}</h1>
    ${content}
</body>
</html>`;

    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    downloadBlob(blob, `${sanitizeFilename(title)}.html`);
    showToast('Document HTML téléchargé', 'success');
}

/**
 * Télécharge en PDF (utilise html2pdf.js ou print)
 */
async function downloadAsPdf(title, content) {
    // Créer une fenêtre d'impression avec le contenu formaté
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast('Veuillez autoriser les popups pour télécharger en PDF', 'warning');
        return;
    }

    printWindow.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>${escapeHtml(title)}</title>
    <style>
        @page {
            margin: 2cm;
            @bottom-center { content: counter(page); }
        }
        body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 12pt;
            line-height: 1.6;
            color: #000;
        }
        h1 { font-size: 24pt; color: #253672; margin-bottom: 1em; }
        h2 { font-size: 18pt; color: #253672; margin-top: 1.5em; }
        h3 { font-size: 14pt; color: #253672; margin-top: 1em; }
        .page-break { page-break-after: always; height: 0; margin: 0; border: none; }
        .section-break { page-break-before: always; border-top: 2px solid #253672; padding-top: 20px; margin-top: 30px; }
        .table-of-contents {
            background: #f8f8f8;
            padding: 20px;
            border: 1px solid #ddd;
            margin: 20px 0;
            page-break-inside: avoid;
        }
        .toc-item { padding: 3px 0; }
        .toc-item.level-2 { padding-left: 20px; }
        .toc-item.level-3 { padding-left: 40px; }
        img { max-width: 100%; height: auto; }
        table { border-collapse: collapse; width: 100%; margin: 1em 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f5f5f5; }
        @media print {
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <h1>${escapeHtml(title)}</h1>
    ${content}
    <script>
        window.onload = function() {
            setTimeout(function() {
                window.print();
                window.close();
            }, 500);
        };
    </script>
</body>
</html>`);
    printWindow.document.close();
    showToast('Utilisez "Enregistrer en PDF" dans la boîte de dialogue', 'info');
}

/**
 * Télécharge en DOCX (format simplifié)
 */
async function downloadAsDocx(title, content) {
    // Créer un document Word avec le contenu HTML
    const docContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office"
              xmlns:w="urn:schemas-microsoft-com:office:word"
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="utf-8">
            <title>${escapeHtml(title)}</title>
            <!--[if gte mso 9]>
            <xml>
                <w:WordDocument>
                    <w:View>Print</w:View>
                    <w:Zoom>100</w:Zoom>
                </w:WordDocument>
            </xml>
            <![endif]-->
            <style>
                body { font-family: Calibri, sans-serif; font-size: 11pt; }
                h1 { font-size: 24pt; color: #253672; }
                h2 { font-size: 18pt; color: #253672; }
                h3 { font-size: 14pt; color: #253672; }
                .page-break { page-break-after: always; }
                .section-break { page-break-before: always; }
            </style>
        </head>
        <body>
            <h1>${escapeHtml(title)}</h1>
            ${content}
        </body>
        </html>`;

    const blob = new Blob(['\ufeff', docContent], { type: 'application/msword' });
    downloadBlob(blob, `${sanitizeFilename(title)}.doc`);
    showToast('Document Word téléchargé', 'success');
}

/**
 * Télécharge un blob
 */
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Nettoie un nom de fichier
 */
function sanitizeFilename(name) {
    return name.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüç\s-_]/g, '').trim().replace(/\s+/g, '_');
}

// ============================================
// IMPORT DE DOCUMENTS
// ============================================

/**
 * Affiche/masque le menu d'import
 */
function toggleImportMenu() {
    const menu = document.getElementById('import-menu');
    const downloadMenu = document.getElementById('download-menu');

    // Fermer l'autre menu
    if (downloadMenu) downloadMenu.classList.add('hidden');

    if (menu) {
        menu.classList.toggle('hidden');
        if (!menu.classList.contains('hidden')) {
            setTimeout(() => {
                document.addEventListener('click', closeImportMenuOnClickOutside);
            }, 0);
        }
    }
}

function closeImportMenuOnClickOutside(e) {
    const menu = document.getElementById('import-menu');
    const dropdown = e.target.closest('.dropdown');
    if (!dropdown && menu) {
        menu.classList.add('hidden');
        document.removeEventListener('click', closeImportMenuOnClickOutside);
    }
}

/**
 * Import depuis le PC
 */
function importFromPC() {
    document.getElementById('import-menu')?.classList.add('hidden');
    document.getElementById('file-import-input')?.click();
}

/**
 * Import depuis Google Drive (placeholder)
 */
function importFromDrive() {
    document.getElementById('import-menu')?.classList.add('hidden');
    showToast('Fonctionnalité Google Drive bientôt disponible. Utilisez "Depuis mon PC" pour l\'instant.', 'info');
}

/**
 * Gère l'import d'un fichier
 */
async function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const quill = window.demoQuill;
    if (!quill) {
        showToast('Éditeur non disponible', 'error');
        event.target.value = '';
        return;
    }

    const fileName = file.name.toLowerCase();
    showToast('Import en cours...', 'info');

    try {
        // Vérifier le type de fichier
        if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
            showToast('Les fichiers Word (.doc/.docx) ne sont pas directement supportés. Veuillez les enregistrer en HTML ou copier-coller le contenu.', 'warning');
            event.target.value = '';
            return;
        }

        if (fileName.endsWith('.rtf')) {
            showToast('Les fichiers RTF ne sont pas directement supportés. Veuillez les enregistrer en HTML ou TXT.', 'warning');
            event.target.value = '';
            return;
        }

        const text = await file.text();
        let content = '';

        if (fileName.endsWith('.html') || fileName.endsWith('.htm')) {
            content = cleanHtmlImport(text);
        } else if (fileName.endsWith('.md')) {
            content = convertMarkdownToHtml(text);
        } else if (fileName.endsWith('.txt')) {
            content = convertTextToHtml(text);
        } else {
            // Essayer comme texte brut
            content = convertTextToHtml(text);
        }

        if (!content || content.trim() === '' || content === '<p><br></p>') {
            showToast('Le fichier semble vide ou non lisible', 'warning');
            event.target.value = '';
            return;
        }

        // Demander si on remplace ou ajoute
        const currentContent = quill.root.innerHTML;
        const isEmpty = !currentContent || currentContent === '<p><br></p>' || currentContent.trim() === '';

        if (isEmpty) {
            // Document vide, remplacer directement
            quill.root.innerHTML = content;
        } else {
            // Document non vide, ajouter à la suite
            quill.root.innerHTML = currentContent + '<p><br></p>' + content;
        }

        showToast(`Fichier "${file.name}" importé avec succès`, 'success');
    } catch (error) {
        console.error('Erreur import:', error);
        showToast('Erreur lors de l\'import: ' + (error.message || 'format non supporté'), 'error');
    }

    // Reset l'input
    event.target.value = '';
}

/**
 * Nettoie le HTML importé
 */
function cleanHtmlImport(html) {
    // Créer un élément temporaire pour parser le HTML
    const temp = document.createElement('div');

    // Extraire le body si présent
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    temp.innerHTML = bodyMatch ? bodyMatch[1] : html;

    // Supprimer les scripts et styles
    temp.querySelectorAll('script, style, link, meta, head, noscript').forEach(el => el.remove());

    // Supprimer les attributs dangereux
    temp.querySelectorAll('*').forEach(el => {
        // Garder seulement certains attributs
        const allowedAttrs = ['href', 'src', 'alt', 'title', 'class', 'id', 'colspan', 'rowspan'];
        Array.from(el.attributes).forEach(attr => {
            if (!allowedAttrs.includes(attr.name.toLowerCase())) {
                // Supprimer les événements et styles inline
                if (attr.name.startsWith('on') || attr.name === 'style') {
                    el.removeAttribute(attr.name);
                }
            }
        });
    });

    // Nettoyer les liens (enlever javascript:)
    temp.querySelectorAll('a[href^="javascript:"]').forEach(el => {
        el.removeAttribute('href');
    });

    return temp.innerHTML;
}

/**
 * Convertit du Markdown en HTML
 */
function convertMarkdownToHtml(markdown) {
    if (!markdown || markdown.trim() === '') return '';

    let html = markdown;

    // Titres
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Gras et italique
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');

    // Code inline
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');

    // Liens
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

    // Listes non ordonnées
    html = html.replace(/^[\*\-] (.+)$/gm, '<li>$1</li>');

    // Listes ordonnées
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Regrouper les éléments de liste
    html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
        return '<ul>' + match + '</ul>';
    });

    // Blockquotes
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

    // Lignes horizontales
    html = html.replace(/^---$/gm, '<hr>');
    html = html.replace(/^\*\*\*$/gm, '<hr>');

    // Paragraphes (lignes non vides qui ne sont pas déjà formatées)
    const lines = html.split('\n');
    html = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed === '') return '<p><br></p>';
        // Si la ligne ne commence pas par une balise HTML, l'envelopper dans <p>
        if (!trimmed.match(/^<(h[1-6]|p|ul|ol|li|blockquote|hr|div|pre|code|img)/i)) {
            return `<p>${trimmed}</p>`;
        }
        return line;
    }).join('\n');

    // Nettoyer les balises <p> vides consécutives
    html = html.replace(/(<p><br><\/p>\n?){3,}/g, '<p><br></p><p><br></p>');

    return html;
}

/**
 * Convertit du texte brut en HTML
 */
function convertTextToHtml(text) {
    if (!text || text.trim() === '') return '';

    // Diviser en lignes
    const lines = text.split(/\r?\n/);
    let html = '';

    for (const line of lines) {
        const trimmedLine = line.trim();

        if (trimmedLine === '') {
            // Ligne vide = nouveau paragraphe
            html += '<p><br></p>';
        } else {
            // Échapper les caractères HTML et créer un paragraphe
            const escapedLine = trimmedLine
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
            html += `<p>${escapedLine}</p>`;
        }
    }

    return html;
}

// ============================================
// IMPRESSION
// ============================================

/**
 * Imprime le document
 */
function printDocument() {
    const quill = window.demoQuill;
    if (!quill) {
        showToast('Éditeur non disponible', 'error');
        return;
    }

    const title = document.getElementById('doc-title')?.value || 'Document';
    const content = quill.root.innerHTML;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast('Veuillez autoriser les popups pour imprimer', 'warning');
        return;
    }

    printWindow.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>${escapeHtml(title)}</title>
    <style>
        @page { margin: 2cm; }
        @media print {
            .page-break { page-break-after: always; height: 0; visibility: hidden; }
            .section-break { page-break-before: always; }
        }
        body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; color: #000; max-width: 800px; margin: 0 auto; }
        h1 { font-size: 24pt; color: #253672; }
        h2 { font-size: 18pt; color: #253672; }
        h3 { font-size: 14pt; color: #253672; }
        .page-break { border-top: 2px dashed #ccc; margin: 30px 0; padding-top: 30px; }
        .section-break { border-top: 3px solid #253672; margin: 30px 0; padding-top: 20px; }
        .section-break::before { content: attr(data-section); display: block; font-weight: bold; color: #253672; margin-bottom: 10px; }
        .table-of-contents { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .table-of-contents-title { font-size: 16pt; font-weight: bold; margin-bottom: 15px; }
        .toc-item { padding: 5px 0; }
        .toc-item.level-2 { padding-left: 20px; }
        .toc-item.level-3 { padding-left: 40px; }
        table { border-collapse: collapse; width: 100%; margin: 1em 0; }
        th, td { border: 1px solid #ddd; padding: 8px; }
        img { max-width: 100%; }
    </style>
</head>
<body>
    <h1>${escapeHtml(title)}</h1>
    ${content}
    <script>window.onload = function() { window.print(); }</script>
</body>
</html>`);
    printWindow.document.close();
}

// ============================================
// SAUT DE PAGE ET SAUT DE SECTION
// ============================================

let sectionCounter = 1;

/**
 * Insère un saut de page à la position du curseur
 */
function insertPageBreak() {
    const quill = window.demoQuill;
    if (!quill) {
        showToast('Éditeur non disponible', 'error');
        return;
    }

    // Créer l'élément de saut de page
    const pageBreakHtml = '<p><br></p><div class="page-break" contenteditable="false">--- Saut de page ---</div><p><br></p>';

    // Insérer dans l'éditeur
    const range = quill.getSelection(true);
    if (range) {
        // Insérer à la position courante
        quill.clipboard.dangerouslyPasteHTML(range.index, pageBreakHtml);
        quill.setSelection(range.index + 3);
    } else {
        // Insérer à la fin
        quill.clipboard.dangerouslyPasteHTML(quill.getLength(), pageBreakHtml);
    }

    showToast('Saut de page inséré', 'success');
}

/**
 * Insère un saut de section avec numérotation
 */
function insertSectionBreak() {
    const quill = window.demoQuill;
    if (!quill) {
        showToast('Éditeur non disponible', 'error');
        return;
    }

    const sectionNumber = sectionCounter++;
    const sectionBreakHtml = `<p><br></p><div class="section-break" data-section="Section ${sectionNumber}" contenteditable="false">═══ Section ${sectionNumber} ═══</div><p><br></p>`;

    const range = quill.getSelection(true);
    if (range) {
        quill.clipboard.dangerouslyPasteHTML(range.index, sectionBreakHtml);
        quill.setSelection(range.index + 3);
    } else {
        quill.clipboard.dangerouslyPasteHTML(quill.getLength(), sectionBreakHtml);
    }

    showToast(`Section ${sectionNumber} créée`, 'success');
}

// ============================================
// TABLE DES MATIÈRES
// ============================================

/**
 * Génère et insère une table des matières
 */
function insertTableOfContents() {
    const quill = window.demoQuill;
    if (!quill) {
        showToast('Éditeur non disponible', 'error');
        return;
    }

    // Collecter tous les titres
    const headings = collectHeadings();

    if (headings.length === 0) {
        showToast('Aucun titre trouvé. Utilisez H1, H2, H3 pour créer des titres.', 'warning');
        return;
    }

    // Générer le HTML de la table des matières
    const tocHtml = generateTocHtml(headings);

    // Insérer au début du document
    const currentContent = quill.root.innerHTML;
    quill.root.innerHTML = tocHtml + currentContent;

    showToast('Table des matières insérée', 'success');
}

/**
 * Collecte tous les titres du document
 */
function collectHeadings() {
    const quill = window.demoQuill;
    if (!quill) return [];

    const headings = [];
    const content = quill.root;
    const elements = content.querySelectorAll('h1, h2, h3');

    elements.forEach((el, index) => {
        const level = parseInt(el.tagName.charAt(1));
        const text = el.textContent.trim();
        const id = `heading-${index}`;

        // Ajouter un ID au titre pour le lien
        el.id = id;

        headings.push({ level, text, id });
    });

    return headings;
}

/**
 * Génère le HTML de la table des matières
 */
function generateTocHtml(headings) {
    let tocItems = headings.map(h => {
        return `<div class="toc-item level-${h.level}">
            <a href="#${h.id}">${escapeHtml(h.text)}</a>
            <span class="toc-dots"></span>
        </div>`;
    }).join('');

    return `<div class="table-of-contents" contenteditable="false">
        <div class="table-of-contents-title">Table des matières</div>
        ${tocItems}
    </div><p><br></p>`;
}

/**
 * Met à jour la table des matières existante
 */
function updateTableOfContents() {
    const quill = window.demoQuill;
    if (!quill) return;

    const toc = quill.root.querySelector('.table-of-contents');
    if (!toc) return;

    const headings = collectHeadings();
    const tocItems = headings.map(h => {
        return `<div class="toc-item level-${h.level}">
            <a href="#${h.id}">${escapeHtml(h.text)}</a>
            <span class="toc-dots"></span>
        </div>`;
    }).join('');

    toc.innerHTML = `<div class="table-of-contents-title">Table des matières</div>${tocItems}`;
}

// ============================================
// NUMÉROTATION DES PAGES
// ============================================

/**
 * Affiche la modal de configuration de numérotation
 */
function showPageNumbersModal() {
    const existingModal = document.getElementById('page-numbers-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'page-numbers-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal page-numbers-modal">
            <button class="modal-close" onclick="closePageNumbersModal()">&times;</button>
            <div class="modal-content">
                <h2><i class="fas fa-sort-numeric-down"></i> Numérotation des pages</h2>
                <div class="modal-body">
                    <div class="page-numbers-option selected" onclick="selectPageNumberOption(this, 'all')">
                        <input type="radio" name="page-numbering" value="all" checked>
                        <label>Numéroter toutes les pages</label>
                    </div>
                    <div class="page-numbers-option" onclick="selectPageNumberOption(this, 'from-section')">
                        <input type="radio" name="page-numbering" value="from-section">
                        <label>Commencer la numérotation à partir d'une section</label>
                    </div>
                    <div class="page-numbers-option" onclick="selectPageNumberOption(this, 'custom')">
                        <input type="radio" name="page-numbering" value="custom">
                        <label>Commencer à un numéro spécifique</label>
                        <div class="start-page-input">
                            <span>Commencer à la page :</span>
                            <input type="number" id="start-page-number" value="1" min="1">
                        </div>
                    </div>
                    <div class="page-numbers-option" onclick="selectPageNumberOption(this, 'none')">
                        <input type="radio" name="page-numbering" value="none">
                        <label>Pas de numérotation</label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closePageNumbersModal()">Annuler</button>
                    <button class="btn btn-primary" onclick="applyPageNumbers()">
                        <i class="fas fa-check"></i> Appliquer
                    </button>
                </div>
            </div>
        </div>
    `;

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closePageNumbersModal();
    });

    document.body.appendChild(modal);
}

function closePageNumbersModal() {
    const modal = document.getElementById('page-numbers-modal');
    if (modal) modal.remove();
}

function selectPageNumberOption(element, value) {
    document.querySelectorAll('.page-numbers-option').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    element.querySelector('input[type="radio"]').checked = true;
}

function applyPageNumbers() {
    const selected = document.querySelector('input[name="page-numbering"]:checked');
    if (!selected) return;

    const value = selected.value;
    let message = '';

    switch (value) {
        case 'all':
            message = 'Toutes les pages seront numérotées';
            break;
        case 'from-section':
            message = 'La numérotation commencera à la prochaine section';
            break;
        case 'custom':
            const startNum = document.getElementById('start-page-number')?.value || 1;
            message = `La numérotation commencera à ${startNum}`;
            break;
        case 'none':
            message = 'Numérotation désactivée';
            break;
    }

    // Stocker le paramètre pour l'export PDF
    if (currentEditingDocument) {
        currentEditingDocument.pageNumbering = {
            type: value,
            startNumber: parseInt(document.getElementById('start-page-number')?.value || 1)
        };
    }

    closePageNumbersModal();
    showToast(message, 'success');
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

// Nouvelles fonctions document
window.toggleDownloadMenu = toggleDownloadMenu;
window.downloadDocument = downloadDocument;
window.toggleImportMenu = toggleImportMenu;
window.importFromPC = importFromPC;
window.importFromDrive = importFromDrive;
window.handleFileImport = handleFileImport;
window.printDocument = printDocument;
window.insertPageBreak = insertPageBreak;
window.insertSectionBreak = insertSectionBreak;
window.insertTableOfContents = insertTableOfContents;
window.updateTableOfContents = updateTableOfContents;
window.showPageNumbersModal = showPageNumbersModal;
window.closePageNumbersModal = closePageNumbersModal;
window.selectPageNumberOption = selectPageNumberOption;
window.applyPageNumbers = applyPageNumbers;
