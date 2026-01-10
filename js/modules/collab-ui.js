/**
 * Module d'interface utilisateur pour les documents collaboratifs
 */

let currentCollabDocuments = [];
let currentEditingDocument = null;

/**
 * Charge et affiche la liste des documents collaboratifs
 */
async function loadCollabDocuments() {
    const container = document.getElementById('collab-docs-list');
    if (!container) return;

    try {
        container.innerHTML = '<div class="loading-placeholder"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>';

        const documents = await API.getCollabDocuments();
        currentCollabDocuments = documents;

        renderCollabDocuments(documents);
    } catch (error) {
        console.error('Erreur chargement documents collaboratifs:', error);
        container.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <p>Erreur lors du chargement des documents</p>
                <button class="btn btn-secondary" onclick="loadCollabDocuments()">Réessayer</button>
            </div>
        `;
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
        <div class="collab-doc-card" onclick="openDocument('${doc.id}', '${escapeHtml(doc.slug)}')" data-id="${doc.id}">
            <div class="doc-title">
                <i class="fas fa-file-alt"></i>
                ${escapeHtml(doc.title)}
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
    `).join('');
}

/**
 * Filtre les documents collaboratifs
 */
function filterCollabDocs() {
    const search = document.getElementById('collab-search')?.value.toLowerCase() || '';
    const visibility = document.getElementById('collab-visibility-filter')?.value || '';

    const filtered = currentCollabDocuments.filter(doc => {
        const matchesSearch = !search ||
            doc.title.toLowerCase().includes(search) ||
            (doc.ownerName && doc.ownerName.toLowerCase().includes(search));

        const matchesVisibility = !visibility || doc.visibility === visibility;

        return matchesSearch && matchesVisibility;
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
        const doc = await API.createCollabDocument({ title, visibility });
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
        // Récupérer les détails du document
        const doc = await API.getCollabDocument(documentId);
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
        await CollaborativeEditor.open(documentSlug, 'editor-content', {
            readOnly: !doc.canEdit,
            onReady: () => {
                console.log('Éditeur prêt');
                // Initialiser la présence
                if (CollaborativeEditor.provider) {
                    CollabPresence.init(CollaborativeEditor.provider);
                }
            }
        });

    } catch (error) {
        console.error('Erreur ouverture document:', error);
        showToast(error.message || 'Erreur lors de l\'ouverture', 'error');
    }
}

/**
 * Ferme l'éditeur et retourne à la liste
 */
function closeEditor() {
    CollaborativeEditor.close();
    CollabPresence.destroy();

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
        await API.updateCollabDocument(currentEditingDocument.id, { title: newTitle });
        currentEditingDocument.title = newTitle;
        showToast('Titre mis à jour', 'success');
    } catch (error) {
        console.error('Erreur mise à jour titre:', error);
        showToast(error.message || 'Erreur', 'error');
        // Restaurer l'ancien titre
        if (titleInput) titleInput.value = currentEditingDocument.title;
    }
}

/**
 * Affiche la modale des permissions
 */
async function showPermissionsModal() {
    if (!currentEditingDocument) return;

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
    if (!currentEditingDocument) return;

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
            // Rechercher l'utilisateur par email/username
            const users = await API.getUsers({ search: target });
            if (users.length === 0) {
                showToast('Utilisateur non trouvé', 'error');
                return;
            }
            data.user_id = users[0].id;
        }

        await API.addDocumentPermission(currentEditingDocument.id, data);
        showToast('Permission ajoutée', 'success');

        // Rafraîchir la liste
        showPermissionsModal();

        // Vider le champ
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
    if (!currentEditingDocument) return;

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

/**
 * Retourne le label de visibilité
 */
function getVisibilityLabel(visibility) {
    const labels = {
        private: 'Privé',
        formation: 'Formation',
        public: 'Public'
    };
    return labels[visibility] || visibility;
}

/**
 * Retourne le label de permission
 */
function getPermissionLabel(permission) {
    const labels = {
        view: 'Lecture',
        comment: 'Commentaire',
        edit: 'Modification',
        admin: 'Admin'
    };
    return labels[permission] || permission;
}

/**
 * Formate une date
 */
function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    // Moins d'une minute
    if (diff < 60000) return 'À l\'instant';

    // Moins d'une heure
    if (diff < 3600000) {
        const mins = Math.floor(diff / 60000);
        return `Il y a ${mins} min`;
    }

    // Moins d'un jour
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `Il y a ${hours}h`;
    }

    // Sinon date complète
    return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
}

/**
 * Échappe le HTML (si pas déjà défini)
 */
if (typeof escapeHtml !== 'function') {
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }
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
