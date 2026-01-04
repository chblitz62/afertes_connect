/**
 * AFERTES Connect - Application JavaScript
 * Portail étudiant du centre de formation en travail social
 */

// ===========================================
// Configuration et état global
// ===========================================
const APP_CONFIG = {
    sites: {
        slb: {
            name: 'Saint-Laurent-Blangy',
            address: '1 rue Pierre et Marie Curie, 62223',
            phone: '03 21 60 40 00'
        },
        avion: {
            name: 'Avion',
            address: 'Rue des montagnards, 62210',
            phone: '03 21 49 23 71'
        }
    },
    formations: {
        es: 'Éducateur Spécialisé',
        me: 'Moniteur Éducateur',
        aes: 'Accompagnant Éducatif et Social',
        caferuis: 'CAFERUIS',
        cafdes: 'CAFDES'
    }
};

let currentUser = null;
let selectedSite = 'slb';
let currentPage = 'dashboard';
let activeConversation = null;

// ===========================================
// Gestion des sessions actives
// ===========================================
function registerActiveSession(userId) {
    const sessions = JSON.parse(localStorage.getItem('afertes_active_sessions') || '{}');
    sessions[userId] = {
        lastActivity: new Date().toISOString(),
        active: true
    };
    localStorage.setItem('afertes_active_sessions', JSON.stringify(sessions));
}

function removeActiveSession(userId) {
    const sessions = JSON.parse(localStorage.getItem('afertes_active_sessions') || '{}');
    delete sessions[userId];
    localStorage.setItem('afertes_active_sessions', JSON.stringify(sessions));
}

function isUserSessionActive(userId) {
    const sessions = JSON.parse(localStorage.getItem('afertes_active_sessions') || '{}');
    const session = sessions[userId];

    if (!session || !session.active) return false;

    // Considérer la session inactive après 30 minutes sans activité
    const lastActivity = new Date(session.lastActivity);
    const now = new Date();
    const diffMinutes = (now - lastActivity) / (1000 * 60);

    return diffMinutes < 30;
}

function updateSessionActivity() {
    if (currentUser) {
        registerActiveSession(currentUser.id);
    }
}

// ===========================================
// Notification par email
// ===========================================
async function sendEmailNotification(recipientUser, type, data) {
    // Vérifier si l'utilisateur a une session active
    if (isUserSessionActive(recipientUser.id)) {
        console.log(`[Email] Session active pour ${recipientUser.email}, notification non envoyée`);
        return false;
    }

    // Construire le contenu de l'email selon le type
    let subject, body;

    switch (type) {
        case 'new_conversation':
            subject = `[AFERTES Connect] Nouvelle conversation de ${data.senderName}`;
            body = `Bonjour ${recipientUser.firstname},\n\n` +
                   `${data.senderName} a démarré une nouvelle conversation avec vous sur AFERTES Connect.\n\n` +
                   `Connectez-vous pour répondre : ${window.location.origin}\n\n` +
                   `Cordialement,\nL'équipe AFERTES Connect`;
            break;
        case 'new_message':
            subject = `[AFERTES Connect] Nouveau message de ${data.senderName}`;
            body = `Bonjour ${recipientUser.firstname},\n\n` +
                   `Vous avez reçu un nouveau message de ${data.senderName}.\n\n` +
                   `Connectez-vous pour lire le message : ${window.location.origin}\n\n` +
                   `Cordialement,\nL'équipe AFERTES Connect`;
            break;
        default:
            return false;
    }

    // API endpoint pour l'envoi d'email (à configurer avec votre backend)
    const emailPayload = {
        to: recipientUser.email,
        subject: subject,
        body: body,
        type: type
    };

    // Pour la démo : log de l'email qui serait envoyé
    console.log('[Email] Notification à envoyer:', emailPayload);

    // Quand vous aurez un backend, décommentez et adaptez :
    /*
    try {
        const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emailPayload)
        });
        return response.ok;
    } catch (error) {
        console.error('[Email] Erreur d\'envoi:', error);
        return false;
    }
    */

    // Simulation d'envoi réussi pour la démo
    showToast(`Notification email envoyée à ${recipientUser.firstname}`, 'info');
    return true;
}

// ===========================================
// Initialisation
// ===========================================
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    // Vérifier si l'utilisateur est connecté
    const savedUser = localStorage.getItem('afertes_user');
    
    setTimeout(() => {
        document.getElementById('loading-screen').classList.add('hidden');
        
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            registerActiveSession(currentUser.id);
            showApp();

            // Mettre à jour l'activité toutes les 5 minutes
            setInterval(updateSessionActivity, 5 * 60 * 1000);
        } else {
            showLogin();
        }
    }, 1000);

    // Event listeners
    setupEventListeners();
}

function setupEventListeners() {
    // Formulaire de connexion
    document.getElementById('login-form').addEventListener('submit', handleLogin);

    // Bouton mot de passe oublié
    document.querySelector('.forgot-password').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showForgotPassword();
    });

    // Formulaire d'inscription
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    
    // Sélection du site
    document.querySelectorAll('.site-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            selectSite(btn.dataset.site, btn.closest('.site-selector'));
        });
    });
    
    // Changement de rôle dans l'inscription
    document.getElementById('reg-role').addEventListener('change', handleRoleChange);
    
    // Filtres d'actualités
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => filterNews(tab.dataset.filter));
    });
    
    // Recherche dans l'annuaire
    document.getElementById('directory-search')?.addEventListener('input', filterDirectory);
    document.getElementById('directory-filter')?.addEventListener('change', filterDirectory);
    
    // Formulaire de publication
    document.getElementById('publish-form')?.addEventListener('submit', handlePublish);
    
    // Paramètres de confidentialité
    document.querySelectorAll('.privacy-settings input').forEach(input => {
        input.addEventListener('change', savePrivacySettings);
    });

    // Formulaire emploi du temps admin (secrétaire)
    document.getElementById('admin-schedule-form')?.addEventListener('submit', handleAdminScheduleForm);

    // Filtres admin étudiants
    document.getElementById('admin-student-formation')?.addEventListener('change', loadAdminStudentsEnhanced);
    document.getElementById('admin-student-promo')?.addEventListener('change', loadAdminStudentsEnhanced);
    document.getElementById('admin-student-status')?.addEventListener('change', loadAdminStudentsEnhanced);
    document.getElementById('admin-student-search')?.addEventListener('input', loadAdminStudentsEnhanced);

    // Filtres admin notes
    document.getElementById('admin-grade-formation')?.addEventListener('change', loadAdminGrades);
    document.getElementById('admin-grade-promo')?.addEventListener('change', loadAdminGrades);
    document.getElementById('admin-grade-dc')?.addEventListener('change', loadAdminGrades);

    // Fermer les dropdowns au clic ailleurs
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.user-menu') && !e.target.closest('.user-menu-dropdown')) {
            document.getElementById('user-menu-dropdown').classList.add('hidden');
        }
        if (!e.target.closest('.notification-btn') && !e.target.closest('.notifications-panel')) {
            document.getElementById('notifications-panel').classList.add('hidden');
        }
    });
}

// ===========================================
// Authentification
// ===========================================
function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    // Vérifier les identifiants (simulé)
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const user = users.find(u => u.email === email);

    if (user && user.password === password) {
        currentUser = user;
        localStorage.setItem('afertes_user', JSON.stringify(user));
        registerActiveSession(user.id);

        // Vérifier si c'est un étudiant qui doit compléter son profil
        if (user.role === 'student' && !user.profileCompleted) {
            showFirstLoginModal(user);
        } else {
            showToast('Connexion réussie !', 'success');
            showApp();
        }
    } else {
        showToast('Email ou mot de passe incorrect', 'error');
    }
}

// ===========================================
// Première connexion étudiant
// ===========================================
function showFirstLoginModal(user) {
    const modal = document.getElementById('first-login-modal');

    // Pré-remplir les champs avec les données existantes
    document.getElementById('fl-lastname').value = user.lastname || '';
    document.getElementById('fl-firstname').value = user.firstname || '';
    document.getElementById('fl-email').value = user.email || '';

    // Afficher le modal
    modal.classList.remove('hidden');
    document.getElementById('login-page').classList.add('hidden');

    // Event listener pour le formulaire
    document.getElementById('first-login-form').addEventListener('submit', handleFirstLoginSubmit);
}

function handleFirstLoginSubmit(e) {
    e.preventDefault();

    const lastname = document.getElementById('fl-lastname').value.trim();
    const firstname = document.getElementById('fl-firstname').value.trim();
    const birthdate = document.getElementById('fl-birthdate').value;
    const phone = document.getElementById('fl-phone').value.trim();
    const email = document.getElementById('fl-email').value.trim();
    const socialSecurity = document.getElementById('fl-social-security').value.trim();
    const address = document.getElementById('fl-address').value.trim();
    const postalCode = document.getElementById('fl-postal-code').value.trim();
    const city = document.getElementById('fl-city').value.trim();
    const rgpdConsent = document.getElementById('fl-rgpd-consent').checked;

    // Validation
    if (!lastname || !firstname || !birthdate || !phone || !email || !socialSecurity || !address || !postalCode || !city) {
        showToast('Veuillez remplir tous les champs obligatoires', 'error');
        return;
    }

    // Validation numéro de sécurité sociale (15 chiffres)
    const ssnRegex = /^[12][0-9]{2}[0-1][0-9][0-9]{2}[0-9]{3}[0-9]{3}[0-9]{2}$/;
    if (!ssnRegex.test(socialSecurity)) {
        showToast('Le numéro de sécurité sociale doit contenir 15 chiffres', 'error');
        return;
    }

    // Validation code postal
    const postalRegex = /^[0-9]{5}$/;
    if (!postalRegex.test(postalCode)) {
        showToast('Le code postal doit contenir 5 chiffres', 'error');
        return;
    }

    // Validation téléphone
    const phoneClean = phone.replace(/[\s.-]/g, '');
    if (phoneClean.length < 10) {
        showToast('Le numéro de téléphone est invalide', 'error');
        return;
    }

    if (!rgpdConsent) {
        showToast('Veuillez accepter la politique de confidentialité RGPD', 'error');
        return;
    }

    // Mettre à jour l'utilisateur
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const userIndex = users.findIndex(u => u.id === currentUser.id);

    if (userIndex !== -1) {
        users[userIndex] = {
            ...users[userIndex],
            lastname,
            firstname,
            birthdate,
            phone,
            email,
            socialSecurity,
            address,
            postalCode,
            city,
            rgpdConsentDate: new Date().toISOString(),
            profileCompleted: true,
            profileCompletedAt: new Date().toISOString()
        };

        localStorage.setItem('afertes_users', JSON.stringify(users));
        currentUser = users[userIndex];
        localStorage.setItem('afertes_user', JSON.stringify(currentUser));

        // Fermer le modal et afficher l'application
        document.getElementById('first-login-modal').classList.add('hidden');
        showToast('Profil complété avec succès ! Bienvenue sur AFERTES Connect.', 'success');
        showApp();
    } else {
        showToast('Erreur lors de la mise à jour du profil', 'error');
    }
}

// ===========================================
// Gestion des documents
// ===========================================
let uploadedDocuments = {
    id: null,
    vitale: null,
    photo: null
};

function handleDocumentUpload(input, type) {
    const file = input.files[0];
    if (!file) return;

    // Validation taille (5 Mo max)
    if (file.size > 5 * 1024 * 1024) {
        showToast('Le fichier est trop volumineux (max 5 Mo)', 'error');
        input.value = '';
        return;
    }

    // Validation type
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (type === 'photo') {
        allowedTypes.pop(); // Pas de PDF pour la photo
    }
    if (!allowedTypes.includes(file.type)) {
        showToast('Format de fichier non autorisé', 'error');
        input.value = '';
        return;
    }

    // Stocker le fichier en base64
    const reader = new FileReader();
    reader.onload = function(e) {
        uploadedDocuments[type] = {
            name: file.name,
            type: file.type,
            size: file.size,
            data: e.target.result,
            uploadedAt: new Date().toISOString()
        };

        // Mettre à jour l'UI
        const uploadZone = document.getElementById(`upload-zone-${type}`);
        const preview = document.getElementById(`preview-${type}`);

        if (uploadZone) {
            uploadZone.classList.add('has-file');
            uploadZone.innerHTML = `
                <i class="fas fa-check-circle"></i>
                <span>${file.name}</span>
            `;
        }

        if (preview) {
            preview.classList.remove('hidden');
            const isImage = file.type.startsWith('image/');
            preview.innerHTML = `
                ${isImage ? `<img src="${e.target.result}" alt="Aperçu">` : '<i class="fas fa-file-pdf" style="font-size: 24px; color: var(--error-color);"></i>'}
                <div class="file-info">
                    <span class="file-name">${file.name}</span>
                    <span class="file-size">${formatFileSize(file.size)}</span>
                </div>
                <button type="button" class="remove-file" onclick="removeDocument('${type}')">
                    <i class="fas fa-times"></i>
                </button>
            `;
        }

        showToast('Document ajouté', 'success');
    };
    reader.readAsDataURL(file);
}

function removeDocument(type) {
    uploadedDocuments[type] = null;

    const uploadZone = document.getElementById(`upload-zone-${type}`);
    const preview = document.getElementById(`preview-${type}`);
    const input = document.getElementById(`fl-doc-${type}`);

    if (uploadZone) {
        uploadZone.classList.remove('has-file');
        uploadZone.innerHTML = `
            <i class="fas fa-cloud-upload-alt"></i>
            <span>Cliquez ou glissez un fichier</span>
        `;
    }

    if (preview) {
        preview.classList.add('hidden');
        preview.innerHTML = '';
    }

    if (input) {
        input.value = '';
    }
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
    return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
}

function updateDocument(input, type) {
    const file = input.files[0];
    if (!file) return;

    // Validation
    if (file.size > 5 * 1024 * 1024) {
        showToast('Le fichier est trop volumineux (max 5 Mo)', 'error');
        input.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        // Sauvegarder le document
        const docData = {
            name: file.name,
            type: file.type,
            size: file.size,
            data: e.target.result,
            uploadedAt: new Date().toISOString()
        };

        // Mettre à jour dans le localStorage
        const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
        const userIndex = users.findIndex(u => u.id === currentUser.id);

        if (userIndex !== -1) {
            if (!users[userIndex].documents) {
                users[userIndex].documents = {};
            }
            users[userIndex].documents[type] = docData;
            localStorage.setItem('afertes_users', JSON.stringify(users));

            currentUser.documents = users[userIndex].documents;
            localStorage.setItem('afertes_user', JSON.stringify(currentUser));

            showToast('Document mis à jour avec succès', 'success');
            loadMyDocuments();
        }
    };
    reader.readAsDataURL(file);
}

