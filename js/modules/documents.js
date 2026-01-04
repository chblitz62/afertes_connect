/**
 * Module Documents
 * Gère les documents institutionnels, les documents personnels et le Drive
 */

// ===========================================
// Variables d'état Drive
// ===========================================
let currentDrivePath = '/';
let driveViewMode = 'grid';
const MAX_STORAGE = 1024 * 1024 * 1024; // 1 Go

// ===========================================
// Documents institutionnels
// ===========================================

function loadDocuments() {
    const documents = getDocuments();
    const container = document.getElementById('documents-list');
    if (!container) return;

    container.innerHTML = documents.map(doc => `
        <div class="document-card">
            <div class="document-icon">
                <i class="fas fa-${getDocumentIcon(doc.type)}" aria-hidden="true"></i>
            </div>
            <div class="document-info">
                <h3>${escapeHtml(doc.title)}</h3>
                <p>${escapeHtml(doc.description)}</p>
            </div>
        </div>
    `).join('');
}

function getDocuments() {
    // Documents institutionnels par défaut
    return JSON.parse(localStorage.getItem('afertes_documents') || JSON.stringify([
        { id: 1, title: 'Règlement intérieur', description: 'Règlement de l\'établissement', type: 'pdf' },
        { id: 2, title: 'Charte informatique', description: 'Conditions d\'utilisation des outils numériques', type: 'pdf' },
        { id: 3, title: 'Guide de l\'étudiant', description: 'Informations pratiques pour les étudiants', type: 'pdf' }
    ]));
}

function getDocumentIcon(type) {
    const icons = {
        pdf: 'file-pdf',
        doc: 'file-word',
        xls: 'file-excel',
        ppt: 'file-powerpoint',
        img: 'file-image',
        default: 'file'
    };
    return icons[type] || icons.default;
}

// ===========================================
// Documents personnels (Mes documents)
// ===========================================

