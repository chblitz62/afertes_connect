/**
 * Module UI
 * Gère les modals, toasts, navigation et utilitaires d'affichage
 */

// ===========================================
// Navigation entre pages
// ===========================================

function showLogin() {
    document.getElementById('login-page').classList.remove('hidden');
    document.getElementById('register-page').classList.add('hidden');
    document.getElementById('app').classList.add('hidden');

    // Réinitialiser le formulaire
    document.getElementById('login-form').reset();
}

function showRegister() {
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('register-page').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
}

function showApp() {
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('register-page').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');

    // Mettre à jour l'interface avec les données utilisateur
    updateUserInterface();
    loadDashboardData();
    showPage('dashboard');

    // Afficher les sections selon le rôle
    document.getElementById('formateur-section').classList.add('hidden');
    document.getElementById('secretary-section').classList.add('hidden');
    document.getElementById('bde-section').classList.add('hidden');

    if (window.currentUser.role === 'teacher') {
        document.getElementById('formateur-section').classList.remove('hidden');
    } else if (window.currentUser.role === 'secretary') {
        document.getElementById('secretary-section').classList.remove('hidden');
    } else if (window.currentUser.role === 'bde') {
        document.getElementById('bde-section').classList.remove('hidden');
    }

    // Cacher les éléments réservés aux étudiants pour formateurs/secrétaires
    if (window.currentUser.role === 'teacher' || window.currentUser.role === 'secretary') {
        document.querySelectorAll('.student-only').forEach(el => {
            el.classList.add('hidden');
        });
    } else {
        document.querySelectorAll('.student-only').forEach(el => {
            el.classList.remove('hidden');
        });
    }
}

function showPage(pageName) {
    // Mettre à jour la navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === pageName) {
            item.classList.add('active');
        }
    });

    // Afficher la page
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(`page-${pageName}`).classList.add('active');

    window.currentPage = pageName;

    // Charger les données spécifiques à la page
    switch (pageName) {
        case 'news':
            if (typeof loadNews === 'function') loadNews();
            break;
        case 'bde':
            if (typeof loadBDEEvents === 'function') loadBDEEvents();
            break;
        case 'messages':
            if (typeof loadConversations === 'function') loadConversations();
            break;
        case 'promo':
            if (typeof loadPromoMembers === 'function') loadPromoMembers();
            break;
        case 'directory':
            if (typeof loadDirectory === 'function') loadDirectory();
            break;
        case 'documents':
            if (typeof loadDocuments === 'function') loadDocuments();
            break;
        case 'profile':
            if (typeof loadProfile === 'function') loadProfile();
            break;
        case 'schedule':
            if (typeof loadSchedule === 'function') loadSchedule();
            break;
        case 'grades':
            if (typeof loadGrades === 'function') loadGrades();
            break;
        case 'my-documents':
            if (typeof loadMyDocuments === 'function') loadMyDocuments();
            break;
        case 'manage-grades':
            if (typeof initGradeManagement === 'function') initGradeManagement();
            break;
        case 'manage-schedule':
            if (typeof initScheduleManagement === 'function') initScheduleManagement();
            break;
        case 'admin-students':
            if (typeof loadAdminStudentsEnhanced === 'function') loadAdminStudentsEnhanced();
            break;
        case 'admin-schedules':
            if (typeof loadAdminScheduleTeachers === 'function') loadAdminScheduleTeachers();
            break;
        case 'admin-grades':
            if (typeof loadAdminGrades === 'function') loadAdminGrades();
            break;
        case 'bde-events-manage':
            if (typeof loadBDEEventsManage === 'function') loadBDEEventsManage();
            break;
        case 'bde-members':
            if (typeof loadBDEMembers === 'function') loadBDEMembers();
            break;
        case 'drive':
            if (typeof initDrive === 'function') initDrive();
            break;
        case 'group-messages':
            if (typeof initGroupMessages === 'function') initGroupMessages();
            break;
        case 'manage-promos':
            if (typeof initPromosData === 'function') initPromosData();
            if (typeof loadPromosList === 'function') loadPromosList();
            break;
        case 'students-documents':
            if (typeof loadStudentsDocuments === 'function') loadStudentsDocuments();
            break;
        case 'collaborative-docs':
            if (typeof loadCollabDocuments === 'function') loadCollabDocuments();
            break;
    }

    // Fermer les menus sur mobile
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('user-menu-dropdown').classList.add('hidden');
}

function selectSite(site, container) {
    window.selectedSite = site;

    container.querySelectorAll('.site-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.site === site) {
            btn.classList.add('active');
        }
    });
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

function toggleNotifications() {
    document.getElementById('notifications-panel').classList.toggle('hidden');
}

function toggleUserMenu() {
    document.getElementById('user-menu-dropdown').classList.toggle('hidden');
}

// ===========================================
// Modals
// ===========================================

function showModal(content) {
    document.getElementById('modal-content').innerHTML = content;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
}

// Initialiser le listener pour fermer le modal en cliquant à l'extérieur
function initModalListeners() {
    document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('modal-overlay')) {
            closeModal();
        }
    });
}

// ===========================================
// Toast notifications
// ===========================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        info: 'info-circle',
        warning: 'exclamation-triangle'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${icons[type] || icons.info}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ===========================================
// Utilitaires de formatage
// ===========================================

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'À l\'instant';
    if (diff < 3600000) return `Il y a ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `Il y a ${Math.floor(diff / 3600000)}h`;
    if (diff < 172800000) return 'Hier';

    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function formatTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatEventDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDateFR(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR');
}

function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
}

function getSiteName(site) {
    if (site === 'all') return 'Tous les sites';
    return window.APP_CONFIG?.sites[site]?.name || site;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getGradeClass(value) {
    if (value >= 16) return 'excellent';
    if (value >= 14) return 'good';
    if (value >= 10) return 'average';
    return 'below';
}

// ===========================================
// Téléchargement de fichiers
// ===========================================

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ===========================================
// Export des fonctions pour utilisation globale
// ===========================================

window.showLogin = showLogin;
window.showRegister = showRegister;
window.showApp = showApp;
window.showPage = showPage;
window.selectSite = selectSite;
window.toggleSidebar = toggleSidebar;
window.toggleNotifications = toggleNotifications;
window.toggleUserMenu = toggleUserMenu;
window.showModal = showModal;
window.closeModal = closeModal;
window.initModalListeners = initModalListeners;
window.showToast = showToast;
window.formatDate = formatDate;
window.formatTime = formatTime;
window.formatEventDate = formatEventDate;
window.formatDateFR = formatDateFR;
window.truncateText = truncateText;
window.getSiteName = getSiteName;
window.formatFileSize = formatFileSize;
window.getGradeClass = getGradeClass;
window.downloadFile = downloadFile;