function loadMyDocuments() {
    const container = document.getElementById('my-documents-list');
    if (!container || !currentUser) return;

    const documents = currentUser.documents || {};
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
                    <i class="fas ${hasDoc ? 'fa-check' : docType.icon}"></i>
                </div>
                <div class="doc-info">
                    <div class="doc-name">${docType.name}</div>
                    <div class="doc-status ${hasDoc ? 'ok' : 'missing'}">
                        ${hasDoc ? `Déposé le ${formatDateFR(doc.uploadedAt.split('T')[0])}` : 'Non déposé'}
                    </div>
                </div>
                <div class="doc-actions">
                    ${hasDoc ? `
                        <button onclick="viewDocument('${docType.key}')" title="Voir">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button onclick="downloadDocument('${docType.key}')" title="Télécharger">
                            <i class="fas fa-download"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function viewDocument(type) {
    const doc = currentUser.documents?.[type];
    if (!doc) return;

    // Ouvrir dans une nouvelle fenêtre
    const win = window.open();
    if (doc.type.startsWith('image/')) {
        win.document.write(`<img src="${doc.data}" style="max-width: 100%;">`);
    } else {
        win.document.write(`<iframe src="${doc.data}" style="width: 100%; height: 100vh; border: none;"></iframe>`);
    }
}

function downloadDocument(type) {
    const doc = currentUser.documents?.[type];
    if (!doc) return;

    const link = document.createElement('a');
    link.href = doc.data;
    link.download = doc.name;
    link.click();
}

// ===========================================
// Génération attestation de scolarité
// ===========================================

// Cache pour le logo en base64
let logoBase64Cache = null;

// Fonction pour charger le logo en base64
function loadLogoBase64() {
    return new Promise((resolve) => {
        if (logoBase64Cache) {
            resolve(logoBase64Cache);
            return;
        }

        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            logoBase64Cache = canvas.toDataURL('image/png');
            resolve(logoBase64Cache);
        };
        img.onerror = function() {
            resolve(null);
        };
        img.src = 'img/logo-afertes.png';
    });
}

async function generateAttestationScolarite() {
    if (!currentUser || currentUser.role !== 'student') {
        showToast('Cette fonction est réservée aux étudiants', 'error');
        return;
    }

    showToast('Génération en cours...', 'info');

    // Charger le logo
    const logoData = await loadLogoBase64();

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;

    // En-tête avec fond coloré
    doc.setFillColor(37, 54, 114);
    doc.rect(0, 0, pageWidth, 50, 'F');

    // Logo AFERTES
    if (logoData) {
        try {
            doc.addImage(logoData, 'PNG', margin, 8, 35, 35);
        } catch (e) {
            console.log('Erreur logo:', e);
        }
    }

    // Texte en-tête
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('AFERTES', pageWidth / 2 + 10, 22, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Institut Régional du Travail Social', pageWidth / 2 + 10, 32, { align: 'center' });
    doc.text('Hauts-de-France', pageWidth / 2 + 10, 40, { align: 'center' });

    // Titre du document
    doc.setTextColor(37, 54, 114);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('ATTESTATION DE SCOLARITÉ', pageWidth / 2, 70, { align: 'center' });

    // Ligne décorative
    doc.setDrawColor(77, 146, 159);
    doc.setLineWidth(1);
    doc.line(pageWidth / 2 - 50, 75, pageWidth / 2 + 50, 75);

    // Année scolaire
    const now = new Date();
    const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    const schoolYear = `${year}-${year + 1}`;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`Année scolaire ${schoolYear}`, pageWidth / 2, 85, { align: 'center' });

    // Corps du texte
    doc.setFontSize(11);

    const siteName = currentUser.site === 'slb' ? 'Saint-Laurent-Blangy' : 'Avion';
    const siteAddress = currentUser.site === 'slb'
        ? '1 rue Pierre et Marie Curie, 62223 Saint-Laurent-Blangy'
        : 'Rue des montagnards, 62210 Avion';

    let y = 105;

    doc.text('Je soussigné(e), le Directeur de l\'AFERTES, certifie que :', margin, y);

    y += 20;

    // Informations étudiant
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    const fullName = `${currentUser.firstname} ${currentUser.lastname.toUpperCase()}`;
    doc.text(fullName, pageWidth / 2, y, { align: 'center' });

    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);

    if (currentUser.birthdate) {
        doc.text(`Né(e) le ${formatDateFR(currentUser.birthdate)}`, pageWidth / 2, y, { align: 'center' });
        y += 10;
    }

    y += 10;

    // Formation
    const formationName = APP_CONFIG.formations[currentUser.formation] || currentUser.formation?.toUpperCase();
    const promoYears = currentUser.promo ? `${currentUser.promo}-${parseInt(currentUser.promo) + 3}` : '';

    doc.text('est régulièrement inscrit(e) en formation :', margin, y);
    y += 12;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(37, 54, 114);
    doc.text(formationName, pageWidth / 2, y, { align: 'center' });

    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`Promotion ${promoYears}`, pageWidth / 2, y, { align: 'center' });

    y += 18;
    doc.text(`au sein de l'établissement AFERTES - Site de ${siteName}`, margin, y);
    y += 7;
    doc.text(siteAddress, margin, y);

    y += 20;
    doc.text('Cette attestation est délivrée pour servir et valoir ce que de droit.', margin, y);

    // Date et signature
    y += 35;
    const today = new Date().toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    doc.text(`Fait à ${siteName}, le ${today}`, pageWidth - margin, y, { align: 'right' });

    y += 20;
    doc.text('Le Directeur,', pageWidth - margin - 30, y, { align: 'center' });

    y += 25;
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(128, 128, 128);
    doc.text('Signature et cachet de l\'établissement', pageWidth - margin - 30, y, { align: 'center' });

    // Pied de page
    doc.setFillColor(37, 54, 114);
    doc.rect(0, 275, pageWidth, 22, 'F');

    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('AFERTES - Association pour la Formation, l\'Expansion et la Recherche en Travail Éducatif et Social', pageWidth / 2, 283, { align: 'center' });
    doc.text('Tél : 03 21 60 40 00 - www.afertes.org', pageWidth / 2, 290, { align: 'center' });

    // Numéro d'attestation
    const attestationNumber = `ATT-${currentUser.id}-${Date.now().toString(36).toUpperCase()}`;
    doc.setTextColor(200, 200, 200);
    doc.text(`N° ${attestationNumber}`, margin, 290);

    // Télécharger
    const filename = `attestation_scolarite_${currentUser.lastname}_${currentUser.firstname}_${schoolYear}.pdf`;
    doc.save(filename);

    showToast('Attestation de scolarité téléchargée', 'success');
}

function handleRegister(e) {
    e.preventDefault();
    
    const firstname = document.getElementById('reg-firstname').value;
    const lastname = document.getElementById('reg-lastname').value;
    const email = document.getElementById('reg-email').value;
    const role = document.getElementById('reg-role').value;
    const formation = document.getElementById('reg-formation').value;
    const promo = document.getElementById('reg-promo').value;
    const specialty = document.getElementById('reg-specialty')?.value || null;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-password-confirm').value;
    const rgpdConsent = document.getElementById('rgpd-consent').checked;
    
    // Récupérer les formations enseignées pour les formateurs
    let formationsTaught = [];
    if (role === 'teacher') {
        document.querySelectorAll('input[name="formations-taught"]:checked').forEach(checkbox => {
            formationsTaught.push(checkbox.value);
        });
        
        if (formationsTaught.length === 0) {
            showToast('Veuillez sélectionner au moins une formation enseignée', 'error');
            return;
        }
    }
    
    // Validation
    if (password !== confirmPassword) {
        showToast('Les mots de passe ne correspondent pas', 'error');
        return;
    }
    
    if (password.length < 8) {
        showToast('Le mot de passe doit contenir au moins 8 caractères', 'error');
        return;
    }
    
    if (!rgpdConsent) {
        showToast('Veuillez accepter la politique de confidentialité', 'error');
        return;
    }
    
    // Créer l'utilisateur
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    
    if (users.find(u => u.email === email)) {
        showToast('Un compte existe déjà avec cet email', 'error');
        return;
    }
    
    const newUser = {
        id: Date.now(),
        firstname,
        lastname,
        email,
        password,
        role,
        formation: role === 'student' ? formation : null,
        promo: role === 'student' ? promo : null,
        specialty: role === 'teacher' ? specialty : null,
        formationsTaught: role === 'teacher' ? formationsTaught : null,
        site: selectedSite,
        avatar: 'img/default-avatar.png',
        bio: '',
        privacy: {
            directory: true,
            email: false,
            photo: true
        },
        createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    localStorage.setItem('afertes_users', JSON.stringify(users));
    
    showToast('Compte créé avec succès ! Vous pouvez maintenant vous connecter.', 'success');
    showLogin();
}

function logout() {
    if (currentUser) {
        removeActiveSession(currentUser.id);
    }
    currentUser = null;
    localStorage.removeItem('afertes_user');
    showLogin();
    showToast('Déconnexion réussie', 'info');
}

function handleRoleChange() {
    const role = document.getElementById('reg-role').value;
    const formationGroup = document.getElementById('formation-group');
    const promoGroup = document.getElementById('promo-group');
    const specialtyGroup = document.getElementById('specialty-group');
    const formationsTaughtGroup = document.getElementById('formations-taught-group');

    // Réinitialiser tous les champs
    formationGroup.style.display = 'none';
    formationGroup.classList.add('hidden');
    promoGroup.style.display = 'none';
    promoGroup.classList.add('hidden');
    specialtyGroup.classList.add('hidden');
    formationsTaughtGroup.classList.add('hidden');
    document.getElementById('reg-formation').required = false;
    document.getElementById('reg-promo').required = false;

    if (role === 'student') {
        formationGroup.style.display = 'block';
        formationGroup.classList.remove('hidden');
        promoGroup.style.display = 'block';
        promoGroup.classList.remove('hidden');
        document.getElementById('reg-formation').required = true;
        document.getElementById('reg-promo').required = true;
    } else if (role === 'teacher') {
        specialtyGroup.classList.remove('hidden');
        formationsTaughtGroup.classList.remove('hidden');
    } else if (role === 'bde') {
        // Le BDE a besoin de formation et promo (c'est un étudiant membre du BDE)
        formationGroup.style.display = 'block';
        formationGroup.classList.remove('hidden');
        promoGroup.style.display = 'block';
        promoGroup.classList.remove('hidden');
        document.getElementById('reg-formation').required = true;
        document.getElementById('reg-promo').required = true;
    }
    // Pour secretary, aucun champ supplémentaire n'est requis
}

// ===========================================
// Navigation
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

    if (currentUser.role === 'teacher') {
        document.getElementById('formateur-section').classList.remove('hidden');
    } else if (currentUser.role === 'secretary') {
        document.getElementById('secretary-section').classList.remove('hidden');
    } else if (currentUser.role === 'bde') {
        document.getElementById('bde-section').classList.remove('hidden');
    }

    // Cacher les éléments réservés aux étudiants pour formateurs/secrétaires
    if (currentUser.role === 'teacher' || currentUser.role === 'secretary') {
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
    
    currentPage = pageName;
    
    // Charger les données spécifiques à la page
    switch (pageName) {
        case 'news':
            loadNews();
            break;
        case 'bde':
            loadBDEEvents();
            break;
        case 'messages':
            loadConversations();
            break;
        case 'promo':
            loadPromoMembers();
            break;
        case 'directory':
            loadDirectory();
            break;
        case 'documents':
            loadDocuments();
            break;
        case 'profile':
            loadProfile();
            break;
        case 'schedule':
            loadSchedule();
            break;
        case 'grades':
            loadGrades();
            break;
        case 'my-documents':
            loadMyDocuments();
            break;
        case 'manage-grades':
            initGradeManagement();
            break;
        case 'manage-schedule':
            initScheduleManagement();
            break;
        // Pages secrétaire
        case 'admin-students':
            loadAdminStudentsEnhanced();
            break;
        case 'admin-schedules':
            loadAdminScheduleTeachers();
            break;
        case 'admin-grades':
            loadAdminGrades();
            break;
        case 'admin-inscriptions':
            // Charger les inscriptions en attente
            break;
        // Pages BDE
        case 'bde-events-manage':
            loadBDEEventsManage();
            break;
        case 'bde-members':
            loadBDEMembers();
            break;
        // Drive
        case 'drive':
            initDrive();
            break;
        // Messagerie de groupe
        case 'group-messages':
            initGroupMessages();
            break;
        // Gestion des promos
        case 'manage-promos':
            initPromosData();
            loadPromosList();
            break;
        case 'students-documents':
            loadStudentsDocuments();
            break;
    }

    // Fermer les menus sur mobile
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('user-menu-dropdown').classList.add('hidden');
}

function selectSite(site, container) {
    selectedSite = site;
    
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
    document.getElementById('user-menu-dropdown').classList.add('hidden');
}

function toggleUserMenu() {
    document.getElementById('user-menu-dropdown').classList.toggle('hidden');
    document.getElementById('notifications-panel').classList.add('hidden');
}

// ===========================================
// Interface utilisateur
// ===========================================
function updateUserInterface() {
    if (!currentUser) return;
    
    // Header
    document.getElementById('header-username').textContent = currentUser.firstname;
    document.getElementById('header-avatar').src = currentUser.avatar;
    document.getElementById('current-site').textContent = APP_CONFIG.sites[currentUser.site].name;
    
    // Sidebar
    document.getElementById('sidebar-site').textContent = APP_CONFIG.sites[currentUser.site].name;
    document.getElementById('sidebar-address').textContent = APP_CONFIG.sites[currentUser.site].address;
    
    // Dashboard
    document.getElementById('welcome-name').textContent = currentUser.firstname;
    
    // Charger les notifications
    loadNotifications();
}

function loadNotifications() {
    const notifications = getNotifications();
    const container = document.getElementById('notifications-list');
    const countBadge = document.getElementById('notif-count');
    
    const unreadCount = notifications.filter(n => !n.read).length;
    countBadge.textContent = unreadCount;
    countBadge.style.display = unreadCount > 0 ? 'flex' : 'none';
    
    container.innerHTML = notifications.map(notif => `
        <div class="notification-item ${notif.read ? '' : 'unread'}" onclick="markNotificationRead(${notif.id})">
            <h4>${notif.title}</h4>
            <p>${notif.message}</p>
            <span class="time">${formatDate(notif.date)}</span>
        </div>
    `).join('');
}

function markNotificationRead(id) {
    let notifications = getNotifications();
    notifications = notifications.map(n => {
        if (n.id === id) n.read = true;
        return n;
    });
    localStorage.setItem('afertes_notifications', JSON.stringify(notifications));
    loadNotifications();
}

function markAllRead() {
    let notifications = getNotifications();
    notifications = notifications.map(n => ({ ...n, read: true }));
    localStorage.setItem('afertes_notifications', JSON.stringify(notifications));
    loadNotifications();
    showToast('Toutes les notifications marquées comme lues', 'success');
}

// ===========================================
// Dashboard
// ===========================================
function loadDashboardData() {
    loadDashboardSchedule();
    loadDashboardNews();
    loadDashboardBDE();
    loadDashboardMessages();
    loadDashboardPromo();
}

function loadDashboardNews() {
    const news = getNews().slice(0, 3);
    const container = document.getElementById('dashboard-news');
    
    container.innerHTML = news.map(item => `
        <div class="news-item">
            <h3>${item.title}</h3>
            <p>${truncateText(item.content, 80)}</p>
            <span class="meta">${formatDate(item.date)} - ${getSiteName(item.site)}</span>
        </div>
    `).join('');
}

function loadDashboardBDE() {
    const events = getBDEEvents().slice(0, 2);
    const container = document.getElementById('dashboard-bde');
    
    container.innerHTML = events.map(event => `
        <div class="news-item">
            <h3>${event.title}</h3>
            <p>${event.description}</p>
            <span class="meta"><i class="fas fa-calendar"></i> ${formatEventDate(event.date)}</span>
        </div>
    `).join('');
}

function loadDashboardMessages() {
    const messages = getRecentMessages().slice(0, 3);
    const container = document.getElementById('dashboard-messages');
    
    container.innerHTML = messages.map(msg => `
        <div class="news-item">
            <h3>${msg.senderName}</h3>
            <p>${truncateText(msg.content, 60)}</p>
            <span class="meta">${formatDate(msg.date)}</span>
        </div>
    `).join('');
}

function loadDashboardPromo() {
    const members = getPromoMembers().slice(0, 4);
    const container = document.getElementById('dashboard-promo');
    
    container.innerHTML = `
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            ${members.map(member => `
                <div style="text-align: center;">
                    <img src="${member.avatar}" alt="${member.firstname}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;">
                    <p style="font-size: 0.8rem; margin-top: 4px;">${member.firstname}</p>
                </div>
            `).join('')}
        </div>
    `;
}

// ===========================================
// Actualités
// ===========================================
function loadNews() {
    const news = getNews();
    displayNews(news);
}

function displayNews(news) {
    const container = document.getElementById('news-list');
    
    container.innerHTML = news.map(item => `
        <article class="news-card-full" onclick="showNewsDetail(${item.id})">
            ${item.image ? `<img src="${item.image}" alt="${item.title}" class="news-card-image">` : ''}
            <div class="news-card-content">
                <h3>${item.title}</h3>
                <p>${truncateText(item.content, 150)}</p>
                <div class="news-card-meta">
                    <span>${formatDate(item.date)}</span>
                    <span class="site-tag">${getSiteName(item.site)}</span>
                </div>
            </div>
        </article>
    `).join('');
}

function filterNews(filter) {
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.filter === filter) {
            tab.classList.add('active');
        }
    });
    
    let news = getNews();
    if (filter !== 'all') {
        news = news.filter(n => n.site === filter || n.site === 'all');
    }
    displayNews(news);
}

function showNewsDetail(id) {
    const news = getNews().find(n => n.id === id);
    if (!news) return;
    
    showModal(`
        <h2>${news.title}</h2>
        ${news.image ? `<img src="${news.image}" alt="${news.title}" style="width: 100%; border-radius: 8px; margin: 16px 0;">` : ''}
        <p style="margin: 16px 0; line-height: 1.7;">${news.content}</p>
        <div style="display: flex; justify-content: space-between; color: var(--text-muted); font-size: 0.9rem;">
            <span>${formatDate(news.date)}</span>
            <span class="site-tag">${getSiteName(news.site)}</span>
        </div>
    `);
}

function handlePublish(e) {
    e.preventDefault();
    
    const title = document.getElementById('news-title').value;
    const content = document.getElementById('news-content').value;
    const site = document.getElementById('news-site').value;
    
    const news = getNews();
    news.unshift({
        id: Date.now(),
        title,
        content,
        site,
        date: new Date().toISOString(),
        author: `${currentUser.firstname} ${currentUser.lastname}`
    });
    
    localStorage.setItem('afertes_news', JSON.stringify(news));
    
    showToast('Actualité publiée avec succès !', 'success');
    document.getElementById('publish-form').reset();
}

// ===========================================
// BDE
// ===========================================
function loadBDEEvents() {
    const events = getBDEEvents();
    const container = document.getElementById('bde-events');
    
    container.innerHTML = events.map(event => {
        const date = new Date(event.date);
        return `
            <article class="event-card">
                <div class="event-date">
                    <span class="day">${date.getDate()}</span>
                    <span class="month">${date.toLocaleDateString('fr-FR', { month: 'short' })}</span>
                </div>
                <div class="event-info">
                    <h3>${event.title}</h3>
                    <p>${event.description}</p>
                    <span class="location"><i class="fas fa-map-marker-alt"></i> ${event.location}</span>
                </div>
            </article>
        `;
    }).join('');
}