function loadMyDocuments() {
    const container = document.getElementById('my-documents-list');
    if (!container || !window.currentUser) return;

    const documents = window.currentUser.documents || {};
    const docTypes = [
        { key: 'id', name: 'Pièce d\'identité', icon: 'fa-id-card' },
        { key: 'vitale', name: 'Carte Vitale', icon: 'fa-heart' },
        { key: 'photo', name: 'Photo d\'identité', icon: 'fa-camera' }
    ];

    container.innerHTML = docTypes.map(docType => {
        const doc = documents[docType.key];
        const hasDoc = !!doc;

        return `
            <div class="my-document-card">
                <div class="doc-icon ${hasDoc ? 'status-ok' : 'status-missing'}">
                    <i class="fas ${hasDoc ? 'fa-check' : docType.icon}" aria-hidden="true"></i>
                </div>
                <div class="doc-info">
                    <div class="doc-name">${escapeHtml(docType.name)}</div>
                    <div class="doc-status ${hasDoc ? 'ok' : 'missing'}">
                        ${hasDoc ? `Déposé le ${formatDateFR(doc.uploadedAt?.split('T')[0])}` : 'Non déposé'}
                    </div>
                </div>
                <div class="doc-actions">
                    ${hasDoc ? `
                        <button onclick="viewDocument('${docType.key}')" title="Voir" aria-label="Voir ${escapeHtml(docType.name)}">
                            <i class="fas fa-eye" aria-hidden="true"></i>
                        </button>
                        <button onclick="downloadDocument('${docType.key}')" title="Télécharger" aria-label="Télécharger ${escapeHtml(docType.name)}">
                            <i class="fas fa-download" aria-hidden="true"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function viewDocument(type) {
    const doc = window.currentUser?.documents?.[type];
    if (!doc) return;

    // Ouvrir dans une nouvelle fenêtre
    const win = window.open();
    if (win) {
        if (doc.type && doc.type.startsWith('image/')) {
            win.document.write(`<img src="${doc.data}" style="max-width: 100%;" alt="${escapeHtml(type)}">`);
        } else {
            win.document.write(`<iframe src="${doc.data}" style="width: 100%; height: 100vh; border: none;" title="${escapeHtml(type)}"></iframe>`);
        }
    }
}

function downloadDocument(type) {
    const doc = window.currentUser?.documents?.[type];
    if (!doc) return;

    const link = document.createElement('a');
    link.href = doc.data;
    link.download = doc.name || `document_${type}`;
    link.click();
}

// ===========================================
// Drive personnel
// ===========================================

function initDrive() {
    const userId = window.currentUser?.id;
    if (!userId) return;

    if (!localStorage.getItem('afertes_drive_' + userId)) {
        localStorage.setItem('afertes_drive_' + userId, JSON.stringify({
            folders: [
                { id: 1, name: 'Documents', path: '/', createdAt: new Date().toISOString() },
                { id: 2, name: 'Cours', path: '/', createdAt: new Date().toISOString() }
            ],
            files: [],
            usedStorage: 0
        }));
    }
    loadDriveContent();
    updateDriveQuota();
}

function loadDriveContent() {
    const userId = window.currentUser?.id;
    if (!userId) return;

    const driveData = JSON.parse(localStorage.getItem('afertes_drive_' + userId) || '{}');
    const container = document.getElementById('drive-content');
    if (!container) return;

    const folders = (driveData.folders || []).filter(f => f.path === currentDrivePath);
    const files = (driveData.files || []).filter(f => f.path === currentDrivePath);

    container.className = `drive-content ${driveViewMode}-view`;

    if (folders.length === 0 && files.length === 0) {
        container.innerHTML = `
            <div class="drive-empty">
                <i class="fas fa-folder-open" aria-hidden="true"></i>
                <p>Ce dossier est vide</p>
            </div>
        `;
        return;
    }

    let html = '';

    folders.forEach(folder => {
        html += `
            <div class="drive-item" ondblclick="navigateDrive('${escapeHtml(currentDrivePath)}${escapeHtml(folder.name)}/')" oncontextmenu="showDriveMenu(event, 'folder', ${folder.id})" tabindex="0" role="button" aria-label="Dossier ${escapeHtml(folder.name)}">
                <i class="fas fa-folder icon folder" aria-hidden="true"></i>
                <div class="name">${escapeHtml(folder.name)}</div>
            </div>
        `;
    });

    files.forEach(file => {
        const iconClass = getFileIcon(file.name);
        html += `
            <div class="drive-item" ondblclick="previewFile(${file.id})" oncontextmenu="showDriveMenu(event, 'file', ${file.id})" tabindex="0" role="button" aria-label="Fichier ${escapeHtml(file.name)}">
                <i class="fas ${iconClass} icon" aria-hidden="true"></i>
                <div class="name">${escapeHtml(file.name)}</div>
                <div class="size">${formatFileSize(file.size)}</div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function navigateDrive(path) {
    currentDrivePath = path;
    updateBreadcrumb();
    loadDriveContent();
}

function updateBreadcrumb() {
    const breadcrumb = document.getElementById('drive-breadcrumb');
    if (!breadcrumb) return;

    const parts = currentDrivePath.split('/').filter(p => p);
    let html = `<span class="breadcrumb-item" onclick="navigateDrive('/')" tabindex="0" role="button"><i class="fas fa-home" aria-hidden="true"></i> Mon Drive</span>`;

    let path = '/';
    parts.forEach(part => {
        path += part + '/';
        html += `<span class="breadcrumb-item" onclick="navigateDrive('${escapeHtml(path)}')" tabindex="0" role="button">${escapeHtml(part)}</span>`;
    });

    breadcrumb.innerHTML = html;
}

function updateDriveQuota() {
    const userId = window.currentUser?.id;
    if (!userId) return;

    const driveData = JSON.parse(localStorage.getItem('afertes_drive_' + userId) || '{}');
    const used = driveData.usedStorage || 0;
    const percent = (used / MAX_STORAGE) * 100;

    const bar = document.getElementById('drive-quota-bar');
    const text = document.getElementById('drive-quota-text');

    if (bar) bar.style.width = percent + '%';
    if (text) text.textContent = `${formatFileSize(used)} / 1 Go utilisés`;
}

function setDriveView(mode) {
    driveViewMode = mode;
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.view-btn:${mode === 'grid' ? 'first' : 'last'}-child`);
    if (activeBtn) activeBtn.classList.add('active');
    loadDriveContent();
}

function uploadFile() {
    const userId = window.currentUser?.id;
    if (!userId) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e) => {
        const files = e.target.files;
        if (!files.length) return;

        const driveData = JSON.parse(localStorage.getItem('afertes_drive_' + userId) || '{}');
        if (!driveData.files) driveData.files = [];

        Array.from(files).forEach(file => {
            if ((driveData.usedStorage || 0) + file.size > MAX_STORAGE) {
                showToast('Espace de stockage insuffisant', 'error');
                return;
            }

            driveData.files.push({
                id: Date.now() + Math.random(),
                name: file.name,
                size: file.size,
                type: file.type,
                path: currentDrivePath,
                createdAt: new Date().toISOString()
            });
            driveData.usedStorage = (driveData.usedStorage || 0) + file.size;
        });

        localStorage.setItem('afertes_drive_' + userId, JSON.stringify(driveData));
        loadDriveContent();
        updateDriveQuota();
        showToast('Fichier(s) importé(s)', 'success');
    };
    input.click();
}

function createFolder() {
    const userId = window.currentUser?.id;
    if (!userId) return;

    const name = prompt('Nom du dossier:');
    if (!name) return;

    const driveData = JSON.parse(localStorage.getItem('afertes_drive_' + userId) || '{}');
    if (!driveData.folders) driveData.folders = [];

    driveData.folders.push({
        id: Date.now(),
        name: name,
        path: currentDrivePath,
        createdAt: new Date().toISOString()
    });

    localStorage.setItem('afertes_drive_' + userId, JSON.stringify(driveData));
    loadDriveContent();
    showToast('Dossier créé', 'success');
}

function showDriveMenu(e, type, id) {
    e.preventDefault();
    const existingMenu = document.querySelector('.drive-context-menu');
    if (existingMenu) existingMenu.remove();

    const menu = document.createElement('div');
    menu.className = 'drive-context-menu';
    menu.style.left = e.pageX + 'px';
    menu.style.top = e.pageY + 'px';

    menu.innerHTML = `
        <button onclick="renameItem('${type}', ${id})"><i class="fas fa-edit" aria-hidden="true"></i> Renommer</button>
        ${type === 'file' ? '<button onclick="downloadItem(' + id + ')"><i class="fas fa-download" aria-hidden="true"></i> Télécharger</button>' : ''}
        <button onclick="shareItem('${type}', ${id})"><i class="fas fa-share" aria-hidden="true"></i> Partager</button>
        <button class="danger" onclick="deleteItem('${type}', ${id})"><i class="fas fa-trash" aria-hidden="true"></i> Supprimer</button>
    `;

    document.body.appendChild(menu);

    setTimeout(() => {
        document.addEventListener('click', () => menu.remove(), { once: true });
    }, 100);
}

function deleteItem(type, id) {
    if (!confirm('Supprimer cet élément ?')) return;

    const userId = window.currentUser?.id;
    if (!userId) return;

    const driveData = JSON.parse(localStorage.getItem('afertes_drive_' + userId) || '{}');

    if (type === 'folder') {
        driveData.folders = (driveData.folders || []).filter(f => f.id !== id);
    } else {
        const file = (driveData.files || []).find(f => f.id === id);
        if (file) driveData.usedStorage = (driveData.usedStorage || 0) - file.size;
        driveData.files = (driveData.files || []).filter(f => f.id !== id);
    }

    localStorage.setItem('afertes_drive_' + userId, JSON.stringify(driveData));
    loadDriveContent();
    updateDriveQuota();
    showToast('Élément supprimé', 'success');
}

function renameItem(type, id) {
    const userId = window.currentUser?.id;
    if (!userId) return;

    const driveData = JSON.parse(localStorage.getItem('afertes_drive_' + userId) || '{}');
    const items = type === 'folder' ? driveData.folders : driveData.files;
    const item = (items || []).find(i => i.id === id);
    if (!item) return;

    const newName = prompt('Nouveau nom:', item.name);
    if (!newName) return;

    item.name = newName;
    localStorage.setItem('afertes_drive_' + userId, JSON.stringify(driveData));
    loadDriveContent();
    showToast('Élément renommé', 'success');
}

function shareItem(type, id) {
    showToast('Fonctionnalité de partage en développement', 'info');
}

function downloadItem(id) {
    showToast('Téléchargement en cours...', 'info');
}

function previewFile(id) {
    showToast('Aperçu non disponible', 'info');
}

function getFileIcon(filename) {
    const ext = (filename || '').split('.').pop().toLowerCase();
    const icons = {
        'pdf': 'fa-file-pdf file-pdf',
        'doc': 'fa-file-word file-word',
        'docx': 'fa-file-word file-word',
        'xls': 'fa-file-excel file-excel',
        'xlsx': 'fa-file-excel file-excel',
        'jpg': 'fa-file-image file-image',
        'jpeg': 'fa-file-image file-image',
        'png': 'fa-file-image file-image',
        'gif': 'fa-file-image file-image'
    };
    return icons[ext] || 'fa-file file';
}

// ===========================================
// Utilitaires
// ===========================================

function escapeHtml(str) {
    if (typeof window.escapeHtml === 'function') {
        return window.escapeHtml(str);
    }
    if (str === null || str === undefined) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return String(str).replace(/[&<>"']/g, c => map[c]);
}

function formatFileSize(bytes) {
    if (typeof window.formatFileSize === 'function') {
        return window.formatFileSize(bytes);
    }
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' Go';
}

function formatDateFR(dateStr) {
    if (typeof window.formatDateFR === 'function') {
        return window.formatDateFR(dateStr);
    }
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR');
}

// ===========================================
// Export des fonctions pour utilisation globale
// ===========================================

// Documents institutionnels
window.loadDocuments = loadDocuments;
window.getDocuments = getDocuments;
window.getDocumentIcon = getDocumentIcon;

// Documents personnels
window.loadMyDocuments = loadMyDocuments;
window.viewDocument = viewDocument;
window.downloadDocument = downloadDocument;

// Drive
window.initDrive = initDrive;
window.loadDriveContent = loadDriveContent;
window.navigateDrive = navigateDrive;
window.updateBreadcrumb = updateBreadcrumb;
window.updateDriveQuota = updateDriveQuota;
window.setDriveView = setDriveView;
window.uploadFile = uploadFile;
window.createFolder = createFolder;
window.showDriveMenu = showDriveMenu;
window.deleteItem = deleteItem;
window.renameItem = renameItem;
window.shareItem = shareItem;
window.downloadItem = downloadItem;
window.previewFile = previewFile;
window.getFileIcon = getFileIcon;
