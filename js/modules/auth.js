/**
 * Module d'authentification
 * Gère la connexion, déconnexion, inscription et réinitialisation de mot de passe
 */

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
    if (window.currentUser) {
        registerActiveSession(window.currentUser.id);
    }
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
        window.currentUser = user;
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

function logout() {
    if (window.currentUser) {
        removeActiveSession(window.currentUser.id);
    }
    window.currentUser = null;
    localStorage.removeItem('afertes_user');
    showLogin();
    showToast('Déconnexion réussie', 'info');
}

// ===========================================
// Inscription
// ===========================================

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
        site: window.selectedSite || 'slb',
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
        formationGroup.style.display = 'block';
        formationGroup.classList.remove('hidden');
        promoGroup.style.display = 'block';
        promoGroup.classList.remove('hidden');
        document.getElementById('reg-formation').required = true;
        document.getElementById('reg-promo').required = true;
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
    const userIndex = users.findIndex(u => u.id === window.currentUser.id);

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
        window.currentUser = users[userIndex];
        localStorage.setItem('afertes_user', JSON.stringify(window.currentUser));

        // Fermer le modal et afficher l'application
        document.getElementById('first-login-modal').classList.add('hidden');
        showToast('Profil complété avec succès ! Bienvenue sur AFERTES Connect.', 'success');
        showApp();
    } else {
        showToast('Erreur lors de la mise à jour du profil', 'error');
    }
}

// ===========================================
// Réinitialisation de mot de passe
// ===========================================

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
// Export des fonctions pour utilisation globale
// ===========================================

window.registerActiveSession = registerActiveSession;
window.removeActiveSession = removeActiveSession;
window.isUserSessionActive = isUserSessionActive;
window.updateSessionActivity = updateSessionActivity;
window.handleLogin = handleLogin;
window.logout = logout;
window.handleRegister = handleRegister;
window.handleRoleChange = handleRoleChange;
window.showFirstLoginModal = showFirstLoginModal;
window.handleFirstLoginSubmit = handleFirstLoginSubmit;
window.showForgotPassword = showForgotPassword;
window.submitForgotPassword = submitForgotPassword;
window.showResetPasswordForm = showResetPasswordForm;
window.submitResetPassword = submitResetPassword;