function contactBDE() {
    showModal(`
        <h2><i class="fas fa-hand-paper" style="color: var(--primary-color);"></i> Rejoindre le BDE</h2>
        <p style="margin: 16px 0; color: var(--text-light);">
            Tu souhaites t'impliquer dans la vie étudiante de l'AFERTES ? 
            Contacte-nous pour rejoindre l'équipe BDE !
        </p>
        <form onsubmit="submitBDEInterest(event)">
            <div class="form-group">
                <label>Message (optionnel)</label>
                <textarea id="bde-message" rows="4" placeholder="Dis-nous ce qui te motive..."></textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-block">
                <i class="fas fa-paper-plane"></i> Envoyer ma candidature
            </button>
        </form>
    `);
}

function submitBDEInterest(e) {
    e.preventDefault();
    closeModal();
    showToast('Ta candidature a bien été envoyée au BDE !', 'success');
}

// ===========================================
// Messages
// ===========================================
function loadConversations() {
    const conversations = getConversations();
    const container = document.getElementById('conversations-items');
    
    container.innerHTML = conversations.map(conv => `
        <div class="conversation-item ${conv.unread ? 'unread' : ''}" onclick="openConversation(${conv.id})">
            <img src="${conv.avatar}" alt="${conv.name}" class="conversation-avatar">
            <div class="conversation-info">
                <h4>${conv.name}</h4>
                <p>${conv.lastMessage}</p>
            </div>
            <div class="conversation-meta">
                <span class="time">${formatDate(conv.lastDate)}</span>
                ${conv.unread ? `<span class="unread-badge">${conv.unreadCount}</span>` : ''}
            </div>
        </div>
    `).join('');
}

function openConversation(id) {
    activeConversation = id;
    const conversations = getConversations();
    const conv = conversations.find(c => c.id === id);
    const messages = getConversationMessages(id);
    const container = document.getElementById('chat-container');

    // Marquer la conversation comme lue
    if (conv && conv.unread) {
        conv.unread = false;
        conv.unreadCount = 0;
        localStorage.setItem('afertes_conversations', JSON.stringify(conversations));
        loadConversations();
    }
    
    container.innerHTML = `
        <div class="chat-header">
            <img src="${conv.avatar}" alt="${conv.name}" style="width: 40px; height: 40px; border-radius: 50%;">
            <div>
                <h4 style="font-size: 0.95rem;">${conv.name}</h4>
                <span style="font-size: 0.8rem; color: var(--text-muted);">${conv.role}</span>
            </div>
        </div>
        <div class="chat-messages" id="chat-messages">
            ${messages.map(msg => `
                <div class="message ${msg.sent ? 'sent' : 'received'}">
                    <div class="message-content">${msg.content}</div>
                    <span class="message-time">${formatTime(msg.date)}</span>
                </div>
            `).join('')}
        </div>
        <div class="chat-input">
            <input type="text" id="message-input" placeholder="Écrivez votre message..." onkeypress="handleMessageKeypress(event)">
            <button onclick="sendMessage()">
                <i class="fas fa-paper-plane"></i>
            </button>
        </div>
    `;
    
    // Scroll to bottom
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function handleMessageKeypress(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
}

function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    
    if (!content || !activeConversation) return;
    
    // Ajouter le message
    const messages = document.getElementById('chat-messages');
    messages.innerHTML += `
        <div class="message sent">
            <div class="message-content">${content}</div>
            <span class="message-time">${formatTime(new Date())}</span>
        </div>
    `;
    
    input.value = '';
    messages.scrollTop = messages.scrollHeight;
    
    // Sauvegarder le message
    saveMessage(activeConversation, content);
}

function saveMessage(conversationId, content) {
    const key = `afertes_messages_${conversationId}`;
    const messages = JSON.parse(localStorage.getItem(key) || '[]');
    const now = new Date().toISOString();

    messages.push({
        id: Date.now(),
        content,
        sent: true,
        date: now
    });
    localStorage.setItem(key, JSON.stringify(messages));

    // Mettre à jour le lastMessage de la conversation
    updateConversationLastMessage(conversationId, content, now);
}

function updateConversationLastMessage(conversationId, content, date) {
    const conversations = getConversations();
    const convIndex = conversations.findIndex(c => c.id === conversationId);

    if (convIndex !== -1) {
        // Tronquer le message si trop long
        const truncated = content.length > 50 ? content.substring(0, 47) + '...' : content;
        conversations[convIndex].lastMessage = truncated;
        conversations[convIndex].lastDate = date;

        // Déplacer la conversation en haut de la liste
        const [conv] = conversations.splice(convIndex, 1);
        conversations.unshift(conv);

        localStorage.setItem('afertes_conversations', JSON.stringify(conversations));
        loadConversations();
    }
}

function newConversation() {
    const users = getAllUsers().filter(u => u.id !== currentUser.id);
    
    showModal(`
        <h2><i class="fas fa-plus" style="color: var(--primary-color);"></i> Nouvelle conversation</h2>
        <div class="form-group" style="margin-top: 16px;">
            <label>Rechercher un contact</label>
            <input type="text" id="contact-search" placeholder="Nom, prénom..." oninput="filterContacts()">
        </div>
        <div id="contacts-list" style="max-height: 300px; overflow-y: auto;">
            ${users.map(user => `
                <div class="conversation-item" onclick="startConversation(${user.id})" style="cursor: pointer;">
                    <img src="${user.avatar}" class="conversation-avatar">
                    <div class="conversation-info">
                        <h4>${user.firstname} ${user.lastname}</h4>
                        <p>${user.role === 'teacher' ? 'Formateur' : APP_CONFIG.formations[user.formation] || ''}</p>
                    </div>
                </div>
            `).join('')}
        </div>
    `);
}

function startConversation(userId) {
    closeModal();

    const conversations = getConversations();
    const user = getAllUsers().find(u => u.id === userId);

    if (!user) {
        showToast('Utilisateur introuvable', 'error');
        return;
    }

    // Vérifier si une conversation existe déjà avec cet utilisateur
    const existingConv = conversations.find(c => c.userId === userId);

    if (existingConv) {
        // Ouvrir la conversation existante
        openConversation(existingConv.id);
        showToast('Conversation ouverte', 'success');
    } else {
        // Créer une nouvelle conversation
        const newConv = {
            id: Date.now(),
            userId: user.id,
            name: `${user.firstname} ${user.lastname}`,
            avatar: user.avatar || 'img/default-avatar.svg',
            role: user.role === 'teacher' ? 'Formateur' : (APP_CONFIG.formations[user.formation] || 'Étudiant'),
            lastMessage: '',
            lastDate: new Date().toISOString(),
            unread: false,
            unreadCount: 0
        };

        conversations.unshift(newConv);
        localStorage.setItem('afertes_conversations', JSON.stringify(conversations));

        // Envoyer une notification email si le destinataire n'est pas connecté
        sendEmailNotification(user, 'new_conversation', {
            senderName: `${currentUser.firstname} ${currentUser.lastname}`
        });

        // Recharger la liste et ouvrir la conversation
        loadConversations();
        openConversation(newConv.id);
        showToast('Nouvelle conversation créée', 'success');
    }
}

// ===========================================
// Promo & Annuaire
// ===========================================
function loadPromoMembers() {
    const members = getPromoMembers();
    const container = document.getElementById('promo-members');
    
    // Mettre à jour les infos de la promo
    document.getElementById('promo-info').textContent = 
        `${APP_CONFIG.formations[currentUser.formation] || ''} - Promotion ${currentUser.promo}`;
    
    container.innerHTML = members.map(member => `
        <div class="member-card">
            <img src="${member.avatar}" alt="${member.firstname}" class="member-avatar">
            <h3>${member.firstname} ${member.lastname}</h3>
            <p>${APP_CONFIG.formations[member.formation] || ''}</p>
            <div class="member-actions">
                <button onclick="viewProfile(${member.id})" title="Voir le profil">
                    <i class="fas fa-user"></i>
                </button>
                <button onclick="startConversation(${member.id})" title="Envoyer un message">
                    <i class="fas fa-comment"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function loadDirectory() {
    const users = getAllUsers();
    displayDirectory(users);
}

function displayDirectory(users) {
    const container = document.getElementById('directory-list');
    
    container.innerHTML = users.map(user => `
        <div class="member-card">
            <img src="${user.avatar}" alt="${user.firstname}" class="member-avatar">
            <h3>${user.firstname} ${user.lastname}</h3>
            <p>${user.role === 'teacher' ? 'Formateur' : APP_CONFIG.formations[user.formation] || ''}</p>
            <span class="role-badge">${APP_CONFIG.sites[user.site]?.name || user.site}</span>
            <div class="member-actions">
                <button onclick="viewProfile(${user.id})" title="Voir le profil">
                    <i class="fas fa-user"></i>
                </button>
                <button onclick="startConversation(${user.id})" title="Envoyer un message">
                    <i class="fas fa-comment"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function filterDirectory() {
    const searchTerm = document.getElementById('directory-search').value.toLowerCase();
    const roleFilter = document.getElementById('directory-filter').value;
    
    let users = getAllUsers();
    
    if (searchTerm) {
        users = users.filter(u => 
            `${u.firstname} ${u.lastname}`.toLowerCase().includes(searchTerm) ||
            (APP_CONFIG.formations[u.formation] || '').toLowerCase().includes(searchTerm)
        );
    }
    
    if (roleFilter !== 'all') {
        users = users.filter(u => u.role === roleFilter);
    }
    
    displayDirectory(users);
}

// ===========================================
// Profil
// ===========================================
function loadProfile() {
    if (!currentUser) return;
    
    document.getElementById('profile-avatar').src = currentUser.avatar;
    document.getElementById('profile-fullname').textContent = `${currentUser.firstname} ${currentUser.lastname}`;
    document.getElementById('profile-role').textContent = 
        currentUser.role === 'teacher' ? 'Formateur' : `Étudiant - ${APP_CONFIG.formations[currentUser.formation] || ''}`;
    document.getElementById('profile-site').innerHTML = 
        `<i class="fas fa-map-marker-alt"></i> ${APP_CONFIG.sites[currentUser.site]?.name || ''}`;
    
    document.getElementById('profile-email').textContent = currentUser.email;
    document.getElementById('profile-formation').textContent = APP_CONFIG.formations[currentUser.formation] || 'N/A';
    document.getElementById('profile-promo').textContent = currentUser.promo || 'N/A';
    document.getElementById('profile-site-detail').textContent = APP_CONFIG.sites[currentUser.site]?.name || '';
    document.getElementById('profile-bio').textContent = currentUser.bio || 'Cliquez sur "Modifier mon profil" pour ajouter une description.';
    
    // Paramètres de confidentialité
    document.getElementById('privacy-directory').checked = currentUser.privacy?.directory ?? true;
    document.getElementById('privacy-email').checked = currentUser.privacy?.email ?? false;
    document.getElementById('privacy-photo').checked = currentUser.privacy?.photo ?? true;
}

function editProfile() {
    showModal(`
        <h2><i class="fas fa-edit" style="color: var(--primary-color);"></i> Modifier mon profil</h2>
        <form onsubmit="saveProfile(event)" style="margin-top: 16px;">
            <div class="form-group">
                <label>Prénom</label>
                <input type="text" id="edit-firstname" value="${currentUser.firstname}" required>
            </div>
            <div class="form-group">
                <label>Nom</label>
                <input type="text" id="edit-lastname" value="${currentUser.lastname}" required>
            </div>
            <div class="form-group">
                <label>Bio</label>
                <textarea id="edit-bio" rows="4" placeholder="Parlez-nous de vous...">${currentUser.bio || ''}</textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-block">
                <i class="fas fa-save"></i> Enregistrer
            </button>
        </form>
    `);
}

function saveProfile(e) {
    e.preventDefault();
    
    currentUser.firstname = document.getElementById('edit-firstname').value;
    currentUser.lastname = document.getElementById('edit-lastname').value;
    currentUser.bio = document.getElementById('edit-bio').value;
    
    // Sauvegarder dans localStorage
    localStorage.setItem('afertes_user', JSON.stringify(currentUser));
    
    // Mettre à jour la liste des utilisateurs
    let users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    users = users.map(u => u.id === currentUser.id ? currentUser : u);
    localStorage.setItem('afertes_users', JSON.stringify(users));
    
    closeModal();
    loadProfile();
    updateUserInterface();
    showToast('Profil mis à jour !', 'success');
}

function changeAvatar() {
    showModal(`
        <h2><i class="fas fa-camera" style="color: var(--primary-color);"></i> Changer ma photo</h2>
        <p style="margin: 16px 0; color: var(--text-light);">
            Choisissez une nouvelle photo de profil. Elle sera visible par les autres membres selon vos paramètres de confidentialité.
        </p>
        <div class="form-group">
            <input type="file" id="avatar-input" accept="image/*" onchange="previewAvatar(this)">
        </div>
        <div id="avatar-preview" style="text-align: center; margin: 16px 0;"></div>
        <button onclick="uploadAvatar()" class="btn btn-primary btn-block">
            <i class="fas fa-upload"></i> Mettre à jour
        </button>
    `);
}

function previewAvatar(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('avatar-preview').innerHTML = 
                `<img src="${e.target.result}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover;">`;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function uploadAvatar() {
    const input = document.getElementById('avatar-input');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            currentUser.avatar = e.target.result;
            localStorage.setItem('afertes_user', JSON.stringify(currentUser));
            
            // Mettre à jour la liste des utilisateurs
            let users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
            users = users.map(u => u.id === currentUser.id ? currentUser : u);
            localStorage.setItem('afertes_users', JSON.stringify(users));
            
            closeModal();
            loadProfile();
            updateUserInterface();
            showToast('Photo de profil mise à jour !', 'success');
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function savePrivacySettings() {
    currentUser.privacy = {
        directory: document.getElementById('privacy-directory').checked,
        email: document.getElementById('privacy-email').checked,
        photo: document.getElementById('privacy-photo').checked
    };
    
    localStorage.setItem('afertes_user', JSON.stringify(currentUser));
    
    let users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    users = users.map(u => u.id === currentUser.id ? currentUser : u);
    localStorage.setItem('afertes_users', JSON.stringify(users));
    
    showToast('Paramètres de confidentialité mis à jour', 'success');
}

function viewProfile(userId) {
    const user = getAllUsers().find(u => u.id === userId);
    if (!user) return;
    
    showModal(`
        <div style="text-align: center; margin-bottom: 20px;">
            <img src="${user.avatar}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover;">
            <h2 style="margin-top: 12px;">${user.firstname} ${user.lastname}</h2>
            <p style="color: var(--primary-color);">
                ${user.role === 'teacher' ? 'Formateur' : APP_CONFIG.formations[user.formation] || ''}
            </p>
        </div>
        <div class="profile-grid">
            <div class="profile-field">
                <label>Site</label>
                <span>${APP_CONFIG.sites[user.site]?.name || ''}</span>
            </div>
            ${user.promo ? `
            <div class="profile-field">
                <label>Promotion</label>
                <span>${user.promo}</span>
            </div>
            ` : ''}
        </div>
        ${user.bio ? `<p style="margin-top: 16px; color: var(--text-light);">${user.bio}</p>` : ''}
        <button onclick="startConversation(${user.id}); closeModal();" class="btn btn-primary btn-block" style="margin-top: 20px;">
            <i class="fas fa-comment"></i> Envoyer un message
        </button>
    `);
}

// ===========================================
// Documents
// ===========================================
function loadDocuments() {
    const documents = getDocuments();
    const container = document.getElementById('documents-list');
    
    container.innerHTML = documents.map(doc => `
        <div class="document-card">
            <div class="document-icon">
                <i class="fas fa-${getDocumentIcon(doc.type)}"></i>
            </div>
            <div class="document-info">
                <h3>${doc.title}</h3>
                <p>${doc.description}</p>
            </div>
        </div>
    `).join('');
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
// Paramètres
// ===========================================
function changePassword() {
    showModal(`
        <h2><i class="fas fa-key" style="color: var(--primary-color);"></i> Changer de mot de passe</h2>
        <form onsubmit="submitPasswordChange(event)" style="margin-top: 16px;">
            <div class="form-group">
                <label>Mot de passe actuel</label>
                <input type="password" id="current-password" required>
            </div>
            <div class="form-group">
                <label>Nouveau mot de passe</label>
                <input type="password" id="new-password" required minlength="8">
            </div>
            <div class="form-group">
                <label>Confirmer le nouveau mot de passe</label>
                <input type="password" id="confirm-new-password" required>
            </div>
            <button type="submit" class="btn btn-primary btn-block">
                <i class="fas fa-save"></i> Changer le mot de passe
            </button>
        </form>
    `);
}

function submitPasswordChange(e) {
    e.preventDefault();
    
    const current = document.getElementById('current-password').value;
    const newPass = document.getElementById('new-password').value;
    const confirm = document.getElementById('confirm-new-password').value;
    
    if (current !== currentUser.password) {
        showToast('Mot de passe actuel incorrect', 'error');
        return;
    }
    
    if (newPass !== confirm) {
        showToast('Les mots de passe ne correspondent pas', 'error');
        return;
    }
    
    currentUser.password = newPass;
    localStorage.setItem('afertes_user', JSON.stringify(currentUser));
    
    let users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    users = users.map(u => u.id === currentUser.id ? currentUser : u);
    localStorage.setItem('afertes_users', JSON.stringify(users));
    
    closeModal();
    showToast('Mot de passe modifié avec succès', 'success');
}

function deleteAccount() {
    showModal(`
        <h2 style="color: var(--error-color);"><i class="fas fa-exclamation-triangle"></i> Supprimer mon compte</h2>
        <p style="margin: 16px 0; color: var(--text-light);">
            Cette action est irréversible. Toutes vos données seront supprimées conformément au RGPD.
        </p>
        <p style="margin-bottom: 20px;">Pour confirmer, tapez <strong>SUPPRIMER</strong> ci-dessous :</p>
        <div class="form-group">
            <input type="text" id="delete-confirm" placeholder="SUPPRIMER">
        </div>
        <button onclick="confirmDeleteAccount()" class="btn btn-danger btn-block">
            <i class="fas fa-trash"></i> Supprimer définitivement
        </button>
    `);
}

function confirmDeleteAccount() {
    if (document.getElementById('delete-confirm').value !== 'SUPPRIMER') {
        showToast('Veuillez taper SUPPRIMER pour confirmer', 'error');
        return;
    }
    
    // Supprimer l'utilisateur
    let users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    users = users.filter(u => u.id !== currentUser.id);
    localStorage.setItem('afertes_users', JSON.stringify(users));
    
    closeModal();
    logout();
    showToast('Votre compte a été supprimé', 'info');
}

// ===========================================
// RGPD
// ===========================================
function showRGPD() {
    showModal(`
        <h2><i class="fas fa-shield-alt" style="color: var(--primary-color);"></i> Politique de confidentialité</h2>
        <div style="max-height: 400px; overflow-y: auto; padding-right: 10px;">
            <h3 style="margin: 20px 0 10px;">1. Collecte des données</h3>
            <p style="color: var(--text-light); line-height: 1.7;">
                L'AFERTES collecte uniquement les données nécessaires au bon fonctionnement du portail étudiant : 
                nom, prénom, email, formation, promotion et site de formation.
            </p>
            
            <h3 style="margin: 20px 0 10px;">2. Utilisation des données</h3>
            <p style="color: var(--text-light); line-height: 1.7;">
                Vos données sont utilisées pour la gestion de votre espace étudiant, la communication avec 
                les formateurs et autres étudiants, et la diffusion d'informations concernant votre formation.
            </p>
            
            <h3 style="margin: 20px 0 10px;">3. Vos droits</h3>
            <p style="color: var(--text-light); line-height: 1.7;">
                Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, de suppression 
                et de portabilité de vos données. Vous pouvez exercer ces droits depuis votre profil ou 
                en contactant le DPO de l'AFERTES.
            </p>
            
            <h3 style="margin: 20px 0 10px;">4. Conservation des données</h3>
            <p style="color: var(--text-light); line-height: 1.7;">
                Vos données sont conservées pendant la durée de votre formation et archivées pendant 
                5 ans après la fin de celle-ci, conformément aux obligations légales.
            </p>
            
            <h3 style="margin: 20px 0 10px;">5. Contact</h3>
            <p style="color: var(--text-light); line-height: 1.7;">
                Pour toute question concernant vos données personnelles :<br>
                DPO AFERTES - dpo@afertes.org<br>
                1 rue Pierre et Marie Curie, 62223 Saint-Laurent-Blangy
            </p>
        </div>
    `);
}

function showForgotPassword() {
    showModal(`
        <h2><i class="fas fa-key" style="color: var(--primary-color);"></i> Mot de passe oublié</h2>
        <p style="margin: 16px 0; color: var(--text-light);">
            Entrez votre adresse email pour recevoir un lien de réinitialisation.
        </p>
        <form onsubmit="submitForgotPassword(event)">
            <div class="form-group">
                <label>Email</label>
                <input type="email" id="forgot-email" required placeholder="votre.email@afertes.org">
            </div>
            <button type="submit" class="btn btn-primary btn-block" id="forgot-submit-btn">
                <i class="fas fa-paper-plane"></i> Envoyer le lien
            </button>
        </form>
    `);
}

async function submitForgotPassword(e) {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    const submitBtn = document.getElementById('forgot-submit-btn');

    if (!email) {
        showToast('Veuillez saisir une adresse email', 'error');
        return;
    }

    // Désactiver le bouton pendant la requête
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi en cours...';

    try {
        const response = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        closeModal();

        if (response.ok) {
            showToast('Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.', 'success');
            // En mode démo, afficher le token si disponible
            if (data.demoToken) {
                console.log('Token de démo:', data.demoToken);
                setTimeout(() => {
                    showModal(`
                        <h2><i class="fas fa-info-circle" style="color: var(--primary-color);"></i> Mode Démo</h2>
                        <p style="margin: 16px 0;">
                            En production, un email serait envoyé. Pour tester, utilisez ce token :
                        </p>
                        <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; word-break: break-all; font-family: monospace; font-size: 12px;">
                            ${data.demoToken}
                        </div>
                        <p style="margin-top: 12px; font-size: 13px; color: var(--text-light);">
                            Le lien a été affiché dans la console du serveur.
                        </p>
                        <button onclick="showResetPasswordForm('${data.demoToken}')" class="btn btn-primary btn-block" style="margin-top: 16px;">
                            <i class="fas fa-key"></i> Réinitialiser maintenant
                        </button>
                    `);
                }, 500);
            }
        } else {
            showToast(data.error || 'Erreur lors de l\'envoi', 'error');
        }
    } catch (error) {
        console.error('Erreur forgot-password:', error);
        closeModal();
        showToast('Erreur de connexion au serveur', 'error');
    }
}

function showResetPasswordForm(token) {
    showModal(`
        <h2><i class="fas fa-lock" style="color: var(--primary-color);"></i> Nouveau mot de passe</h2>
        <p style="margin: 16px 0; color: var(--text-light);">
            Choisissez un nouveau mot de passe sécurisé.
        </p>
        <form onsubmit="submitResetPassword(event, '${token}')">
            <div class="form-group">
                <label>Nouveau mot de passe</label>
                <input type="password" id="reset-password" required minlength="8" placeholder="8 caractères minimum">
                <small style="color: var(--text-light);">Au moins 8 caractères, une majuscule, une minuscule et un chiffre</small>
            </div>
            <div class="form-group">
                <label>Confirmer le mot de passe</label>
                <input type="password" id="reset-password-confirm" required placeholder="Confirmez votre mot de passe">
            </div>
            <button type="submit" class="btn btn-primary btn-block" id="reset-submit-btn">
                <i class="fas fa-check"></i> Réinitialiser
            </button>
        </form>
    `);
}

async function submitResetPassword(e, token) {
    e.preventDefault();
    const newPassword = document.getElementById('reset-password').value;
    const confirmPassword = document.getElementById('reset-password-confirm').value;
    const submitBtn = document.getElementById('reset-submit-btn');

    // Validation côté client
    if (newPassword !== confirmPassword) {
        showToast('Les mots de passe ne correspondent pas', 'error');
        return;
    }

    if (newPassword.length < 8) {
        showToast('Le mot de passe doit contenir au moins 8 caractères', 'error');
        return;
    }

    if (!/[A-Z]/.test(newPassword)) {
        showToast('Le mot de passe doit contenir au moins une majuscule', 'error');
        return;
    }

    if (!/[a-z]/.test(newPassword)) {
        showToast('Le mot de passe doit contenir au moins une minuscule', 'error');
        return;
    }

    if (!/[0-9]/.test(newPassword)) {
        showToast('Le mot de passe doit contenir au moins un chiffre', 'error');
        return;
    }

    // Désactiver le bouton pendant la requête
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Réinitialisation...';

    try {
        const response = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, newPassword })
        });

        const data = await response.json();

        closeModal();

        if (response.ok) {
            showToast('Mot de passe réinitialisé avec succès ! Vous pouvez maintenant vous connecter.', 'success');
        } else {
            showToast(data.error || 'Erreur lors de la réinitialisation', 'error');
        }
    } catch (error) {
        console.error('Erreur reset-password:', error);
        closeModal();
        showToast('Erreur de connexion au serveur', 'error');
    }
}

// ===========================================
// Utilitaires - Modal
// ===========================================
function showModal(content) {
    document.getElementById('modal-content').innerHTML = content;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
}

// Fermer le modal en cliquant à l'extérieur
document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-overlay')) {
        closeModal();
    }
});

