/**
 * AFERTES Connect - Adaptateur API
 * Remplace les fonctions localStorage par des appels API quand le backend est disponible
 */

// Mode de fonctionnement : 'api' ou 'local'
let APP_MODE = 'local';

/**
 * Initialisation de l'adaptateur
 */
async function initAPIAdapter() {
    console.log('Initialisation de l\'adaptateur API...');

    // Vérifier si l'API est disponible
    try {
        const isOnline = await API.checkHealth();
        if (isOnline) {
            APP_MODE = 'api';
            console.log('Mode API activé - Backend connecté');
            overrideFunctions();
        } else {
            APP_MODE = 'local';
            console.log('Mode local activé - Backend non disponible');
        }
    } catch (e) {
        APP_MODE = 'local';
        console.log('Mode local activé - Erreur de connexion au backend');
    }

    return APP_MODE;
}

/**
 * Remplacer les fonctions originales par les versions API
 */
function overrideFunctions() {
    // Sauvegarder les fonctions originales
    const originalHandleLogin = window.handleLogin;
    const originalHandleLogout = window.handleLogout;
    const originalLoadStudentsList = window.loadStudentsList;
    const originalExportStudentsList = window.exportStudentsList;
    const originalExportGradesList = window.exportGradesList;
    const originalHandleFirstLoginSubmit = window.handleFirstLoginSubmit;
    const originalHandleDocumentUpload = window.handleDocumentUpload;
    const originalLoadMyDocuments = window.loadMyDocuments;

    // ========== AUTHENTIFICATION ==========

    window.handleLogin = async function(e) {
        e.preventDefault();

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const result = await API.login(email, password);

            if (result.success) {
                currentUser = {
                    id: result.user.id,
                    email: result.user.email,
                    firstname: result.user.firstName,
                    lastname: result.user.lastName,
                    role: result.user.role,
                    formation: result.user.formationCode,
                    profileCompleted: result.user.firstLoginCompleted
                };

                localStorage.setItem('afertes_user', JSON.stringify(currentUser));
                registerActiveSession(currentUser.id);

                if (currentUser.role === 'student' && !currentUser.profileCompleted) {
                    showFirstLoginModal(currentUser);
                } else {
                    showToast('Connexion réussie !', 'success');
                    showApp();
                }
            }
        } catch (error) {
            showToast(error.message || 'Erreur de connexion', 'error');
        }
    };

    window.handleLogout = async function() {
        try {
            await API.logout();
        } catch (e) {
            // Ignorer les erreurs
        }

        if (currentUser) {
            removeActiveSession(currentUser.id);
        }
        currentUser = null;
        localStorage.removeItem('afertes_user');
        showLogin();
        showToast('Déconnexion réussie', 'info');
    };

    // ========== PREMIÈRE CONNEXION ==========

    window.handleFirstLoginSubmit = async function(e) {
        e.preventDefault();

        const data = {
            lastName: document.getElementById('fl-lastname').value.trim(),
            firstName: document.getElementById('fl-firstname').value.trim(),
            phone: document.getElementById('fl-phone').value.trim(),
            email: document.getElementById('fl-email').value.trim(),
            birthDate: document.getElementById('fl-birthdate').value,
            socialSecurityNumber: document.getElementById('fl-secu').value.trim(),
            address: document.getElementById('fl-address').value.trim(),
            postalCode: document.getElementById('fl-postalcode').value.trim(),
            city: document.getElementById('fl-city').value.trim()
        };

        // Validations
        if (!data.lastName || !data.firstName || !data.phone || !data.email ||
            !data.birthDate || !data.socialSecurityNumber || !data.address ||
            !data.postalCode || !data.city) {
            showToast('Veuillez remplir tous les champs obligatoires', 'error');
            return;
        }

        if (!/^\d{15}$/.test(data.socialSecurityNumber)) {
            showToast('Le numéro de sécurité sociale doit contenir 15 chiffres', 'error');
            return;
        }

        if (!/^\d{5}$/.test(data.postalCode)) {
            showToast('Le code postal doit contenir 5 chiffres', 'error');
            return;
        }

        try {
            // Upload des documents si présents
            const identityFile = window.firstLoginDocuments?.identity;
            const vitaleFile = window.firstLoginDocuments?.vitale;
            const photoFile = window.firstLoginDocuments?.photo;

            if (identityFile) {
                await API.uploadDocument(identityFile, 'identity');
            }
            if (vitaleFile) {
                await API.uploadDocument(vitaleFile, 'vitale');
            }
            if (photoFile) {
                await API.uploadDocument(photoFile, 'photo');
            }

            // Compléter le profil
            await API.completeFirstLogin(currentUser.id, data);

            // Mettre à jour l'utilisateur local
            currentUser.firstname = data.firstName;
            currentUser.lastname = data.lastName;
            currentUser.profileCompleted = true;
            localStorage.setItem('afertes_user', JSON.stringify(currentUser));

            // Fermer le modal et afficher l'app
            document.getElementById('first-login-modal').classList.add('hidden');
            showToast('Profil complété avec succès !', 'success');
            showApp();

        } catch (error) {
            showToast(error.message || 'Erreur lors de l\'enregistrement', 'error');
        }
    };

    // ========== GESTION DES ÉTUDIANTS ==========

    window.loadStudentsList = async function() {
        const container = document.getElementById('students-list');
        if (!container) return;

        container.innerHTML = '<div class="loading">Chargement...</div>';

        try {
            const students = await API.getStudents();

            if (students.length === 0) {
                container.innerHTML = '<p class="empty-message">Aucun étudiant inscrit</p>';
                return;
            }

            container.innerHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Nom</th>
                            <th>Prénom</th>
                            <th>Email</th>
                            <th>Téléphone</th>
                            <th>Formation</th>
                            <th>Documents</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${students.map(s => `
                            <tr>
                                <td>${s.last_name || '-'}</td>
                                <td>${s.first_name || '-'}</td>
                                <td>${s.email || '-'}</td>
                                <td>${s.phone || '-'}</td>
                                <td>${s.formation_name || '-'}</td>
                                <td>
                                    <span class="doc-status ${s.doc_count > 0 ? 'doc-complete' : 'doc-incomplete'}">
                                        ${s.doc_count || 0} doc(s)
                                    </span>
                                </td>
                                <td>
                                    <button onclick="viewStudentDetails(${s.id})" class="btn-small">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    <button onclick="viewStudentDocuments(${s.id})" class="btn-small">
                                        <i class="fas fa-folder"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

        } catch (error) {
            container.innerHTML = `<p class="error-message">Erreur: ${error.message}</p>`;
        }
    };

    // ========== EXPORT EXCEL ==========

    window.exportStudentsList = async function() {
        try {
            showToast('Export en cours...', 'info');

            const data = await API.exportStudents();

            // Générer le fichier Excel avec SheetJS
            const ws = XLSX.utils.json_to_sheet(data.data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, data.sheetName);
            XLSX.writeFile(wb, data.filename);

            showToast('Export Excel terminé !', 'success');

        } catch (error) {
            showToast('Erreur lors de l\'export: ' + error.message, 'error');
        }
    };

    window.exportGradesList = async function() {
        try {
            showToast('Export en cours...', 'info');

            const data = await API.exportGrades();

            const ws = XLSX.utils.json_to_sheet(data.data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, data.sheetName);
            XLSX.writeFile(wb, data.filename);

            showToast('Export Excel terminé !', 'success');

        } catch (error) {
            showToast('Erreur lors de l\'export: ' + error.message, 'error');
        }
    };

    // ========== DOCUMENTS ==========

    window.handleDocumentUpload = async function(input, type) {
        const file = input.files[0];
        if (!file) return;

        // Validation
        const maxSize = 10 * 1024 * 1024; // 10 MB
        if (file.size > maxSize) {
            showToast('Le fichier est trop volumineux (max 10 MB)', 'error');
            return;
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            showToast('Type de fichier non autorisé', 'error');
            return;
        }

        try {
            await API.uploadDocument(file, type);
            showToast('Document uploadé avec succès', 'success');

            // Mettre à jour l'affichage
            const card = input.closest('.upload-card');
            if (card) {
                card.classList.add('uploaded');
                const statusEl = card.querySelector('.upload-status');
                if (statusEl) {
                    statusEl.innerHTML = `<i class="fas fa-check-circle"></i> ${file.name}`;
                }
            }

        } catch (error) {
            showToast('Erreur upload: ' + error.message, 'error');
        }
    };

    window.loadMyDocuments = async function() {
        const container = document.getElementById('my-documents-grid');
        if (!container) return;

        try {
            const documents = await API.getMyDocuments();

            // Attestations disponibles
            const attestationsHtml = `
                <div class="attestation-card">
                    <i class="fas fa-file-alt attestation-icon"></i>
                    <h4>Attestation de scolarité</h4>
                    <p>Document officiel attestant votre inscription</p>
                    <button onclick="downloadAttestation('scolarite')" class="btn btn-primary">
                        <i class="fas fa-download"></i> Télécharger
                    </button>
                </div>
                <div class="attestation-card">
                    <i class="fas fa-file-invoice attestation-icon"></i>
                    <h4>Bulletin de notes</h4>
                    <p>Relevé de vos notes et appréciations</p>
                    <button onclick="downloadBulletin()" class="btn btn-primary">
                        <i class="fas fa-download"></i> Télécharger
                    </button>
                </div>
            `;

            // Documents uploadés
            let uploadsHtml = '<h3 style="margin-top: 2rem;">Mes documents personnels</h3><div class="documents-grid">';

            const docTypes = {
                'identity': { icon: 'fa-id-card', label: 'Pièce d\'identité' },
                'vitale': { icon: 'fa-heart', label: 'Carte Vitale' },
                'photo': { icon: 'fa-camera', label: 'Photo d\'identité' }
            };

            for (const [type, info] of Object.entries(docTypes)) {
                const doc = documents.find(d => d.doc_type === type);
                uploadsHtml += `
                    <div class="document-card ${doc ? 'has-document' : ''}">
                        <i class="fas ${info.icon}"></i>
                        <h4>${info.label}</h4>
                        ${doc ? `
                            <p class="doc-status"><i class="fas fa-check"></i> Uploadé</p>
                            <div class="doc-actions">
                                <button onclick="viewMyDocument(${doc.id})" class="btn-small">
                                    <i class="fas fa-eye"></i> Voir
                                </button>
                                <button onclick="deleteMyDocument(${doc.id})" class="btn-small btn-danger">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        ` : `
                            <p class="doc-status missing"><i class="fas fa-times"></i> Non fourni</p>
                            <input type="file" id="upload-${type}" accept="image/*,.pdf"
                                   onchange="handleDocumentUpload(this, '${type}')" style="display:none">
                            <button onclick="document.getElementById('upload-${type}').click()" class="btn-small">
                                <i class="fas fa-upload"></i> Ajouter
                            </button>
                        `}
                    </div>
                `;
            }
            uploadsHtml += '</div>';

            container.innerHTML = attestationsHtml + uploadsHtml;

        } catch (error) {
            container.innerHTML = `<p class="error-message">Erreur: ${error.message}</p>`;
        }
    };

    // Fonctions supplémentaires pour les documents

    window.viewMyDocument = function(docId) {
        window.open(API.getDocumentViewUrl(docId), '_blank');
    };

    window.deleteMyDocument = async function(docId) {
        if (!confirm('Supprimer ce document ?')) return;

        try {
            await API.deleteDocument(docId);
            showToast('Document supprimé', 'success');
            loadMyDocuments();
        } catch (error) {
            showToast('Erreur: ' + error.message, 'error');
        }
    };

    window.viewStudentDocuments = async function(studentId) {
        try {
            const documents = await API.getUserDocuments(studentId);
            const student = await API.getStudent(studentId);

            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal">
                    <div class="modal-header">
                        <h3>Documents de ${student.first_name} ${student.last_name}</h3>
                        <button onclick="this.closest('.modal-overlay').remove()" class="close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        ${documents.length === 0 ? '<p>Aucun document</p>' : `
                            <ul class="doc-list">
                                ${documents.map(d => `
                                    <li>
                                        <span>${d.doc_type}: ${d.file_name}</span>
                                        <button onclick="window.open('${API.getDocumentViewUrl(d.id)}', '_blank')" class="btn-small">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                    </li>
                                `).join('')}
                            </ul>
                        `}
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

        } catch (error) {
            showToast('Erreur: ' + error.message, 'error');
        }
    };

    // ========== NOTES ==========

    window.loadStudentGrades = async function() {
        if (!currentUser || currentUser.role !== 'student') return;

        const container = document.getElementById('grades-container');
        if (!container) return;

        try {
            const grades = await API.getStudentGrades(currentUser.id);

            if (grades.length === 0) {
                container.innerHTML = '<p class="empty-message">Aucune note disponible</p>';
                return;
            }

            // Grouper par matière
            const bySubject = {};
            grades.forEach(g => {
                if (!bySubject[g.subject_name]) {
                    bySubject[g.subject_name] = {
                        coefficient: g.coefficient,
                        grades: []
                    };
                }
                bySubject[g.subject_name].grades.push(g);
            });

            let html = '<div class="grades-list">';
            for (const [subject, data] of Object.entries(bySubject)) {
                const avg = data.grades.reduce((sum, g) => sum + parseFloat(g.grade), 0) / data.grades.length;
                html += `
                    <div class="subject-card">
                        <h4>${subject} <span class="coef">(coef. ${data.coefficient})</span></h4>
                        <div class="grades-row">
                            ${data.grades.map(g => `
                                <span class="grade-badge ${parseFloat(g.grade) >= 10 ? 'good' : 'bad'}">
                                    ${g.grade}/20
                                    <small>${g.grade_type}</small>
                                </span>
                            `).join('')}
                        </div>
                        <p class="subject-average">Moyenne: ${avg.toFixed(2)}/20</p>
                    </div>
                `;
            }
            html += '</div>';

            container.innerHTML = html;

        } catch (error) {
            container.innerHTML = `<p class="error-message">Erreur: ${error.message}</p>`;
        }
    };

    console.log('Fonctions API activées');
}

// Exposer la fonction d'initialisation
window.initAPIAdapter = initAPIAdapter;