// ===========================================
// Utilitaires - Toast
// ===========================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        info: 'info-circle'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${icons[type]}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ===========================================
// Utilitaires - Formatage
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

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
}

function getSiteName(site) {
    if (site === 'all') return 'Tous les sites';
    return APP_CONFIG.sites[site]?.name || site;
}

// ===========================================
// Emploi du temps
// ===========================================
let currentWeekStart = getWeekStart(new Date());

function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

function loadSchedule() {
    renderScheduleWeek();
}

function loadDashboardSchedule() {
    const today = new Date();
    const todayStr = today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    
    document.getElementById('today-date').textContent = todayStr;
    
    const scheduleItems = getScheduleForDate(today);
    const container = document.getElementById('today-schedule-items');
    
    if (scheduleItems.length === 0) {
        container.innerHTML = `
            <div class="no-schedule">
                <i class="fas fa-coffee"></i>
                <p>Pas de cours aujourd'hui</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = scheduleItems.map(item => `
        <div class="schedule-item">
            <span class="schedule-item-time">${item.start} - ${item.end}</span>
            <div class="schedule-item-content">
                <div class="schedule-item-title">${item.title}</div>
                <div class="schedule-item-room">${item.room || 'Salle non définie'}</div>
            </div>
            <span class="schedule-item-type ${item.type}">${item.type}</span>
        </div>
    `).join('');
}

function getScheduleForDate(date) {
    const schedules = JSON.parse(localStorage.getItem('afertes_schedules') || '[]');
    const dateStr = date.toISOString().split('T')[0];
    
    return schedules.filter(s => s.date === dateStr && 
        (s.formation === currentUser?.formation || currentUser?.role === 'teacher'));
}

function renderScheduleWeek() {
    const weekDisplay = document.getElementById('week-display');
    const container = document.getElementById('schedule-week');
    
    if (!weekDisplay || !container) return;
    
    const endOfWeek = new Date(currentWeekStart);
    endOfWeek.setDate(endOfWeek.getDate() + 4);
    
    weekDisplay.textContent = `Semaine du ${currentWeekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    
    // Créer la grille de l'emploi du temps
    const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
    const timeSlots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
    
    let html = '<div class="schedule-header"></div>';
    
    // En-têtes des jours
    days.forEach((day, index) => {
        const date = new Date(currentWeekStart);
        date.setDate(date.getDate() + index);
        const dateStr = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        html += `<div class="schedule-header">${day} ${dateStr}</div>`;
    });
    
    // Lignes horaires
    timeSlots.forEach(time => {
        html += `<div class="schedule-time-slot">${time}</div>`;
        
        days.forEach((_, dayIndex) => {
            const date = new Date(currentWeekStart);
            date.setDate(date.getDate() + dayIndex);
            const events = getScheduleForDateAndTime(date, time);
            
            html += '<div class="schedule-cell">';
            events.forEach(event => {
                html += `
                    <div class="schedule-event ${event.type}">
                        <div class="schedule-event-title">${event.title}</div>
                        <div class="schedule-event-room">${event.room || ''}</div>
                    </div>
                `;
            });
            html += '</div>';
        });
    });
    
    container.innerHTML = html;
}

function getScheduleForDateAndTime(date, time) {
    const schedules = JSON.parse(localStorage.getItem('afertes_schedules') || '[]');
    const dateStr = date.toISOString().split('T')[0];
    
    return schedules.filter(s => {
        if (s.date !== dateStr) return false;
        if (s.formation !== currentUser?.formation && currentUser?.role !== 'teacher') return false;
        
        // Vérifier si l'heure correspond
        const eventStart = s.start.split(':')[0];
        const slotStart = time.split(':')[0];
        return eventStart === slotStart;
    });
}

function previousWeek() {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    renderScheduleWeek();
}

function nextWeek() {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    renderScheduleWeek();
}

function goToToday() {
    currentWeekStart = getWeekStart(new Date());
    renderScheduleWeek();
}

// ===========================================
// Notes
// ===========================================
function loadGrades() {
    const grades = getStudentGrades();
    
    // Calculer les statistiques
    if (grades.length > 0) {
        const sum = grades.reduce((acc, g) => acc + g.value, 0);
        const avg = (sum / grades.length).toFixed(2);
        const best = Math.max(...grades.map(g => g.value));
        
        document.getElementById('average-grade').textContent = avg + '/20';
        document.getElementById('total-grades').textContent = grades.length;
        document.getElementById('best-grade').textContent = best + '/20';
    }
    
    renderGradesTable(grades);
}

function getStudentGrades() {
    const allGrades = JSON.parse(localStorage.getItem('afertes_grades') || '[]');
    return allGrades.filter(g => g.studentId === currentUser?.id);
}

function renderGradesTable(grades) {
    const tbody = document.getElementById('grades-tbody');
    if (!tbody) return;
    
    if (grades.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-light);">
                    <i class="fas fa-clipboard" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
                    Aucune note disponible pour le moment
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = grades.map(grade => {
        let gradeClass = 'average';
        if (grade.value >= 16) gradeClass = 'excellent';
        else if (grade.value >= 12) gradeClass = 'good';
        else if (grade.value < 10) gradeClass = 'poor';
        
        return `
            <tr>
                <td><strong>${grade.title}</strong></td>
                <td>${grade.dc.toUpperCase()}</td>
                <td>${new Date(grade.date).toLocaleDateString('fr-FR')}</td>
                <td><span class="grade-value ${gradeClass}">${grade.value}/20</span></td>
                <td>${grade.coefficient}</td>
                <td class="grade-comment">${grade.comment || '-'}</td>
            </tr>
        `;
    }).join('');
}

// ===========================================
// Gestion des notes (Formateurs)
// ===========================================
function initGradeManagement() {
    // Initialiser la date par défaut
    document.getElementById('grade-date').valueAsDate = new Date();
}

function loadStudentsForGrading() {
    const formation = document.getElementById('grade-formation').value;
    const promo = document.getElementById('grade-promo').value;
    const title = document.getElementById('grade-title').value;
    
    if (!formation || !promo || !title) {
        showToast('Veuillez remplir tous les champs obligatoires', 'error');
        return;
    }
    
    // Récupérer les étudiants de la formation/promotion
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const students = users.filter(u => 
        u.role === 'student' && 
        u.formation === formation && 
        u.promo === promo
    );
    
    if (students.length === 0) {
        showToast('Aucun étudiant trouvé pour cette formation/promotion', 'warning');
        return;
    }
    
    document.getElementById('grade-entry-title').textContent = title;
    document.getElementById('grade-entry-card').classList.remove('hidden');
    
    const tbody = document.getElementById('grade-entry-tbody');
    tbody.innerHTML = students.map(student => `
        <tr data-student-id="${student.id}">
            <td>${student.firstName} ${student.lastName}</td>
            <td><input type="number" min="0" max="20" step="0.5" class="student-grade"></td>
            <td><input type="text" class="student-comment" placeholder="Commentaire optionnel"></td>
        </tr>
    `).join('');
}

function cancelGradeEntry() {
    document.getElementById('grade-entry-card').classList.add('hidden');
    document.getElementById('grade-entry-form').reset();
}

function saveGrades() {
    const formation = document.getElementById('grade-formation').value;
    const dc = document.getElementById('grade-dc').value;
    const title = document.getElementById('grade-title').value;
    const date = document.getElementById('grade-date').value;
    const coefficient = parseFloat(document.getElementById('grade-coef').value);
    
    const rows = document.querySelectorAll('#grade-entry-tbody tr');
    const grades = JSON.parse(localStorage.getItem('afertes_grades') || '[]');
    let count = 0;
    
    rows.forEach(row => {
        const studentId = row.dataset.studentId;
        const gradeInput = row.querySelector('.student-grade');
        const commentInput = row.querySelector('.student-comment');
        
        if (gradeInput.value) {
            grades.push({
                id: Date.now() + '-' + studentId,
                studentId: studentId,
                formation: formation,
                dc: dc,
                title: title,
                date: date,
                value: parseFloat(gradeInput.value),
                coefficient: coefficient,
                comment: commentInput.value,
                teacherId: currentUser.id,
                createdAt: new Date().toISOString()
            });
            count++;
        }
    });
    
    localStorage.setItem('afertes_grades', JSON.stringify(grades));
    
    showToast(`${count} notes enregistrées avec succès`, 'success');
    cancelGradeEntry();
}

// ===========================================
// Gestion des emplois du temps (Formateurs)
// ===========================================
function initScheduleManagement() {
    // Initialiser les dates par défaut
    const today = new Date();
    const monday = getWeekStart(today);
    document.getElementById('schedule-week-start').valueAsDate = monday;
    document.getElementById('slot-date').valueAsDate = today;
    
    // Gérer le drag & drop pour le fichier
    const dropZone = document.getElementById('schedule-file-zone');
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            handleScheduleFile(file);
        });
    }
    
    // Gérer la sélection de fichier
    const fileInput = document.getElementById('schedule-file');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                handleScheduleFile(e.target.files[0]);
            }
        });
    }
    
    // Formulaire d'ajout de créneau
    const slotForm = document.getElementById('schedule-slot-form');
    if (slotForm) {
        slotForm.addEventListener('submit', handleAddSlot);
    }
    
    // Formulaire d'upload
    const uploadForm = document.getElementById('schedule-upload-form');
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleScheduleUpload);
    }
}

function handleScheduleFile(file) {
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    
    if (!allowedTypes.includes(file.type)) {
        showToast('Format de fichier non supporté. Utilisez PDF ou Excel.', 'error');
        return;
    }
    
    document.getElementById('schedule-file-name').textContent = file.name;
}

function handleScheduleUpload(e) {
    e.preventDefault();
    
    const formation = document.getElementById('schedule-formation').value;
    const promo = document.getElementById('schedule-promo-upload').value;
    const fileName = document.getElementById('schedule-file-name').textContent;
    
    if (!formation || !promo) {
        showToast('Veuillez sélectionner une formation et une promotion', 'error');
        return;
    }
    
    if (!fileName) {
        showToast('Veuillez sélectionner un fichier', 'error');
        return;
    }
    
    // Simulation de l'upload (en réalité, il faudrait un backend)
    showToast('Emploi du temps publié avec succès', 'success');
    e.target.reset();
    document.getElementById('schedule-file-name').textContent = '';
}

function handleAddSlot(e) {
    e.preventDefault();
    
    const date = document.getElementById('slot-date').value;
    const start = document.getElementById('slot-start').value;
    const end = document.getElementById('slot-end').value;
    const title = document.getElementById('slot-title').value;
    const room = document.getElementById('slot-room').value;
    const type = document.getElementById('slot-type').value;
    
    const schedules = JSON.parse(localStorage.getItem('afertes_schedules') || '[]');
    
    schedules.push({
        id: Date.now(),
        date: date,
        start: start,
        end: end,
        title: title,
        room: room,
        type: type,
        formation: currentUser?.formationsTaught?.[0] || 'es',
        site: currentUser?.site || 'slb',
        createdBy: currentUser?.id,
        createdAt: new Date().toISOString()
    });
    
    localStorage.setItem('afertes_schedules', JSON.stringify(schedules));
    
    showToast('Créneau ajouté avec succès', 'success');
    e.target.reset();
    document.getElementById('slot-date').valueAsDate = new Date();
}

// ===========================================
// FONCTIONS ADMINISTRATION (SECRÉTAIRES)
// ===========================================

function loadAdminStudents() {
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const students = users.filter(u => u.role === 'student' || u.role === 'bde');
    const tbody = document.getElementById('admin-students-tbody');
    if (!tbody) return;

    const formationFilter = document.getElementById('admin-student-formation')?.value || '';
    const promoFilter = document.getElementById('admin-student-promo')?.value || '';
    const searchFilter = document.getElementById('admin-student-search')?.value?.toLowerCase() || '';

    let filtered = students;
    if (formationFilter) filtered = filtered.filter(s => s.formation === formationFilter);
    if (promoFilter) filtered = filtered.filter(s => s.promo === promoFilter);
    if (searchFilter) filtered = filtered.filter(s =>
        s.firstname.toLowerCase().includes(searchFilter) ||
        s.lastname.toLowerCase().includes(searchFilter) ||
        s.email.toLowerCase().includes(searchFilter)
    );

    tbody.innerHTML = filtered.map(student => `
        <tr>
            <td><input type="checkbox" data-id="${student.id}"></td>
            <td>${student.lastname}</td>
            <td>${student.firstname}</td>
            <td>${student.email}</td>
            <td>${(student.formation || '').toUpperCase()}</td>
            <td>${student.promo || '-'}</td>
            <td>${student.site === 'slb' ? 'Saint-Laurent-Blangy' : 'Avion'}</td>
            <td>
                <button class="action-btn" onclick="editStudent(${student.id})" title="Modifier">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn" onclick="viewStudentProfile(${student.id})" title="Voir profil">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="action-btn danger" onclick="deleteStudent(${student.id})" title="Supprimer">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function showAddStudentModal() {
    initPromosData();
    const modalContent = `
        <h2>Ajouter un étudiant</h2>
        <form id="add-student-form" onsubmit="addStudent(event)">
            <div class="form-row">
                <div class="form-group">
                    <label>Nom *</label>
                    <input type="text" id="new-student-lastname" required>
                </div>
                <div class="form-group">
                    <label>Prénom *</label>
                    <input type="text" id="new-student-firstname" required>
                </div>
            </div>
            <div class="form-group">
                <label>Email *</label>
                <input type="email" id="new-student-email" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Formation *</label>
                    <select id="new-student-formation" required onchange="refreshPromoSelector('new-student-promo', this.value)">
                        <option value="">Sélectionner</option>
                        <option value="es">ES - Éducateur Spécialisé</option>
                        <option value="me">ME - Moniteur Éducateur</option>
                        <option value="aes">AES - Accompagnant Éducatif et Social</option>
                        <option value="caferuis">CAFERUIS</option>
                        <option value="cafdes">CAFDES</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Promotion *</label>
                    <select id="new-student-promo" required>
                        <option value="">Sélectionner d'abord une formation</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Site *</label>
                <select id="new-student-site" required>
                    <option value="slb">Saint-Laurent-Blangy</option>
                    <option value="avion">Avion</option>
                </select>
            </div>
            <button type="submit" class="btn btn-primary btn-block">
                <i class="fas fa-user-plus"></i> Ajouter
            </button>
        </form>
    `;
    document.getElementById('modal-content').innerHTML = modalContent;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

function addStudent(e) {
    e.preventDefault();
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const newStudent = {
        id: Date.now(),
        firstname: document.getElementById('new-student-firstname').value,
        lastname: document.getElementById('new-student-lastname').value,
        email: document.getElementById('new-student-email').value,
        password: 'afertes2024',
        role: 'student',
        formation: document.getElementById('new-student-formation').value,
        promo: document.getElementById('new-student-promo').value,
        site: document.getElementById('new-student-site').value,
        status: 'active',
        avatar: 'img/default-avatar.svg',
        bio: '',
        privacy: { directory: true, email: true, photo: true }
    };
    users.push(newStudent);
    localStorage.setItem('afertes_users', JSON.stringify(users));
    closeModal();
    loadAdminStudentsEnhanced();
    showToast('Étudiant ajouté avec succès', 'success');
}

function editStudent(id) {
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const student = users.find(u => u.id === id);
    if (!student) return;

    const modalContent = `
        <h2>Modifier l'étudiant</h2>
        <form id="edit-student-form" onsubmit="saveStudentEdit(event, ${id})">
            <div class="form-row">
                <div class="form-group">
                    <label>Nom</label>
                    <input type="text" id="edit-lastname" value="${student.lastname}" required>
                </div>
                <div class="form-group">
                    <label>Prénom</label>
                    <input type="text" id="edit-firstname" value="${student.firstname}" required>
                </div>
            </div>
            <div class="form-group">
                <label>Email</label>
                <input type="email" id="edit-email" value="${student.email}" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Formation</label>
                    <select id="edit-formation">
                        <option value="es" ${student.formation === 'es' ? 'selected' : ''}>ES</option>
                        <option value="me" ${student.formation === 'me' ? 'selected' : ''}>ME</option>
                        <option value="aes" ${student.formation === 'aes' ? 'selected' : ''}>AES</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Promotion</label>
                    <select id="edit-promo">
                        <option value="2023-2026" ${student.promo === '2023-2026' ? 'selected' : ''}>2023-2026</option>
                        <option value="2024-2027" ${student.promo === '2024-2027' ? 'selected' : ''}>2024-2027</option>
                        <option value="2025-2028" ${student.promo === '2025-2028' ? 'selected' : ''}>2025-2028</option>
                    </select>
                </div>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Enregistrer</button>
        </form>
    `;
    document.getElementById('modal-content').innerHTML = modalContent;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

function saveStudentEdit(e, id) {
    e.preventDefault();
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return;

    users[idx].lastname = document.getElementById('edit-lastname').value;
    users[idx].firstname = document.getElementById('edit-firstname').value;
    users[idx].email = document.getElementById('edit-email').value;
    users[idx].formation = document.getElementById('edit-formation').value;
    users[idx].promo = document.getElementById('edit-promo').value;

    localStorage.setItem('afertes_users', JSON.stringify(users));
    closeModal();
    loadAdminStudentsEnhanced();
    showToast('Étudiant modifié avec succès', 'success');
}

function deleteStudent(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet étudiant ?')) return;
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const filtered = users.filter(u => u.id !== id);
    localStorage.setItem('afertes_users', JSON.stringify(filtered));
    loadAdminStudentsEnhanced();
    showToast('Étudiant supprimé', 'success');
}

function viewStudentProfile(id) {
    viewProfile(id);
}

function exportStudentsList() {
    // Vérifier si l'utilisateur a le droit d'exporter (secrétaire ou formateur)
    if (!currentUser || !['secretary', 'teacher', 'admin'].includes(currentUser.role)) {
        showToast('Vous n\'avez pas les droits pour effectuer cette action', 'error');
        return;
    }

    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const students = users.filter(u => u.role === 'student');

    if (students.length === 0) {
        showToast('Aucun étudiant à exporter', 'warning');
        return;
    }

    // Préparer les données pour l'export Excel
    const exportData = students.map(s => ({
        'Nom': s.lastname || '',
        'Prénom': s.firstname || '',
        'Email': s.email || '',
        'Téléphone': s.phone || '',
        'Date de naissance': s.birthdate ? formatDateFR(s.birthdate) : '',
        'N° Sécurité Sociale': s.socialSecurity || '',
        'Adresse': s.address || '',
        'Code Postal': s.postalCode || '',
        'Ville': s.city || '',
        'Formation': APP_CONFIG.formations[s.formation] || s.formation?.toUpperCase() || '',
        'Promotion': s.promo ? `${s.promo}-${parseInt(s.promo) + 3}` : '',
        'Site': s.site === 'slb' ? 'Saint-Laurent-Blangy' : s.site === 'avion' ? 'Avion' : s.site || '',
        'Profil complété': s.profileCompleted ? 'Oui' : 'Non',
        'Date inscription': s.createdAt ? formatDateFR(s.createdAt.split('T')[0]) : '',
        'Consentement RGPD': s.rgpdConsentDate ? formatDateFR(s.rgpdConsentDate.split('T')[0]) : ''
    }));

    // Créer le workbook Excel avec SheetJS
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Ajuster la largeur des colonnes
    const colWidths = [
        { wch: 15 }, // Nom
        { wch: 15 }, // Prénom
        { wch: 30 }, // Email
        { wch: 15 }, // Téléphone
        { wch: 15 }, // Date de naissance
        { wch: 18 }, // N° Sécu
        { wch: 35 }, // Adresse
        { wch: 12 }, // Code Postal
        { wch: 20 }, // Ville
        { wch: 25 }, // Formation
        { wch: 15 }, // Promotion
        { wch: 20 }, // Site
        { wch: 15 }, // Profil complété
        { wch: 15 }, // Date inscription
        { wch: 18 }  // Consentement RGPD
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Étudiants');

    // Générer le fichier et télécharger
    const filename = `etudiants_afertes_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);

    showToast(`Export Excel effectué (${students.length} étudiants)`, 'success');
}

// Fonction pour formater une date en français
function formatDateFR(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

function loadAdminGrades() {
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const grades = JSON.parse(localStorage.getItem('afertes_grades') || '[]');
    const students = users.filter(u => u.role === 'student');
    const tbody = document.getElementById('admin-grades-tbody');
    if (!tbody) return;

    tbody.innerHTML = students.map(student => {
        const studentGrades = grades.filter(g => g.userId === student.id);
        const dcGrades = { dc1: [], dc2: [], dc3: [], dc4: [] };
        studentGrades.forEach(g => {
            if (dcGrades[g.dc]) dcGrades[g.dc].push(g.value);
        });
        const avg = (arr) => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : '-';
        const totalAvg = [...dcGrades.dc1, ...dcGrades.dc2, ...dcGrades.dc3, ...dcGrades.dc4];
        return `
            <tr>
                <td>${student.lastname} ${student.firstname}</td>
                <td>${(student.formation || '').toUpperCase()}</td>
                <td>${avg(dcGrades.dc1)}</td>
                <td>${avg(dcGrades.dc2)}</td>
                <td>${avg(dcGrades.dc3)}</td>
                <td>${avg(dcGrades.dc4)}</td>
                <td><strong>${totalAvg.length ? (totalAvg.reduce((a, b) => a + b, 0) / totalAvg.length).toFixed(1) : '-'}</strong></td>
                <td>
                    <button class="action-btn" onclick="viewStudentGrades(${student.id})" title="Détails">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn" onclick="generateStudentBulletin(${student.id})" title="Télécharger PDF">
                        <i class="fas fa-file-pdf"></i>
                    </button>
                    <button class="action-btn" onclick="sendBulletinByEmail(${student.id})" title="Envoyer par email">
                        <i class="fas fa-envelope"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function viewStudentGrades(studentId) {
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const grades = JSON.parse(localStorage.getItem('afertes_grades') || '[]');
    const student = users.find(u => u.id === studentId);
    const studentGrades = grades.filter(g => g.userId === studentId);

    const modalContent = `
        <h2>Notes de ${student.firstname} ${student.lastname}</h2>
        <table class="grades-table">
            <thead>
                <tr><th>Matière</th><th>DC</th><th>Note</th><th>Date</th><th>Commentaire</th></tr>
            </thead>
            <tbody>
                ${studentGrades.map(g => `
                    <tr>
                        <td>${g.subject}</td>
                        <td>${g.dc.toUpperCase()}</td>
                        <td><span class="grade-value ${getGradeClass(g.value)}">${g.value}/20</span></td>
                        <td>${formatDate(g.date)}</td>
                        <td>${g.comment || '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    document.getElementById('modal-content').innerHTML = modalContent;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

async function generateStudentBulletin(studentId, download = true) {
    const { jsPDF } = window.jspdf;
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const grades = JSON.parse(localStorage.getItem('afertes_grades') || '[]');
    const student = users.find(u => u.id === studentId);

    if (!student) {
        showToast('Étudiant non trouvé', 'error');
        return null;
    }

    // Charger le logo
    const logoData = await loadLogoBase64();

    const studentGrades = grades.filter(g => g.userId === studentId);

    // Créer le PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // En-tête avec logo
    doc.setFillColor(37, 54, 114);
    doc.rect(0, 0, pageWidth, 45, 'F');

    // Logo AFERTES
    if (logoData) {
        try {
            doc.addImage(logoData, 'PNG', 15, 6, 32, 32);
        } catch (e) {
            console.log('Erreur logo bulletin:', e);
        }
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('AFERTES', pageWidth / 2 + 10, 18, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Institut Régional du Travail Social - Hauts-de-France', pageWidth / 2 + 10, 28, { align: 'center' });
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('BULLETIN DE NOTES', pageWidth / 2 + 10, 40, { align: 'center' });

    // Informations étudiant
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    const formationNames = {
        'es': 'Éducateur Spécialisé',
        'me': 'Moniteur Éducateur',
        'aes': 'Accompagnant Éducatif et Social',
        'caferuis': 'CAFERUIS',
        'cafdes': 'CAFDES'
    };

    let y = 60;
    doc.setFont('helvetica', 'bold');
    doc.text('Étudiant:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`${student.firstname} ${student.lastname}`, 55, y);

    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Formation:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(formationNames[student.formation] || student.formation?.toUpperCase() || '-', 55, y);

    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Promotion:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(student.promo || '-', 55, y);

    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Site:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(student.site === 'slb' ? 'Saint-Laurent-Blangy' : 'Avion', 55, y);

    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleDateString('fr-FR'), 55, y);

    // Tableau des notes par DC
    y += 15;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Détail des notes', 20, y);

    // Préparer les données du tableau
    const dcNames = {
        'dc1': 'DC1 - Accompagnement social et éducatif',
        'dc2': 'DC2 - Conception et conduite de projet',
        'dc3': 'DC3 - Communication professionnelle',
        'dc4': 'DC4 - Dynamiques interinstitutionnelles'
    };

    const tableData = studentGrades.map(g => [
        g.subject || '-',
        dcNames[g.dc] || g.dc?.toUpperCase() || '-',
        `${g.value}/20`,
        formatDate(g.date),
        g.comment || '-'
    ]);

    if (tableData.length > 0) {
        doc.autoTable({
            startY: y + 5,
            head: [['Matière', 'Domaine', 'Note', 'Date', 'Commentaire']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [0, 51, 102], textColor: 255 },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 35 },
                1: { cellWidth: 55 },
                2: { cellWidth: 20 },
                3: { cellWidth: 25 },
                4: { cellWidth: 45 }
            }
        });

        y = doc.lastAutoTable.finalY + 15;
    } else {
        y += 10;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(11);
        doc.text('Aucune note enregistrée pour cet étudiant.', 20, y);
        y += 15;
    }

    // Moyennes par DC
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Récapitulatif des moyennes', 20, y);

    const dcGrades = { dc1: [], dc2: [], dc3: [], dc4: [] };
    studentGrades.forEach(g => {
        if (dcGrades[g.dc]) dcGrades[g.dc].push(g.value);
    });

    const avgCalc = arr => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : '-';

    const avgData = [
        ['DC1 - Accompagnement', avgCalc(dcGrades.dc1)],
        ['DC2 - Projet éducatif', avgCalc(dcGrades.dc2)],
        ['DC3 - Communication', avgCalc(dcGrades.dc3)],
        ['DC4 - Partenariats', avgCalc(dcGrades.dc4)]
    ];

    const allGrades = [...dcGrades.dc1, ...dcGrades.dc2, ...dcGrades.dc3, ...dcGrades.dc4];
    const generalAvg = avgCalc(allGrades);

    doc.autoTable({
        startY: y + 5,
        head: [['Domaine de compétence', 'Moyenne']],
        body: avgData,
        foot: [['Moyenne générale', generalAvg]],
        theme: 'grid',
        headStyles: { fillColor: [0, 51, 102], textColor: 255 },
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 51, 102], fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: {
            0: { cellWidth: 100 },
            1: { cellWidth: 40, halign: 'center' }
        }
    });

    // Pied de page
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(128, 128, 128);
    doc.text('Document généré automatiquement par AFERTES Connect', pageWidth / 2, pageHeight - 15, { align: 'center' });
    doc.text(`© ${new Date().getFullYear()} AFERTES - Institut Régional du Travail Social`, pageWidth / 2, pageHeight - 10, { align: 'center' });

    if (download) {
        const filename = `bulletin_${student.lastname}_${student.firstname}_${new Date().toISOString().slice(0, 10)}.pdf`;
        doc.save(filename);
        showToast('Bulletin téléchargé', 'success');
    }

    return { doc, student };
}

function generateBulletins() {
    const formationFilter = document.getElementById('admin-grade-formation')?.value || '';
    const promoFilter = document.getElementById('admin-grade-promo')?.value || '';

    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    let students = users.filter(u => u.role === 'student');

    if (formationFilter) students = students.filter(s => s.formation === formationFilter);
    if (promoFilter) students = students.filter(s => s.promo === promoFilter);

    if (students.length === 0) {
        showToast('Aucun étudiant trouvé', 'error');
        return;
    }

    showToast(`Génération de ${students.length} bulletin(s)...`, 'info');

    students.forEach((student, index) => {
        setTimeout(() => {
            generateStudentBulletin(student.id, true);
        }, index * 500);
    });
}

function exportGradesList() {
    // Vérifier les droits
    if (!currentUser || !['secretary', 'teacher', 'admin'].includes(currentUser.role)) {
        showToast('Vous n\'avez pas les droits pour effectuer cette action', 'error');
        return;
    }

    const formationFilter = document.getElementById('admin-grade-formation')?.value || '';
    const promoFilter = document.getElementById('admin-grade-promo')?.value || '';

    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const grades = JSON.parse(localStorage.getItem('afertes_grades') || '[]');

    let students = users.filter(u => u.role === 'student');
    if (formationFilter) students = students.filter(s => s.formation === formationFilter);
    if (promoFilter) students = students.filter(s => s.promo === promoFilter);

    // Préparer les données pour l'export Excel
    const exportData = [];
    students.forEach(student => {
        const studentGrades = grades.filter(g => g.userId === student.id);
        studentGrades.forEach(g => {
            exportData.push({
                'Nom': student.lastname || '',
                'Prénom': student.firstname || '',
                'Formation': APP_CONFIG.formations[student.formation] || student.formation?.toUpperCase() || '',
                'Promotion': student.promo ? `${student.promo}-${parseInt(student.promo) + 3}` : '',
                'Matière': g.subject || '',
                'DC': g.dc || '',
                'Note': g.value,
                'Coefficient': g.coefficient || 1,
                'Date': g.date ? formatDateFR(g.date) : '',
                'Commentaire': g.comment || ''
            });
        });
    });

    if (exportData.length === 0) {
        showToast('Aucune note à exporter', 'warning');
        return;
    }

    // Créer le workbook Excel
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Ajuster la largeur des colonnes
    ws['!cols'] = [
        { wch: 15 }, // Nom
        { wch: 15 }, // Prénom
        { wch: 25 }, // Formation
        { wch: 12 }, // Promotion
        { wch: 25 }, // Matière
        { wch: 10 }, // DC
        { wch: 8 },  // Note
        { wch: 12 }, // Coefficient
        { wch: 12 }, // Date
        { wch: 40 }  // Commentaire
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Notes');

    // Télécharger
    const filename = `notes_afertes_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);

    showToast(`Export Excel effectué (${exportData.length} notes)`, 'success');
}

async function sendBulletinByEmail(studentId) {
    const result = await generateStudentBulletin(studentId, false);
    if (!result) return;

    const { doc, student } = result;

    // Générer le PDF en base64 pour le téléchargement
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);

    // Ouvrir le modal d'envoi d'email
    const modalContent = `
        <h2><i class="fas fa-envelope" style="color: var(--primary-color);"></i> Envoyer le bulletin par email</h2>
        <div class="email-preview">
            <div class="form-group">
                <label>Destinataire</label>
                <input type="email" id="email-recipient" value="${student.email}" required>
            </div>
            <div class="form-group">
                <label>Objet</label>
                <input type="text" id="email-subject" value="Bulletin de notes - ${student.firstname} ${student.lastname}" required>
            </div>
            <div class="form-group">
                <label>Message</label>
                <textarea id="email-body" rows="6">Bonjour ${student.firstname},

Veuillez trouver ci-joint votre bulletin de notes.

Cordialement,
L'équipe pédagogique AFERTES</textarea>
            </div>
            <div class="form-group">
                <label><i class="fas fa-paperclip"></i> Pièce jointe</label>
                <div class="attachment-preview">
                    <i class="fas fa-file-pdf"></i>
                    <span>bulletin_${student.lastname}_${student.firstname}.pdf</span>
                    <a href="${pdfUrl}" download="bulletin_${student.lastname}_${student.firstname}.pdf" class="btn btn-sm">
                        <i class="fas fa-download"></i> Télécharger
                    </a>
                </div>
            </div>
            <div class="email-actions">
                <button type="button" class="btn btn-primary" onclick="openMailClient('${student.email}', '${student.firstname}', '${student.lastname}')">
                    <i class="fas fa-paper-plane"></i> Ouvrir dans l'application mail
                </button>
                <button type="button" class="btn btn-secondary" onclick="copyEmailContent()">
                    <i class="fas fa-copy"></i> Copier le message
                </button>
            </div>
            <p class="email-note">
                <i class="fas fa-info-circle"></i>
                Téléchargez le PDF puis joignez-le manuellement à votre email.
            </p>
        </div>
    `;

    document.getElementById('modal-content').innerHTML = modalContent;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

function openMailClient(email, firstname, lastname) {
    const subject = document.getElementById('email-subject').value;
    const body = document.getElementById('email-body').value;

    const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink);

    showToast('Application mail ouverte', 'info');
}

function copyEmailContent() {
    const body = document.getElementById('email-body').value;
    navigator.clipboard.writeText(body).then(() => {
        showToast('Message copié dans le presse-papier', 'success');
    });
}

function sendBulletinsToPromo() {
    const formationFilter = document.getElementById('admin-grade-formation')?.value || '';
    const promoFilter = document.getElementById('admin-grade-promo')?.value || '';

    if (!promoFilter) {
        showToast('Veuillez sélectionner une promotion', 'error');
        return;
    }

    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    let students = users.filter(u => u.role === 'student');

    if (formationFilter) students = students.filter(s => s.formation === formationFilter);
    if (promoFilter) students = students.filter(s => s.promo === promoFilter);

    if (students.length === 0) {
        showToast('Aucun étudiant trouvé', 'error');
        return;
    }

    // Afficher la liste des étudiants pour envoi groupé
    const modalContent = `
        <h2><i class="fas fa-mail-bulk" style="color: var(--primary-color);"></i> Envoi groupé des bulletins</h2>
        <p>Promo: <strong>${promoFilter}</strong> - ${students.length} étudiant(s)</p>
        <div class="bulk-email-list">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th><input type="checkbox" id="select-all-emails" checked onchange="toggleAllEmails(this)"></th>
                        <th>Étudiant</th>
                        <th>Email</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${students.map(s => `
                        <tr>
                            <td><input type="checkbox" class="email-checkbox" data-id="${s.id}" checked></td>
                            <td>${s.firstname} ${s.lastname}</td>
                            <td>${s.email}</td>
                            <td>
                                <button class="action-btn" onclick="sendBulletinByEmail(${s.id})" title="Envoyer">
                                    <i class="fas fa-envelope"></i>
                                </button>
                                <button class="action-btn" onclick="generateStudentBulletin(${s.id})" title="Télécharger PDF">
                                    <i class="fas fa-download"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <div class="bulk-actions" style="margin-top: 16px;">
            <button class="btn btn-primary" onclick="downloadAllBulletins()">
                <i class="fas fa-file-archive"></i> Télécharger tous les PDF
            </button>
            <button class="btn btn-secondary" onclick="exportEmailList()">
                <i class="fas fa-list"></i> Exporter liste emails
            </button>
        </div>
    `;

    document.getElementById('modal-content').innerHTML = modalContent;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

function toggleAllEmails(checkbox) {
    document.querySelectorAll('.email-checkbox').forEach(cb => {
        cb.checked = checkbox.checked;
    });
}

function downloadAllBulletins() {
    const checkboxes = document.querySelectorAll('.email-checkbox:checked');
    const ids = Array.from(checkboxes).map(cb => parseInt(cb.dataset.id));

    if (ids.length === 0) {
        showToast('Aucun étudiant sélectionné', 'error');
        return;
    }

    showToast(`Téléchargement de ${ids.length} bulletin(s)...`, 'info');

    ids.forEach((id, index) => {
        setTimeout(() => {
            generateStudentBulletin(id, true);
        }, index * 500);
    });
}

function exportEmailList() {
    const checkboxes = document.querySelectorAll('.email-checkbox:checked');
    const ids = Array.from(checkboxes).map(cb => parseInt(cb.dataset.id));

    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const selectedStudents = users.filter(u => ids.includes(u.id));

    const emailList = selectedStudents.map(s => `${s.firstname} ${s.lastname} <${s.email}>`).join('\n');

    navigator.clipboard.writeText(emailList).then(() => {
        showToast('Liste des emails copiée', 'success');
    });
}

// Admin Schedule Functions
function loadAdminScheduleTeachers() {
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const teachers = users.filter(u => u.role === 'teacher');
    const select = document.getElementById('admin-sched-teacher');
    if (!select) return;

    select.innerHTML = '<option value="">Sélectionner un formateur</option>' +
        teachers.map(t => `<option value="${t.id}">${t.firstname} ${t.lastname}</option>`).join('');
}

function handleAdminScheduleForm(e) {
    e.preventDefault();
    const schedules = JSON.parse(localStorage.getItem('afertes_schedules') || '[]');

    schedules.push({
        id: Date.now(),
        formation: document.getElementById('admin-sched-formation').value,
        promo: document.getElementById('admin-sched-promo').value,
        date: document.getElementById('admin-sched-date').value,
        start: document.getElementById('admin-sched-start').value,
        end: document.getElementById('admin-sched-end').value,
        title: document.getElementById('admin-sched-title').value,
        room: document.getElementById('admin-sched-room').value,
        teacher: document.getElementById('admin-sched-teacher').value,
        type: document.getElementById('admin-sched-type').value,
        site: currentUser?.site || 'slb',
        createdBy: currentUser?.id,
        createdAt: new Date().toISOString()
    });

    localStorage.setItem('afertes_schedules', JSON.stringify(schedules));
    showToast('Créneau ajouté avec succès', 'success');
    e.target.reset();
}

function importScheduleFile() {
    const file = document.getElementById('admin-schedule-file').files[0];
    if (!file) {
        showToast('Veuillez sélectionner un fichier', 'error');
        return;
    }
    showToast('Import en cours...', 'info');
    setTimeout(() => {
        showToast('Emploi du temps importé avec succès', 'success');
    }, 1500);
}

// ===========================================
// FONCTIONS BDE
// ===========================================

function loadBDEEventsManage() {
    const events = JSON.parse(localStorage.getItem('afertes_bde_events') || '[]');
    const container = document.getElementById('bde-events-manage-list');
    if (!container) return;

    if (events.length === 0) {
        container.innerHTML = '<p class="text-muted">Aucun événement créé</p>';
        return;
    }

    container.innerHTML = events.map(event => `
        <div class="bde-event-item">
            <h4>${event.title}</h4>
            <div class="event-meta">
                <i class="fas fa-calendar"></i> ${formatDate(event.date)}
                <i class="fas fa-map-marker-alt" style="margin-left: 12px;"></i> ${event.location}
            </div>
            <div class="event-actions">
                <button class="btn btn-secondary" onclick="editBDEEvent(${event.id})">
                    <i class="fas fa-edit"></i> Modifier
                </button>
                <button class="btn btn-danger" onclick="deleteBDEEvent(${event.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function createBDEEvent(e) {
    e.preventDefault();
    const events = JSON.parse(localStorage.getItem('afertes_bde_events') || '[]');

    events.push({
        id: Date.now(),
        title: document.getElementById('bde-event-title').value,
        description: document.getElementById('bde-event-desc').value,
        date: document.getElementById('bde-event-date').value,
        location: document.getElementById('bde-event-location').value,
        places: document.getElementById('bde-event-places').value || null,
        price: document.getElementById('bde-event-price').value || 0,
        createdBy: currentUser?.id,
        createdAt: new Date().toISOString()
    });

    localStorage.setItem('afertes_bde_events', JSON.stringify(events));
    showToast('Événement créé avec succès', 'success');
    e.target.reset();
    loadBDEEventsManage();
}

function editBDEEvent(id) {
    const events = JSON.parse(localStorage.getItem('afertes_bde_events') || '[]');
    const event = events.find(e => e.id === id);
    if (!event) return;

    document.getElementById('bde-event-title').value = event.title;
    document.getElementById('bde-event-desc').value = event.description;
    document.getElementById('bde-event-date').value = event.date;
    document.getElementById('bde-event-location').value = event.location;
    document.getElementById('bde-event-places').value = event.places || '';
    document.getElementById('bde-event-price').value = event.price || '';

    deleteBDEEvent(id, true);
}

function deleteBDEEvent(id, silent = false) {
    if (!silent && !confirm('Supprimer cet événement ?')) return;
    const events = JSON.parse(localStorage.getItem('afertes_bde_events') || '[]');
    const filtered = events.filter(e => e.id !== id);
    localStorage.setItem('afertes_bde_events', JSON.stringify(filtered));
    if (!silent) showToast('Événement supprimé', 'success');
    loadBDEEventsManage();
}

function loadBDEMembers() {
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const bdeMembers = users.filter(u => u.role === 'bde');
    const container = document.getElementById('bde-members-grid');
    if (!container) return;

    if (bdeMembers.length === 0) {
        container.innerHTML = '<p>Aucun membre BDE</p>';
        return;
    }

    container.innerHTML = bdeMembers.map(member => `
        <div class="bde-member-card">
            <span class="role-tag">Membre</span>
            <img src="${member.avatar}" alt="${member.firstname}" class="member-avatar">
            <h3>${member.firstname} ${member.lastname}</h3>
            <p>${member.formation?.toUpperCase() || ''} ${member.promo || ''}</p>
        </div>
    `).join('');
}

function showAddBDEMemberModal() {
    showToast('Fonctionnalité en cours de développement', 'info');
}

// ===========================================
// ESPACE DE STOCKAGE (DRIVE)
// ===========================================

let currentDrivePath = '/';
let driveViewMode = 'grid';
const MAX_STORAGE = 1024 * 1024 * 1024; // 1 Go

function initDrive() {
    if (!localStorage.getItem('afertes_drive_' + currentUser?.id)) {
        localStorage.setItem('afertes_drive_' + currentUser?.id, JSON.stringify({
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
    const driveData = JSON.parse(localStorage.getItem('afertes_drive_' + currentUser?.id) || '{}');
    const container = document.getElementById('drive-content');
    if (!container) return;

    const folders = (driveData.folders || []).filter(f => f.path === currentDrivePath);
    const files = (driveData.files || []).filter(f => f.path === currentDrivePath);

    container.className = `drive-content ${driveViewMode}-view`;

    if (folders.length === 0 && files.length === 0) {
        container.innerHTML = `
            <div class="drive-empty">
                <i class="fas fa-folder-open"></i>
                <p>Ce dossier est vide</p>
            </div>
        `;
        return;
    }

    let html = '';

    folders.forEach(folder => {
        html += `
            <div class="drive-item" ondblclick="navigateDrive('${currentDrivePath}${folder.name}/')" oncontextmenu="showDriveMenu(event, 'folder', ${folder.id})">
                <i class="fas fa-folder icon folder"></i>
                <div class="name">${folder.name}</div>
            </div>
        `;
    });

    files.forEach(file => {
        const iconClass = getFileIcon(file.name);
        html += `
            <div class="drive-item" ondblclick="previewFile(${file.id})" oncontextmenu="showDriveMenu(event, 'file', ${file.id})">
                <i class="fas ${iconClass} icon"></i>
                <div class="name">${file.name}</div>
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
    let html = `<span class="breadcrumb-item" onclick="navigateDrive('/')"><i class="fas fa-home"></i> Mon Drive</span>`;

    let path = '/';
    parts.forEach(part => {
        path += part + '/';
        html += `<span class="breadcrumb-item" onclick="navigateDrive('${path}')">${part}</span>`;
    });

    breadcrumb.innerHTML = html;
}

function updateDriveQuota() {
    const driveData = JSON.parse(localStorage.getItem('afertes_drive_' + currentUser?.id) || '{}');
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
    document.querySelector(`.view-btn:${mode === 'grid' ? 'first' : 'last'}-child`)?.classList.add('active');
    loadDriveContent();
}

function uploadFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e) => {
        const files = e.target.files;
        if (!files.length) return;

        const driveData = JSON.parse(localStorage.getItem('afertes_drive_' + currentUser?.id) || '{}');
        if (!driveData.files) driveData.files = [];

        Array.from(files).forEach(file => {
            if (driveData.usedStorage + file.size > MAX_STORAGE) {
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

        localStorage.setItem('afertes_drive_' + currentUser?.id, JSON.stringify(driveData));
        loadDriveContent();
        updateDriveQuota();
        showToast('Fichier(s) importé(s)', 'success');
    };
    input.click();
}

function createFolder() {
    const name = prompt('Nom du dossier:');
    if (!name) return;

    const driveData = JSON.parse(localStorage.getItem('afertes_drive_' + currentUser?.id) || '{}');
    if (!driveData.folders) driveData.folders = [];

    driveData.folders.push({
        id: Date.now(),
        name: name,
        path: currentDrivePath,
        createdAt: new Date().toISOString()
    });

    localStorage.setItem('afertes_drive_' + currentUser?.id, JSON.stringify(driveData));
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
        <button onclick="renameItem('${type}', ${id})"><i class="fas fa-edit"></i> Renommer</button>
        ${type === 'file' ? '<button onclick="downloadItem(' + id + ')"><i class="fas fa-download"></i> Télécharger</button>' : ''}
        <button onclick="shareItem('${type}', ${id})"><i class="fas fa-share"></i> Partager</button>
        <button class="danger" onclick="deleteItem('${type}', ${id})"><i class="fas fa-trash"></i> Supprimer</button>
    `;

    document.body.appendChild(menu);

    setTimeout(() => {
        document.addEventListener('click', () => menu.remove(), { once: true });
    }, 100);
}

function deleteItem(type, id) {
    if (!confirm('Supprimer cet élément ?')) return;

    const driveData = JSON.parse(localStorage.getItem('afertes_drive_' + currentUser?.id) || '{}');

    if (type === 'folder') {
        driveData.folders = driveData.folders.filter(f => f.id !== id);
    } else {
        const file = driveData.files.find(f => f.id === id);
        if (file) driveData.usedStorage -= file.size;
        driveData.files = driveData.files.filter(f => f.id !== id);
    }

    localStorage.setItem('afertes_drive_' + currentUser?.id, JSON.stringify(driveData));
    loadDriveContent();
    updateDriveQuota();
    showToast('Élément supprimé', 'success');
}

function renameItem(type, id) {
    const driveData = JSON.parse(localStorage.getItem('afertes_drive_' + currentUser?.id) || '{}');
    const items = type === 'folder' ? driveData.folders : driveData.files;
    const item = items.find(i => i.id === id);
    if (!item) return;

    const newName = prompt('Nouveau nom:', item.name);
    if (!newName) return;

    item.name = newName;
    localStorage.setItem('afertes_drive_' + currentUser?.id, JSON.stringify(driveData));
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
    const ext = filename.split('.').pop().toLowerCase();
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

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' Go';
}

// ===========================================
// MESSAGERIE DE GROUPE
// ===========================================

function initGroupMessages() {
    if (!localStorage.getItem('afertes_groups')) {
        localStorage.setItem('afertes_groups', JSON.stringify([
            {
                id: 1,
                name: 'Promo ES 2024-2027',
                type: 'promo',
                formation: 'es',
                promo: '2024-2027',
                members: [],
                messages: []
            },
            {
                id: 2,
                name: 'Promo ME 2024-2026',
                type: 'promo',
                formation: 'me',
                promo: '2024-2026',
                members: [],
                messages: []
            }
        ]));
    }
    loadGroups();
}

function loadGroups() {
    const groups = JSON.parse(localStorage.getItem('afertes_groups') || '[]');
    const container = document.getElementById('groups-items');
    if (!container) return;

    const userGroups = groups.filter(g => {
        if (g.type === 'promo') {
            return (currentUser?.formation === g.formation && currentUser?.promo === g.promo) ||
                   currentUser?.role === 'teacher' ||
                   currentUser?.role === 'secretary';
        }
        return g.members?.includes(currentUser?.id);
    });

    if (userGroups.length === 0) {
        container.innerHTML = '<p style="padding: 16px; color: var(--text-muted);">Aucun groupe disponible</p>';
        return;
    }

    container.innerHTML = userGroups.map(group => {
        const lastMsg = group.messages?.[group.messages.length - 1];
        return `
            <div class="group-item" onclick="openGroupChat(${group.id})">
                <div class="group-avatar">
                    <i class="fas fa-users"></i>
                </div>
                <div class="group-info">
                    <h4>${group.name}</h4>
                    <p>${lastMsg ? lastMsg.text.substring(0, 30) + '...' : 'Aucun message'}</p>
                </div>
                <div class="group-meta">
                    <span class="time">${lastMsg ? formatTimeAgo(lastMsg.timestamp) : ''}</span>
                </div>
            </div>
        `;
    }).join('');
}

let currentGroupId = null;

function openGroupChat(groupId) {
    currentGroupId = groupId;
    const groups = JSON.parse(localStorage.getItem('afertes_groups') || '[]');
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    document.querySelectorAll('.group-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`.group-item[onclick="openGroupChat(${groupId})"]`)?.classList.add('active');

    const container = document.getElementById('group-chat-container');
    container.innerHTML = `
        <div class="chat-header">
            <div class="group-avatar" style="width: 40px; height: 40px;">
                <i class="fas fa-users"></i>
            </div>
            <div>
                <h4>${group.name}</h4>
                <span style="font-size: 0.85rem; color: var(--text-light);">${group.type === 'promo' ? 'Groupe de promotion' : 'Groupe privé'}</span>
            </div>
        </div>
        <div class="chat-messages" id="group-messages">
            ${renderGroupMessages(group.messages || [])}
        </div>
        <div class="chat-input">
            <input type="text" id="group-message-input" placeholder="Écrire un message..." onkeypress="handleGroupMessageKeypress(event)">
            <button onclick="sendGroupMessage()"><i class="fas fa-paper-plane"></i></button>
        </div>
    `;

    const messagesDiv = document.getElementById('group-messages');
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function renderGroupMessages(messages) {
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    return messages.map(msg => {
        const sender = users.find(u => u.id === msg.senderId);
        const isMine = msg.senderId === currentUser?.id;
        return `
            <div class="message ${isMine ? 'sent' : 'received'}">
                ${!isMine ? `<div style="font-size: 0.75rem; color: var(--text-light); margin-bottom: 4px;">${sender?.firstname || 'Utilisateur'}</div>` : ''}
                <div class="message-content">${msg.text}</div>
                <div class="message-time">${formatTimeAgo(msg.timestamp)}</div>
            </div>
        `;
    }).join('');
}

function sendGroupMessage() {
    const input = document.getElementById('group-message-input');
    const text = input.value.trim();
    if (!text || !currentGroupId) return;

    const groups = JSON.parse(localStorage.getItem('afertes_groups') || '[]');
    const groupIdx = groups.findIndex(g => g.id === currentGroupId);
    if (groupIdx === -1) return;

    if (!groups[groupIdx].messages) groups[groupIdx].messages = [];
    groups[groupIdx].messages.push({
        id: Date.now(),
        senderId: currentUser?.id,
        text: text,
        timestamp: new Date().toISOString()
    });

    localStorage.setItem('afertes_groups', JSON.stringify(groups));
    input.value = '';
    openGroupChat(currentGroupId);
}

function handleGroupMessageKeypress(e) {
    if (e.key === 'Enter') sendGroupMessage();
}

function createGroup() {
    const name = prompt('Nom du groupe:');
    if (!name) return;

    const groups = JSON.parse(localStorage.getItem('afertes_groups') || '[]');
    groups.push({
        id: Date.now(),
        name: name,
        type: 'custom',
        members: [currentUser?.id],
        messages: [],
        createdBy: currentUser?.id,
        createdAt: new Date().toISOString()
    });

    localStorage.setItem('afertes_groups', JSON.stringify(groups));
    loadGroups();
    showToast('Groupe créé', 'success');
}

// ===========================================
// GESTION DES PROMOTIONS
// ===========================================

function initPromosData() {
    if (!localStorage.getItem('afertes_promos')) {
        const defaultPromos = [
            { id: 1, formation: 'es', yearStart: 2023, yearEnd: 2026, site: 'slb', capacity: 30, status: 'active' },
            { id: 2, formation: 'es', yearStart: 2024, yearEnd: 2027, site: 'slb', capacity: 30, status: 'active' },
            { id: 3, formation: 'me', yearStart: 2024, yearEnd: 2026, site: 'slb', capacity: 25, status: 'active' },
            { id: 4, formation: 'aes', yearStart: 2024, yearEnd: 2025, site: 'slb', capacity: 20, status: 'active' },
            { id: 5, formation: 'es', yearStart: 2024, yearEnd: 2027, site: 'avion', capacity: 25, status: 'active' },
            { id: 6, formation: 'caferuis', yearStart: 2024, yearEnd: 2026, site: 'slb', capacity: 15, status: 'active' }
        ];
        localStorage.setItem('afertes_promos', JSON.stringify(defaultPromos));
    }
}

function loadPromosList() {
    initPromosData();
    const promos = JSON.parse(localStorage.getItem('afertes_promos') || '[]');
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const container = document.getElementById('promos-list');
    if (!container) return;

    const formationFilter = document.getElementById('filter-promo-formation')?.value || '';
    const statusFilter = document.getElementById('filter-promo-status')?.value || '';

    let filtered = promos;
    if (formationFilter) filtered = filtered.filter(p => p.formation === formationFilter);
    if (statusFilter) filtered = filtered.filter(p => p.status === statusFilter);

    const formationNames = {
        'es': 'Éducateur Spécialisé',
        'me': 'Moniteur Éducateur',
        'aes': 'AES',
        'caferuis': 'CAFERUIS',
        'cafdes': 'CAFDES'
    };

    if (filtered.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">Aucune promotion trouvée</p>';
        return;
    }

    container.innerHTML = filtered.map(promo => {
        const promoCode = `${promo.yearStart}-${promo.yearEnd}`;
        const studentCount = users.filter(u =>
            (u.role === 'student' || u.role === 'bde') &&
            u.formation === promo.formation &&
            u.promo === promoCode
        ).length;

        return `
            <div class="promo-item ${promo.status === 'archived' ? 'archived' : ''}">
                <div class="promo-icon">
                    <i class="fas fa-graduation-cap"></i>
                </div>
                <div class="promo-info">
                    <h4>${formationNames[promo.formation] || promo.formation.toUpperCase()} ${promoCode}</h4>
                    <p>Site: ${promo.site === 'slb' ? 'Saint-Laurent-Blangy' : 'Avion'}</p>
                    <div class="promo-stats">
                        <span class="promo-stat"><i class="fas fa-users"></i> ${studentCount}/${promo.capacity || '?'} étudiants</span>
                        <span class="promo-stat"><i class="fas fa-circle" style="color: ${promo.status === 'active' ? 'var(--success-color)' : 'var(--text-muted)'};"></i> ${promo.status === 'active' ? 'En cours' : 'Archivée'}</span>
                    </div>
                </div>
                <div class="promo-actions">
                    <button onclick="viewPromoStudents(${promo.id})" title="Voir les étudiants">
                        <i class="fas fa-users"></i>
                    </button>
                    <button onclick="editPromo(${promo.id})" title="Modifier">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="archivePromo(${promo.id})" title="${promo.status === 'active' ? 'Archiver' : 'Réactiver'}">
                        <i class="fas fa-${promo.status === 'active' ? 'archive' : 'undo'}"></i>
                    </button>
                    <button class="danger" onclick="deletePromo(${promo.id})" title="Supprimer">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function createPromo(e) {
    e.preventDefault();

    const formation = document.getElementById('promo-formation').value;
    const site = document.getElementById('promo-site').value;
    const yearStart = parseInt(document.getElementById('promo-year-start').value);
    const yearEnd = parseInt(document.getElementById('promo-year-end').value);
    const capacity = parseInt(document.getElementById('promo-capacity').value) || 30;

    if (yearEnd <= yearStart) {
        showToast('L\'année de fin doit être supérieure à l\'année de début', 'error');
        return;
    }

    initPromosData();
    const promos = JSON.parse(localStorage.getItem('afertes_promos') || '[]');

    // Vérifier si la promo existe déjà
    const exists = promos.find(p =>
        p.formation === formation &&
        p.yearStart === yearStart &&
        p.yearEnd === yearEnd &&
        p.site === site
    );

    if (exists) {
        showToast('Cette promotion existe déjà', 'error');
        return;
    }

    promos.push({
        id: Date.now(),
        formation,
        yearStart,
        yearEnd,
        site,
        capacity,
        status: 'active',
        createdAt: new Date().toISOString()
    });

    localStorage.setItem('afertes_promos', JSON.stringify(promos));
    showToast('Promotion créée avec succès', 'success');
    e.target.reset();
    loadPromosList();
    refreshPromoSelectors();
}

function editPromo(id) {
    const promos = JSON.parse(localStorage.getItem('afertes_promos') || '[]');
    const promo = promos.find(p => p.id === id);
    if (!promo) return;

    const modalContent = `
        <h2>Modifier la promotion</h2>
        <form onsubmit="savePromoEdit(event, ${id})">
            <div class="form-row">
                <div class="form-group">
                    <label>Formation</label>
                    <select id="edit-promo-formation">
                        <option value="es" ${promo.formation === 'es' ? 'selected' : ''}>ES</option>
                        <option value="me" ${promo.formation === 'me' ? 'selected' : ''}>ME</option>
                        <option value="aes" ${promo.formation === 'aes' ? 'selected' : ''}>AES</option>
                        <option value="caferuis" ${promo.formation === 'caferuis' ? 'selected' : ''}>CAFERUIS</option>
                        <option value="cafdes" ${promo.formation === 'cafdes' ? 'selected' : ''}>CAFDES</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Site</label>
                    <select id="edit-promo-site">
                        <option value="slb" ${promo.site === 'slb' ? 'selected' : ''}>Saint-Laurent-Blangy</option>
                        <option value="avion" ${promo.site === 'avion' ? 'selected' : ''}>Avion</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Année début</label>
                    <input type="number" id="edit-promo-year-start" value="${promo.yearStart}" required>
                </div>
                <div class="form-group">
                    <label>Année fin</label>
                    <input type="number" id="edit-promo-year-end" value="${promo.yearEnd}" required>
                </div>
            </div>
            <div class="form-group">
                <label>Capacité</label>
                <input type="number" id="edit-promo-capacity" value="${promo.capacity || 30}">
            </div>
            <button type="submit" class="btn btn-primary btn-block">Enregistrer</button>
        </form>
    `;
    document.getElementById('modal-content').innerHTML = modalContent;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

function savePromoEdit(e, id) {
    e.preventDefault();
    const promos = JSON.parse(localStorage.getItem('afertes_promos') || '[]');
    const idx = promos.findIndex(p => p.id === id);
    if (idx === -1) return;

    promos[idx].formation = document.getElementById('edit-promo-formation').value;
    promos[idx].site = document.getElementById('edit-promo-site').value;
    promos[idx].yearStart = parseInt(document.getElementById('edit-promo-year-start').value);
    promos[idx].yearEnd = parseInt(document.getElementById('edit-promo-year-end').value);
    promos[idx].capacity = parseInt(document.getElementById('edit-promo-capacity').value);

    localStorage.setItem('afertes_promos', JSON.stringify(promos));
    closeModal();
    loadPromosList();
    refreshPromoSelectors();
    showToast('Promotion modifiée', 'success');
}

function archivePromo(id) {
    const promos = JSON.parse(localStorage.getItem('afertes_promos') || '[]');
    const idx = promos.findIndex(p => p.id === id);
    if (idx === -1) return;

    promos[idx].status = promos[idx].status === 'active' ? 'archived' : 'active';
    localStorage.setItem('afertes_promos', JSON.stringify(promos));
    loadPromosList();
    showToast(promos[idx].status === 'active' ? 'Promotion réactivée' : 'Promotion archivée', 'success');
}

function deletePromo(id) {
    const promos = JSON.parse(localStorage.getItem('afertes_promos') || '[]');
    const promo = promos.find(p => p.id === id);
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const promoCode = `${promo.yearStart}-${promo.yearEnd}`;

    const studentsInPromo = users.filter(u =>
        u.formation === promo.formation && u.promo === promoCode
    ).length;

    if (studentsInPromo > 0) {
        if (!confirm(`Attention ! ${studentsInPromo} étudiant(s) sont dans cette promotion. Voulez-vous vraiment la supprimer ?`)) {
            return;
        }
    } else if (!confirm('Supprimer cette promotion ?')) {
        return;
    }

    const filtered = promos.filter(p => p.id !== id);
    localStorage.setItem('afertes_promos', JSON.stringify(filtered));
    loadPromosList();
    refreshPromoSelectors();
    showToast('Promotion supprimée', 'success');
}

function viewPromoStudents(promoId) {
    const promos = JSON.parse(localStorage.getItem('afertes_promos') || '[]');
    const promo = promos.find(p => p.id === promoId);
    if (!promo) return;

    // Naviguer vers la page admin-students avec le filtre de la promo
    showPage('admin-students');
    setTimeout(() => {
        document.getElementById('admin-student-formation').value = promo.formation;
        const promoCode = `${promo.yearStart}-${promo.yearEnd}`;
        refreshPromoSelector('admin-student-promo', promo.formation);
        setTimeout(() => {
            document.getElementById('admin-student-promo').value = promoCode;
            loadAdminStudentsEnhanced();
        }, 100);
    }, 100);
}

function refreshPromoSelectors() {
    refreshPromoSelector('admin-student-promo');
    refreshPromoSelector('reg-promo');
    refreshPromoSelector('new-student-promo');
    refreshPromoSelector('edit-promo');
}

function refreshPromoSelector(selectorId, formationFilter = null) {
    const selector = document.getElementById(selectorId);
    if (!selector) return;

    initPromosData();
    const promos = JSON.parse(localStorage.getItem('afertes_promos') || '[]');
    const activePromos = promos.filter(p => p.status === 'active');

    let filtered = activePromos;
    if (formationFilter) {
        filtered = filtered.filter(p => p.formation === formationFilter);
    }

    const uniquePromos = [...new Set(filtered.map(p => `${p.yearStart}-${p.yearEnd}`))].sort().reverse();

    const currentValue = selector.value;
    selector.innerHTML = '<option value="">Sélectionner une promotion</option>' +
        uniquePromos.map(p => `<option value="${p}">${p}</option>`).join('');

    if (uniquePromos.includes(currentValue)) {
        selector.value = currentValue;
    }
}

// ===========================================
// GESTION DES ÉTUDIANTS AMÉLIORÉE
// ===========================================

function loadAdminStudentsEnhanced() {
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const students = users.filter(u => u.role === 'student' || u.role === 'bde');
    const tbody = document.getElementById('admin-students-tbody');
    if (!tbody) return;

    const formationFilter = document.getElementById('admin-student-formation')?.value || '';
    const promoFilter = document.getElementById('admin-student-promo')?.value || '';
    const statusFilter = document.getElementById('admin-student-status')?.value || '';
    const searchFilter = document.getElementById('admin-student-search')?.value?.toLowerCase() || '';

    let filtered = students;
    if (formationFilter) filtered = filtered.filter(s => s.formation === formationFilter);
    if (promoFilter) filtered = filtered.filter(s => s.promo === promoFilter);
    if (statusFilter) filtered = filtered.filter(s => (s.status || 'active') === statusFilter);
    if (searchFilter) filtered = filtered.filter(s =>
        s.firstname.toLowerCase().includes(searchFilter) ||
        s.lastname.toLowerCase().includes(searchFilter) ||
        s.email.toLowerCase().includes(searchFilter)
    );

    tbody.innerHTML = filtered.map(student => {
        const status = student.status || 'active';
        const statusLabels = { active: 'Actif', abandon: 'Abandon', diplome: 'Diplômé' };

        // Vérifier les documents
        const docs = student.documents || {};
        const hasId = !!docs.id;
        const hasVitale = !!docs.vitale;
        const hasPhoto = !!docs.photo;
        const docsCount = [hasId, hasVitale, hasPhoto].filter(Boolean).length;
        const docsComplete = docsCount === 3;

        return `
            <tr class="${status !== 'active' ? 'student-inactive' : ''}">
                <td><input type="checkbox" data-id="${student.id}"></td>
                <td>${student.lastname}</td>
                <td>${student.firstname}</td>
                <td>${student.email}</td>
                <td>${(student.formation || '').toUpperCase()}</td>
                <td>${student.promo || '-'}</td>
                <td><span class="status-badge ${status}">${statusLabels[status]}</span></td>
                <td>
                    <div class="docs-status ${docsComplete ? 'complete' : 'incomplete'}" title="${docsCount}/3 documents">
                        <i class="fas fa-id-card ${hasId ? 'ok' : ''}"></i>
                        <i class="fas fa-heart ${hasVitale ? 'ok' : ''}"></i>
                        <i class="fas fa-camera ${hasPhoto ? 'ok' : ''}"></i>
                    </div>
                </td>
                <td>
                    <button class="action-btn" onclick="viewStudentDocuments(${student.id})" title="Voir documents">
                        <i class="fas fa-folder-open"></i>
                    </button>
                    <button class="action-btn" onclick="editStudent(${student.id})" title="Modifier">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn" onclick="changeStudentStatus(${student.id})" title="Changer le statut">
                        <i class="fas fa-user-tag"></i>
                    </button>
                    <button class="action-btn danger" onclick="deleteStudent(${student.id})" title="Supprimer">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function changeStudentStatus(id) {
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const student = users.find(u => u.id === id);
    if (!student) return;

    const currentStatus = student.status || 'active';

    const modalContent = `
        <h2><i class="fas fa-user-tag" style="color: var(--primary-color);"></i> Changer le statut</h2>
        <p style="margin-bottom: 16px;">Étudiant: <strong>${student.firstname} ${student.lastname}</strong></p>
        <form onsubmit="saveStudentStatus(event, ${id})">
            <div class="form-group">
                <label>Nouveau statut</label>
                <select id="new-student-status" required>
                    <option value="active" ${currentStatus === 'active' ? 'selected' : ''}>Actif - En formation</option>
                    <option value="abandon" ${currentStatus === 'abandon' ? 'selected' : ''}>Abandon - A quitté la formation</option>
                    <option value="diplome" ${currentStatus === 'diplome' ? 'selected' : ''}>Diplômé - Formation terminée</option>
                </select>
            </div>
            <div class="form-group">
                <label>Motif (optionnel)</label>
                <textarea id="status-reason" rows="3" placeholder="Raison du changement de statut..."></textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Enregistrer</button>
        </form>
    `;
    document.getElementById('modal-content').innerHTML = modalContent;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

function saveStudentStatus(e, id) {
    e.preventDefault();
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return;

    const newStatus = document.getElementById('new-student-status').value;
    const reason = document.getElementById('status-reason').value;

    users[idx].status = newStatus;
    users[idx].statusReason = reason;
    users[idx].statusChangedAt = new Date().toISOString();

    localStorage.setItem('afertes_users', JSON.stringify(users));
    closeModal();
    loadAdminStudentsEnhanced();
    showToast('Statut modifié avec succès', 'success');
}

function viewStudentDocuments(studentId) {
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const student = users.find(u => u.id === studentId);
    if (!student) return;

    const docs = student.documents || {};
    const docTypes = [
        { key: 'id', name: 'Pièce d\'identité', icon: 'fa-id-card' },
        { key: 'vitale', name: 'Carte Vitale', icon: 'fa-heart' },
        { key: 'photo', name: 'Photo d\'identité', icon: 'fa-camera' }
    ];

    const docsHtml = docTypes.map(docType => {
        const doc = docs[docType.key];
        const hasDoc = !!doc;

        return `
            <div class="admin-doc-item ${hasDoc ? 'has-doc' : 'missing-doc'}">
                <div class="admin-doc-icon">
                    <i class="fas ${docType.icon}"></i>
                </div>
                <div class="admin-doc-info">
                    <div class="admin-doc-name">${docType.name}</div>
                    <div class="admin-doc-status">
                        ${hasDoc
                            ? `<span class="ok"><i class="fas fa-check"></i> Déposé le ${formatDateFR(doc.uploadedAt.split('T')[0])}</span>`
                            : `<span class="missing"><i class="fas fa-times"></i> Non déposé</span>`
                        }
                    </div>
                </div>
                ${hasDoc ? `
                    <div class="admin-doc-actions">
                        <button class="btn btn-sm" onclick="viewStudentDocument(${studentId}, '${docType.key}')">
                            <i class="fas fa-eye"></i> Voir
                        </button>
                        <button class="btn btn-sm" onclick="downloadStudentDocument(${studentId}, '${docType.key}')">
                            <i class="fas fa-download"></i>
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    const modalContent = `
        <h2><i class="fas fa-folder-open" style="color: var(--primary-color);"></i> Documents de ${student.firstname} ${student.lastname}</h2>
        <div class="admin-docs-list">
            ${docsHtml}
        </div>
        <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #eee;">
            <p style="font-size: 0.85rem; color: var(--text-muted);">
                <i class="fas fa-info-circle"></i> Profil ${student.profileCompleted ? 'complété' : 'incomplet'}
                ${student.profileCompleted ? ` le ${formatDateFR(student.profileCompletedAt?.split('T')[0])}` : ''}
            </p>
        </div>
    `;

    document.getElementById('modal-content').innerHTML = modalContent;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

function viewStudentDocument(studentId, type) {
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const student = users.find(u => u.id === studentId);
    const doc = student?.documents?.[type];
    if (!doc) return;

    const win = window.open();
    if (doc.type.startsWith('image/')) {
        win.document.write(`<img src="${doc.data}" style="max-width: 100%;">`);
    } else {
        win.document.write(`<iframe src="${doc.data}" style="width: 100%; height: 100vh; border: none;"></iframe>`);
    }
}

function downloadStudentDocument(studentId, type) {
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const student = users.find(u => u.id === studentId);
    const doc = student?.documents?.[type];
    if (!doc) return;

    const link = document.createElement('a');
    link.href = doc.data;
    link.download = `${student.lastname}_${student.firstname}_${type}_${doc.name}`;
    link.click();
}

function showAddStudentModalEnhanced() {
    initPromosData();
    const promos = JSON.parse(localStorage.getItem('afertes_promos') || '[]');
    const activePromos = promos.filter(p => p.status === 'active');

    const modalContent = `
        <h2>Ajouter un étudiant</h2>
        <form id="add-student-form" onsubmit="addStudent(event)">
            <div class="form-row">
                <div class="form-group">
                    <label>Nom *</label>
                    <input type="text" id="new-student-lastname" required>
                </div>
                <div class="form-group">
                    <label>Prénom *</label>
                    <input type="text" id="new-student-firstname" required>
                </div>
            </div>
            <div class="form-group">
                <label>Email *</label>
                <input type="email" id="new-student-email" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Formation *</label>
                    <select id="new-student-formation" required onchange="updatePromoOptions()">
                        <option value="">Sélectionner</option>
                        <option value="es">ES - Éducateur Spécialisé</option>
                        <option value="me">ME - Moniteur Éducateur</option>
                        <option value="aes">AES</option>
                        <option value="caferuis">CAFERUIS</option>
                        <option value="cafdes">CAFDES</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Promotion *</label>
                    <select id="new-student-promo" required>
                        <option value="">Sélectionner d'abord une formation</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Site *</label>
                <select id="new-student-site" required>
                    <option value="slb">Saint-Laurent-Blangy</option>
                    <option value="avion">Avion</option>
                </select>
            </div>
            <button type="submit" class="btn btn-primary btn-block">
                <i class="fas fa-user-plus"></i> Ajouter
            </button>
        </form>
    `;
    document.getElementById('modal-content').innerHTML = modalContent;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

function updatePromoOptions() {
    const formation = document.getElementById('new-student-formation')?.value;
    refreshPromoSelector('new-student-promo', formation);
}

// Override original functions
const originalLoadAdminStudents = loadAdminStudents;
loadAdminStudents = function() {
    refreshPromoSelector('admin-student-promo');
    loadAdminStudentsEnhanced();
};

const originalShowAddStudentModal = showAddStudentModal;
showAddStudentModal = showAddStudentModalEnhanced;

// ===========================================
// UTILITAIRES
// ===========================================

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function getGradeClass(value) {
    if (value >= 16) return 'excellent';
    if (value >= 12) return 'good';
    if (value >= 10) return 'average';
    return 'poor';
}

// ===========================================
// Export pour utilisation externe
// ===========================================
window.showPage = showPage;
window.showLogin = showLogin;
window.showRegister = showRegister;
window.logout = logout;
window.toggleSidebar = toggleSidebar;
window.toggleNotifications = toggleNotifications;
window.toggleUserMenu = toggleUserMenu;
window.markAllRead = markAllRead;
window.markNotificationRead = markNotificationRead;
window.showNewsDetail = showNewsDetail;
window.filterNews = filterNews;
window.contactBDE = contactBDE;
window.submitBDEInterest = submitBDEInterest;
window.openConversation = openConversation;
window.sendMessage = sendMessage;
window.handleMessageKeypress = handleMessageKeypress;
window.newConversation = newConversation;
window.startConversation = startConversation;
window.viewProfile = viewProfile;
window.editProfile = editProfile;
window.saveProfile = saveProfile;
window.changeAvatar = changeAvatar;
window.previewAvatar = previewAvatar;
window.uploadAvatar = uploadAvatar;
window.changePassword = changePassword;
window.submitPasswordChange = submitPasswordChange;
window.deleteAccount = deleteAccount;
window.confirmDeleteAccount = confirmDeleteAccount;
window.showRGPD = showRGPD;
window.showForgotPassword = showForgotPassword;
window.submitForgotPassword = submitForgotPassword;
window.showResetPasswordForm = showResetPasswordForm;
window.submitResetPassword = submitResetPassword;
window.closeModal = closeModal;

// Export des nouvelles fonctions
window.previousWeek = previousWeek;
window.nextWeek = nextWeek;
window.goToToday = goToToday;
window.loadStudentsForGrading = loadStudentsForGrading;
window.cancelGradeEntry = cancelGradeEntry;
window.saveGrades = saveGrades;

// Export fonctions administration (secrétaires)
window.loadAdminStudents = loadAdminStudents;
window.showAddStudentModal = showAddStudentModal;
window.addStudent = addStudent;
window.editStudent = editStudent;
window.saveStudentEdit = saveStudentEdit;
window.deleteStudent = deleteStudent;
window.viewStudentProfile = viewStudentProfile;
window.changeStudentStatus = changeStudentStatus;
window.saveStudentStatus = saveStudentStatus;
window.viewStudentDocuments = viewStudentDocuments;
window.viewStudentDocument = viewStudentDocument;
window.downloadStudentDocument = downloadStudentDocument;
window.exportStudentsList = exportStudentsList;
window.formatDateFR = formatDateFR;
window.formatFileSize = formatFileSize;
window.showFirstLoginModal = showFirstLoginModal;
window.handleFirstLoginSubmit = handleFirstLoginSubmit;
window.handleDocumentUpload = handleDocumentUpload;
window.removeDocument = removeDocument;
window.updateDocument = updateDocument;
window.loadMyDocuments = loadMyDocuments;
window.viewDocument = viewDocument;
window.downloadDocument = downloadDocument;
window.generateAttestationScolarite = generateAttestationScolarite;
window.loadAdminGrades = loadAdminGrades;
window.viewStudentGrades = viewStudentGrades;
window.generateStudentBulletin = generateStudentBulletin;
window.generateBulletins = generateBulletins;
window.exportGradesList = exportGradesList;
window.loadAdminScheduleTeachers = loadAdminScheduleTeachers;
window.handleAdminScheduleForm = handleAdminScheduleForm;
window.importScheduleFile = importScheduleFile;

// Export fonctions BDE
window.loadBDEEventsManage = loadBDEEventsManage;
window.createBDEEvent = createBDEEvent;
window.editBDEEvent = editBDEEvent;
window.deleteBDEEvent = deleteBDEEvent;
window.loadBDEMembers = loadBDEMembers;
window.showAddBDEMemberModal = showAddBDEMemberModal;

// Export fonctions Drive
window.initDrive = initDrive;
window.loadDriveContent = loadDriveContent;
window.navigateDrive = navigateDrive;
window.setDriveView = setDriveView;
window.uploadFile = uploadFile;
window.createFolder = createFolder;
window.showDriveMenu = showDriveMenu;
window.deleteItem = deleteItem;
window.renameItem = renameItem;
window.shareItem = shareItem;
window.downloadItem = downloadItem;
window.previewFile = previewFile;

// Export fonctions messagerie de groupe
window.initGroupMessages = initGroupMessages;
window.loadGroups = loadGroups;
window.openGroupChat = openGroupChat;
window.sendGroupMessage = sendGroupMessage;
window.handleGroupMessageKeypress = handleGroupMessageKeypress;
window.createGroup = createGroup;
