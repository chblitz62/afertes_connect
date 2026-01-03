/**
 * AFERTES Connect - Nouvelles fonctionnalités
 * Planning, Émargement, Évaluations, Dashboard formateur, Notifications
 */

// ==========================================
// ÉMARGEMENT / SIGNATURE ÉLECTRONIQUE
// ==========================================

let activeAttendanceSession = null;
let attendanceTimer = null;

// Démarrer une session d'émargement (formateur)
function startAttendance(e) {
    if (e) e.preventDefault();

    const formation = document.getElementById('att-formation').value;
    const promo = document.getElementById('att-promo').value;
    const courseName = document.getElementById('att-course-name').value;
    const duration = parseInt(document.getElementById('att-duration').value);
    const method = document.getElementById('att-method').value;

    if (!formation || !promo || !courseName) {
        showToast('Veuillez remplir tous les champs', 'error');
        return;
    }

    // Générer un code PIN aléatoire à 4 chiffres
    const pin = Math.floor(1000 + Math.random() * 9000).toString();

    activeAttendanceSession = {
        id: Date.now(),
        formation,
        promo,
        courseName,
        pin,
        method,
        startTime: new Date(),
        duration: duration * 60 * 1000, // en millisecondes
        signatures: [],
        trainerId: currentUser.id
    };

    // Sauvegarder la session
    const sessions = JSON.parse(localStorage.getItem('afertes_attendance_sessions') || '[]');
    sessions.push(activeAttendanceSession);
    localStorage.setItem('afertes_attendance_sessions', JSON.stringify(sessions));

    // Mettre à jour l'affichage
    document.querySelector('.start-attendance-card').classList.add('hidden');
    document.getElementById('active-attendance').classList.remove('hidden');

    document.getElementById('attendance-pin').textContent = pin;
    document.getElementById('attendance-course-info').textContent = `${courseName} - ${APP_CONFIG.formations[formation] || formation} (${promo})`;

    // Générer le QR code si nécessaire
    if (method === 'qr' || method === 'both') {
        generateQRCode(pin);
    }

    // Compter les étudiants de la promo
    const students = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const promoStudents = students.filter(u => u.role === 'student' && u.formation === formation);
    document.getElementById('total-students').textContent = promoStudents.length;

    // Démarrer le timer
    startAttendanceTimer(duration * 60);

    showToast('Émargement démarré !', 'success');

    // Notification aux étudiants (simulation)
    sendAttendanceNotification(formation, promo, courseName);
}

// Générer un QR code
function generateQRCode(data) {
    const canvas = document.getElementById('qr-canvas');
    if (!canvas) return;

    // Utiliser une librairie QR ou dessiner un placeholder
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 150, 150);
    ctx.fillStyle = '#000000';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('QR: ' + data, 75, 75);

    // Note: En production, utiliser qrcode.js ou similaire
    // QRCode.toCanvas(canvas, data);
}

// Timer d'émargement
function startAttendanceTimer(seconds) {
    let remaining = seconds;

    function updateTimer() {
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        document.getElementById('attendance-remaining').textContent =
            `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        if (remaining <= 0) {
            stopAttendance();
        } else {
            remaining--;
        }
    }

    updateTimer();
    attendanceTimer = setInterval(updateTimer, 1000);
}

// Arrêter la session d'émargement
function stopAttendance() {
    if (attendanceTimer) {
        clearInterval(attendanceTimer);
        attendanceTimer = null;
    }

    if (activeAttendanceSession) {
        activeAttendanceSession.endTime = new Date();

        // Mettre à jour dans le stockage
        const sessions = JSON.parse(localStorage.getItem('afertes_attendance_sessions') || '[]');
        const idx = sessions.findIndex(s => s.id === activeAttendanceSession.id);
        if (idx !== -1) {
            sessions[idx] = activeAttendanceSession;
            localStorage.setItem('afertes_attendance_sessions', JSON.stringify(sessions));
        }

        showToast(`Émargement terminé - ${activeAttendanceSession.signatures.length} signatures`, 'success');
    }

    activeAttendanceSession = null;

    // Réinitialiser l'affichage
    document.querySelector('.start-attendance-card').classList.remove('hidden');
    document.getElementById('active-attendance').classList.add('hidden');
    document.getElementById('live-signatures').innerHTML = '';
    document.getElementById('signed-count').textContent = '0';
}

// Soumettre un code d'émargement (étudiant)
function submitAttendanceCode() {
    const pin = document.getElementById('sign-pin-input').value;

    if (!pin || pin.length !== 4) {
        showToast('Veuillez entrer un code à 4 chiffres', 'error');
        return;
    }

    // Vérifier le code dans les sessions actives
    const sessions = JSON.parse(localStorage.getItem('afertes_attendance_sessions') || '[]');
    const now = new Date();

    const activeSession = sessions.find(s => {
        if (s.pin !== pin) return false;
        const start = new Date(s.startTime);
        const end = new Date(start.getTime() + s.duration);
        return now >= start && now <= end;
    });

    if (!activeSession) {
        showToast('Code invalide ou session expirée', 'error');
        return;
    }

    // Vérifier si l'étudiant n'a pas déjà signé
    if (activeSession.signatures.find(s => s.id === currentUser.id)) {
        showToast('Vous avez déjà signé pour ce cours', 'warning');
        return;
    }

    // Ajouter la signature
    activeSession.signatures.push({
        id: currentUser.id,
        name: `${currentUser.firstname} ${currentUser.lastname}`,
        time: new Date().toISOString()
    });

    // Sauvegarder
    const idx = sessions.findIndex(s => s.id === activeSession.id);
    sessions[idx] = activeSession;
    localStorage.setItem('afertes_attendance_sessions', JSON.stringify(sessions));

    // Enregistrer dans l'historique de l'étudiant
    const history = JSON.parse(localStorage.getItem(`afertes_attendance_${currentUser.id}`) || '[]');
    history.push({
        sessionId: activeSession.id,
        courseName: activeSession.courseName,
        date: new Date().toISOString(),
        status: 'present'
    });
    localStorage.setItem(`afertes_attendance_${currentUser.id}`, JSON.stringify(history));

    showToast('Présence enregistrée !', 'success');
    document.getElementById('sign-pin-input').value = '';

    // Recharger l'historique
    loadAttendanceHistory();
}

// Charger l'historique de présence (étudiant)
function loadAttendanceHistory() {
    const container = document.getElementById('attendance-history-list');
    if (!container || !currentUser) return;

    const history = JSON.parse(localStorage.getItem(`afertes_attendance_${currentUser.id}`) || '[]');

    // Calculer les stats
    const total = history.length;
    const present = history.filter(h => h.status === 'present').length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;

    document.getElementById('attendance-rate').textContent = rate + '%';
    document.getElementById('attended-hours').textContent = (present * 2) + 'h'; // 2h par cours en moyenne
    document.getElementById('missed-hours').textContent = ((total - present) * 2) + 'h';

    // Afficher l'historique
    if (history.length === 0) {
        container.innerHTML = '<p class="empty-message">Aucun historique de présence</p>';
        return;
    }

    container.innerHTML = history.slice(-20).reverse().map(h => `
        <div class="attendance-item ${h.status}">
            <div class="att-info">
                <strong>${h.courseName}</strong>
                <span>${new Date(h.date).toLocaleDateString('fr-FR')}</span>
            </div>
            <span class="att-status ${h.status}">
                ${h.status === 'present' ? '<i class="fas fa-check"></i> Présent' : '<i class="fas fa-times"></i> Absent'}
            </span>
        </div>
    `).join('');
}

// Vérifier s'il y a un cours en cours pour l'étudiant
function checkActiveAttendance() {
    if (!currentUser || currentUser.role !== 'student') return;

    const sessions = JSON.parse(localStorage.getItem('afertes_attendance_sessions') || '[]');
    const now = new Date();

    const activeSession = sessions.find(s => {
        if (s.formation !== currentUser.formation) return false;
        const start = new Date(s.startTime);
        const end = new Date(start.getTime() + s.duration);
        return now >= start && now <= end;
    });

    const currentSessionEl = document.getElementById('current-session');
    const signFormEl = document.getElementById('sign-attendance-form');

    if (activeSession) {
        // Il y a un cours en cours
        currentSessionEl.classList.add('hidden');
        signFormEl.classList.remove('hidden');
        document.getElementById('current-course-name').textContent = activeSession.courseName;
    } else {
        currentSessionEl.classList.remove('hidden');
        signFormEl.classList.add('hidden');
    }
}

// Notification d'émargement
function sendAttendanceNotification(formation, promo, courseName) {
    addNotification({
        type: 'attendance',
        title: 'Émargement ouvert',
        message: `Émargement disponible pour ${courseName}`,
        time: new Date().toISOString(),
        formation,
        promo
    });
}

// ==========================================
// ÉVALUATIONS EN LIGNE
// ==========================================

let currentEvaluation = null;
let currentQuestionIndex = 0;
let evalTimer = null;
let evalAnswers = {};
let questionCounter = 0;

// Afficher le modal de création d'évaluation
function showCreateEvaluation() {
    document.getElementById('create-evaluation-modal').classList.remove('hidden');
    document.getElementById('questions-container').innerHTML = '';
    questionCounter = 0;

    // Pré-remplir les dates
    const now = new Date();
    const later = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    document.getElementById('eval-start-date').value = now.toISOString().slice(0, 16);
    document.getElementById('eval-end-date').value = later.toISOString().slice(0, 16);
}

// Fermer le modal
function closeCreateEvaluation() {
    document.getElementById('create-evaluation-modal').classList.add('hidden');
}

// Ajouter une question
function addQuestion(type) {
    questionCounter++;
    const container = document.getElementById('questions-container');

    let optionsHtml = '';
    if (type === 'qcm') {
        optionsHtml = `
            <div class="options-list">
                <div class="option-row">
                    <input type="text" placeholder="Option A" class="option-input">
                    <label class="correct-toggle"><input type="radio" name="correct-${questionCounter}"> Correcte</label>
                    <button type="button" onclick="removeOption(this)" class="btn btn-icon btn-sm"><i class="fas fa-times"></i></button>
                </div>
                <div class="option-row">
                    <input type="text" placeholder="Option B" class="option-input">
                    <label class="correct-toggle"><input type="radio" name="correct-${questionCounter}"> Correcte</label>
                    <button type="button" onclick="removeOption(this)" class="btn btn-icon btn-sm"><i class="fas fa-times"></i></button>
                </div>
            </div>
            <button type="button" onclick="addOption(this)" class="btn btn-sm btn-secondary">
                <i class="fas fa-plus"></i> Ajouter option
            </button>
        `;
    } else if (type === 'truefalse') {
        optionsHtml = `
            <div class="options-list truefalse">
                <label class="correct-toggle">
                    <input type="radio" name="correct-${questionCounter}" value="true"> Vrai est la bonne réponse
                </label>
                <label class="correct-toggle">
                    <input type="radio" name="correct-${questionCounter}" value="false"> Faux est la bonne réponse
                </label>
            </div>
        `;
    } else {
        optionsHtml = `<p class="text-muted">Réponse libre - correction manuelle requise</p>`;
    }

    const questionHtml = `
        <div class="question-card" data-type="${type}" data-id="${questionCounter}">
            <div class="question-header">
                <span class="question-number">Question ${questionCounter}</span>
                <span class="question-type-badge">${type === 'qcm' ? 'QCM' : type === 'truefalse' ? 'Vrai/Faux' : 'Texte'}</span>
                <div class="question-actions">
                    <button type="button" onclick="moveQuestion(this, -1)" class="btn btn-icon btn-sm"><i class="fas fa-arrow-up"></i></button>
                    <button type="button" onclick="moveQuestion(this, 1)" class="btn btn-icon btn-sm"><i class="fas fa-arrow-down"></i></button>
                    <button type="button" onclick="removeQuestion(this)" class="btn btn-icon btn-sm btn-danger"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <div class="form-group">
                <label>Énoncé de la question</label>
                <textarea class="question-text" rows="2" placeholder="Tapez votre question ici..." required></textarea>
            </div>
            <div class="form-group">
                <label>Points</label>
                <input type="number" class="question-points" value="1" min="0.5" max="20" step="0.5" style="width: 80px;">
            </div>
            ${optionsHtml}
        </div>
    `;

    container.insertAdjacentHTML('beforeend', questionHtml);
}

// Ajouter une option à un QCM
function addOption(btn) {
    const optionsList = btn.previousElementSibling;
    const questionCard = btn.closest('.question-card');
    const qId = questionCard.dataset.id;
    const optionCount = optionsList.querySelectorAll('.option-row').length;
    const letter = String.fromCharCode(65 + optionCount); // A, B, C, D...

    const optionHtml = `
        <div class="option-row">
            <input type="text" placeholder="Option ${letter}" class="option-input">
            <label class="correct-toggle"><input type="radio" name="correct-${qId}"> Correcte</label>
            <button type="button" onclick="removeOption(this)" class="btn btn-icon btn-sm"><i class="fas fa-times"></i></button>
        </div>
    `;
    optionsList.insertAdjacentHTML('beforeend', optionHtml);
}

// Supprimer une option
function removeOption(btn) {
    const optionsList = btn.closest('.options-list');
    if (optionsList.querySelectorAll('.option-row').length > 2) {
        btn.closest('.option-row').remove();
    } else {
        showToast('Minimum 2 options requises', 'warning');
    }
}

// Supprimer une question
function removeQuestion(btn) {
    btn.closest('.question-card').remove();
    renumberQuestions();
}

// Renuméroter les questions
function renumberQuestions() {
    const questions = document.querySelectorAll('.question-card');
    questions.forEach((q, i) => {
        q.querySelector('.question-number').textContent = `Question ${i + 1}`;
    });
}

// Sauvegarder l'évaluation
function saveEvaluation(asDraft = false) {
    const title = document.getElementById('eval-title').value;
    const formation = document.getElementById('eval-formation').value;
    const promo = document.getElementById('eval-promo').value;
    const duration = parseInt(document.getElementById('eval-duration').value);
    const startDate = document.getElementById('eval-start-date').value;
    const endDate = document.getElementById('eval-end-date').value;
    const shuffle = document.getElementById('eval-shuffle-questions').checked;
    const showResults = document.getElementById('eval-show-results').checked;

    if (!title || !formation || !promo) {
        showToast('Veuillez remplir les informations générales', 'error');
        return null;
    }

    // Collecter les questions
    const questionCards = document.querySelectorAll('.question-card');
    if (questionCards.length === 0 && !asDraft) {
        showToast('Ajoutez au moins une question', 'error');
        return null;
    }

    const questions = [];
    questionCards.forEach((card, idx) => {
        const type = card.dataset.type;
        const text = card.querySelector('.question-text').value;
        const points = parseFloat(card.querySelector('.question-points').value);

        const question = { id: idx + 1, type, text, points };

        if (type === 'qcm') {
            question.options = [];
            card.querySelectorAll('.option-row').forEach((row, optIdx) => {
                const optText = row.querySelector('.option-input').value;
                const isCorrect = row.querySelector('input[type="radio"]').checked;
                question.options.push({ text: optText, correct: isCorrect });
            });
        } else if (type === 'truefalse') {
            const correctValue = card.querySelector('input[name^="correct-"]:checked');
            question.correctAnswer = correctValue ? correctValue.value === 'true' : null;
        }

        questions.push(question);
    });

    const evaluation = {
        id: Date.now(),
        title,
        formation,
        promo,
        duration,
        startDate,
        endDate,
        shuffle,
        showResults,
        questions,
        status: asDraft ? 'draft' : 'active',
        createdBy: currentUser.id,
        createdAt: new Date().toISOString(),
        submissions: []
    };

    // Sauvegarder
    const evaluations = JSON.parse(localStorage.getItem('afertes_evaluations') || '[]');
    evaluations.push(evaluation);
    localStorage.setItem('afertes_evaluations', JSON.stringify(evaluations));

    return evaluation;
}

// Sauvegarder comme brouillon
function saveEvaluationDraft() {
    const savedEval = saveEvaluation(true);
    if (savedEval) {
        showToast('Brouillon enregistré', 'success');
        closeCreateEvaluation();
        loadTrainerEvaluations();
    }
}

// Publier l'évaluation
document.getElementById('create-evaluation-form')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const savedEval = saveEvaluation(false);
    if (savedEval) {
        showToast('Évaluation publiée !', 'success');
        closeCreateEvaluation();
        loadTrainerEvaluations();

        // Notification aux étudiants
        addNotification({
            type: 'eval',
            title: 'Nouvelle évaluation',
            message: `${savedEval.title} disponible jusqu'au ${new Date(savedEval.endDate).toLocaleDateString('fr-FR')}`,
            evalId: savedEval.id
        });
    }
});

// Charger les évaluations (étudiant)
function loadStudentEvaluations(filter = 'pending') {
    const container = document.getElementById('student-evaluations');
    if (!container || !currentUser) return;

    const evaluations = JSON.parse(localStorage.getItem('afertes_evaluations') || '[]');
    const now = new Date();

    const filtered = evaluations.filter(e => {
        if (e.status !== 'active') return false;
        if (e.formation !== currentUser.formation) return false;

        const hasSubmitted = e.submissions?.some(s => s.studentId === currentUser.id);

        if (filter === 'pending') {
            return !hasSubmitted && new Date(e.endDate) > now;
        } else {
            return hasSubmitted;
        }
    });

    if (filtered.length === 0) {
        container.innerHTML = `<p class="empty-message">Aucune évaluation ${filter === 'pending' ? 'à faire' : 'terminée'}</p>`;
        return;
    }

    container.innerHTML = filtered.map(e => {
        const submission = e.submissions?.find(s => s.studentId === currentUser.id);
        return `
            <div class="evaluation-card ${submission ? 'completed' : ''}">
                <div class="eval-info">
                    <h4>${e.title}</h4>
                    <p>${e.questions.length} questions - ${e.duration} minutes</p>
                    <div class="eval-meta">
                        <span><i class="fas fa-clock"></i> Jusqu'au ${new Date(e.endDate).toLocaleDateString('fr-FR')}</span>
                        ${submission ? `<span><i class="fas fa-star"></i> Note: ${submission.score}/${submission.maxScore}</span>` : ''}
                    </div>
                </div>
                <div class="eval-actions">
                    ${submission ?
                        `<button class="btn btn-secondary" onclick="viewEvalResults(${e.id})">
                            <i class="fas fa-eye"></i> Voir résultats
                        </button>` :
                        `<button class="btn btn-primary" onclick="startEvaluation(${e.id})">
                            <i class="fas fa-play"></i> Commencer
                        </button>`
                    }
                </div>
            </div>
        `;
    }).join('');

    // Mettre à jour le badge
    const pendingCount = evaluations.filter(e =>
        e.status === 'active' &&
        e.formation === currentUser.formation &&
        !e.submissions?.some(s => s.studentId === currentUser.id) &&
        new Date(e.endDate) > now
    ).length;
    document.getElementById('pending-evals-count').textContent = pendingCount;
}

// Charger les évaluations (formateur)
function loadTrainerEvaluations(filter = 'active') {
    const container = document.getElementById('trainer-evaluations');
    if (!container || !currentUser) return;

    const evaluations = JSON.parse(localStorage.getItem('afertes_evaluations') || '[]');

    const filtered = evaluations.filter(e => {
        if (e.createdBy !== currentUser.id) return false;
        return e.status === filter || (filter === 'completed' && e.status === 'archived');
    });

    if (filtered.length === 0) {
        container.innerHTML = `<p class="empty-message">Aucune évaluation</p>`;
        return;
    }

    container.innerHTML = filtered.map(e => `
        <div class="evaluation-card">
            <div class="eval-info">
                <h4>${e.title}</h4>
                <p>${APP_CONFIG.formations[e.formation] || e.formation} - ${e.promo}</p>
                <div class="eval-meta">
                    <span><i class="fas fa-users"></i> ${e.submissions?.length || 0} soumissions</span>
                    <span><i class="fas fa-question-circle"></i> ${e.questions.length} questions</span>
                </div>
            </div>
            <div class="eval-actions">
                <button class="btn btn-secondary btn-sm" onclick="viewEvalSubmissions(${e.id})">
                    <i class="fas fa-list"></i> Résultats
                </button>
                <button class="btn btn-secondary btn-sm" onclick="editEvaluation(${e.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteEvaluation(${e.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// Démarrer une évaluation
function startEvaluation(evalId) {
    const evaluations = JSON.parse(localStorage.getItem('afertes_evaluations') || '[]');
    currentEvaluation = evaluations.find(e => e.id === evalId);

    if (!currentEvaluation) {
        showToast('Évaluation non trouvée', 'error');
        return;
    }

    // Mélanger les questions si activé
    if (currentEvaluation.shuffle) {
        currentEvaluation.questions = shuffleArray([...currentEvaluation.questions]);
    }

    currentQuestionIndex = 0;
    evalAnswers = {};

    // Afficher le modal
    document.getElementById('take-evaluation-modal').classList.remove('hidden');
    document.getElementById('eval-taking-title').textContent = currentEvaluation.title;

    // Créer les points de navigation
    const navDots = document.getElementById('question-nav-dots');
    navDots.innerHTML = currentEvaluation.questions.map((_, i) =>
        `<span class="dot ${i === 0 ? 'current' : ''}" onclick="goToQuestion(${i})"></span>`
    ).join('');

    // Afficher la première question
    displayQuestion(0);

    // Démarrer le timer
    startEvalTimer(currentEvaluation.duration * 60);
}

// Afficher une question
function displayQuestion(index) {
    const question = currentEvaluation.questions[index];
    const container = document.getElementById('eval-question-container');

    document.getElementById('eval-taking-progress').textContent =
        `Question ${index + 1}/${currentEvaluation.questions.length}`;

    const progressPercent = ((index + 1) / currentEvaluation.questions.length) * 100;
    document.getElementById('eval-progress-fill').style.width = progressPercent + '%';

    let optionsHtml = '';
    const savedAnswer = evalAnswers[question.id];

    if (question.type === 'qcm') {
        optionsHtml = question.options.map((opt, i) => `
            <div class="option ${savedAnswer === i ? 'selected' : ''}"
                 onclick="selectOption(${question.id}, ${i})">
                ${String.fromCharCode(65 + i)}. ${opt.text}
            </div>
        `).join('');
    } else if (question.type === 'truefalse') {
        optionsHtml = `
            <div class="option ${savedAnswer === true ? 'selected' : ''}"
                 onclick="selectOption(${question.id}, true)">
                Vrai
            </div>
            <div class="option ${savedAnswer === false ? 'selected' : ''}"
                 onclick="selectOption(${question.id}, false)">
                Faux
            </div>
        `;
    } else {
        optionsHtml = `
            <textarea class="text-answer" id="text-answer-${question.id}"
                      placeholder="Tapez votre réponse..."
                      onchange="saveTextAnswer(${question.id})">${savedAnswer || ''}</textarea>
        `;
    }

    container.innerHTML = `
        <div class="question-display">
            <div class="question-text">${question.text}</div>
            <div class="options">${optionsHtml}</div>
        </div>
    `;

    // Mettre à jour la navigation
    updateQuestionNav();
    updateNavButtons();
}

// Sélectionner une option
function selectOption(questionId, value) {
    evalAnswers[questionId] = value;
    displayQuestion(currentQuestionIndex);
}

// Sauvegarder réponse texte
function saveTextAnswer(questionId) {
    const textarea = document.getElementById(`text-answer-${questionId}`);
    evalAnswers[questionId] = textarea.value;
    updateQuestionNav();
}

// Navigation entre questions
function prevEvalQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        displayQuestion(currentQuestionIndex);
    }
}

function nextEvalQuestion() {
    if (currentQuestionIndex < currentEvaluation.questions.length - 1) {
        currentQuestionIndex++;
        displayQuestion(currentQuestionIndex);
    }
}

function goToQuestion(index) {
    currentQuestionIndex = index;
    displayQuestion(index);
}

// Mettre à jour les boutons de navigation
function updateNavButtons() {
    document.getElementById('btn-prev-question').disabled = currentQuestionIndex === 0;

    const isLast = currentQuestionIndex === currentEvaluation.questions.length - 1;
    document.getElementById('btn-next-question').classList.toggle('hidden', isLast);
    document.getElementById('btn-submit-eval').classList.toggle('hidden', !isLast);
}

// Mettre à jour les points de navigation
function updateQuestionNav() {
    const dots = document.querySelectorAll('#question-nav-dots .dot');
    dots.forEach((dot, i) => {
        dot.classList.remove('current');
        if (i === currentQuestionIndex) dot.classList.add('current');
        if (evalAnswers[currentEvaluation.questions[i].id] !== undefined) {
            dot.classList.add('answered');
        }
    });
}

// Timer d'évaluation
function startEvalTimer(seconds) {
    let remaining = seconds;

    function updateTimer() {
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        document.getElementById('eval-timer-display').textContent =
            `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        if (remaining <= 0) {
            submitEvaluation();
        } else if (remaining <= 60) {
            document.getElementById('eval-timer-display').style.color = '#e74c3c';
        }
        remaining--;
    }

    updateTimer();
    evalTimer = setInterval(updateTimer, 1000);
}

// Soumettre l'évaluation
function submitEvaluation() {
    if (evalTimer) {
        clearInterval(evalTimer);
        evalTimer = null;
    }

    // Calculer le score
    let score = 0;
    let maxScore = 0;

    currentEvaluation.questions.forEach(q => {
        maxScore += q.points;
        const answer = evalAnswers[q.id];

        if (q.type === 'qcm' && answer !== undefined) {
            if (q.options[answer]?.correct) score += q.points;
        } else if (q.type === 'truefalse' && answer !== undefined) {
            if (answer === q.correctAnswer) score += q.points;
        }
        // Les réponses texte nécessitent une correction manuelle
    });

    // Enregistrer la soumission
    const submission = {
        studentId: currentUser.id,
        studentName: `${currentUser.firstname} ${currentUser.lastname}`,
        answers: evalAnswers,
        score,
        maxScore,
        submittedAt: new Date().toISOString()
    };

    const evaluations = JSON.parse(localStorage.getItem('afertes_evaluations') || '[]');
    const idx = evaluations.findIndex(e => e.id === currentEvaluation.id);
    if (idx !== -1) {
        if (!evaluations[idx].submissions) evaluations[idx].submissions = [];
        evaluations[idx].submissions.push(submission);
        localStorage.setItem('afertes_evaluations', JSON.stringify(evaluations));
    }

    // Fermer et afficher le résultat
    document.getElementById('take-evaluation-modal').classList.add('hidden');

    if (currentEvaluation.showResults) {
        showToast(`Évaluation terminée ! Score: ${score}/${maxScore}`, 'success');
    } else {
        showToast('Évaluation soumise avec succès !', 'success');
    }

    currentEvaluation = null;
    loadStudentEvaluations();
}

// Mélanger un tableau
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// ==========================================
// TABLEAU DE BORD FORMATEUR
// ==========================================

function loadTrainerDashboard() {
    if (!currentUser || currentUser.role !== 'teacher') return;

    loadTrainerStats();
    loadUpcomingCourses();
    loadTrainerAlerts();
    loadTrainerGroups();
}

function loadTrainerStats() {
    // Compter les étudiants
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const students = users.filter(u => u.role === 'student');
    document.getElementById('trainer-total-students').textContent = students.length;

    // Cours cette semaine (simulation)
    document.getElementById('trainer-sessions-week').textContent = Math.floor(Math.random() * 10) + 5;

    // Notes à saisir
    document.getElementById('trainer-pending-grades').textContent = Math.floor(Math.random() * 20);

    // Présence moyenne
    document.getElementById('trainer-avg-attendance').textContent = (85 + Math.floor(Math.random() * 10)) + '%';
}

function loadUpcomingCourses() {
    const container = document.getElementById('trainer-upcoming-courses');
    if (!container) return;

    // Simulation de cours
    const courses = [
        { time: '09:00', title: 'Psychologie du développement', group: 'ES 2024', room: 'Salle 201' },
        { time: '14:00', title: 'Méthodologie de projet', group: 'ME 2023', room: 'Salle 105' },
        { time: '16:00', title: 'Accompagnement éducatif', group: 'AES 2024', room: 'Salle 302' }
    ];

    container.innerHTML = courses.map(c => `
        <div class="upcoming-course">
            <div class="course-time">${c.time}</div>
            <div class="course-info">
                <h4>${c.title}</h4>
                <p>${c.group} - ${c.room}</p>
            </div>
            <button class="btn btn-sm btn-primary" onclick="showPage('attendance')">
                <i class="fas fa-user-check"></i>
            </button>
        </div>
    `).join('');
}

function loadTrainerAlerts() {
    const container = document.getElementById('trainer-alerts');
    if (!container) return;

    const alerts = [
        { type: 'warning', icon: 'exclamation-triangle', text: '3 étudiants avec + de 3 absences non justifiées' },
        { type: 'danger', icon: 'clipboard', text: '5 notes à saisir avant le 15/01' },
        { type: 'warning', icon: 'user-clock', text: 'Évaluation ME 2023 expire dans 2 jours' }
    ];

    container.innerHTML = alerts.map(a => `
        <div class="alert-item ${a.type}">
            <i class="fas fa-${a.icon} alert-icon"></i>
            <span>${a.text}</span>
        </div>
    `).join('');
}

function loadTrainerGroups() {
    const container = document.getElementById('trainer-groups');
    if (!container) return;

    const groups = [
        { code: 'ES', name: 'Éducateur Spécialisé', promo: '2024', count: 28 },
        { code: 'ME', name: 'Moniteur Éducateur', promo: '2023', count: 24 },
        { code: 'AES', name: 'AES', promo: '2024', count: 18 }
    ];

    container.innerHTML = groups.map(g => `
        <div class="group-item">
            <div class="group-info">
                <div class="group-avatar">${g.code}</div>
                <div>
                    <strong>${g.name}</strong>
                    <span class="text-muted">${g.promo} - ${g.count} étudiants</span>
                </div>
            </div>
            <button class="btn btn-sm btn-secondary" onclick="viewGroup('${g.code}', '${g.promo}')">
                <i class="fas fa-arrow-right"></i>
            </button>
        </div>
    `).join('');
}

// Modal saisie rapide des notes
function openQuickGradeModal() {
    const group = document.getElementById('quick-grade-group').value;
    const subject = document.getElementById('quick-grade-subject').value;

    if (!group) {
        showToast('Sélectionnez un groupe', 'warning');
        return;
    }

    document.getElementById('qg-info').textContent = `${group} - ${subject || 'Matière non spécifiée'}`;
    document.getElementById('quick-grade-modal').classList.remove('hidden');

    // Charger les étudiants du groupe
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const students = users.filter(u => u.role === 'student').slice(0, 20); // Simulation

    const tbody = document.getElementById('quick-grade-tbody');
    tbody.innerHTML = students.map(s => `
        <tr data-student-id="${s.id}">
            <td>${s.lastname} ${s.firstname}</td>
            <td><input type="number" class="grade-input" min="0" max="20" step="0.5"></td>
            <td><input type="checkbox" class="absent-check"></td>
            <td><input type="text" class="comment-input" placeholder="Commentaire..."></td>
        </tr>
    `).join('');
}

function closeQuickGradeModal() {
    document.getElementById('quick-grade-modal').classList.add('hidden');
}

function saveQuickGrades() {
    const rows = document.querySelectorAll('#quick-grade-tbody tr');
    let savedCount = 0;

    rows.forEach(row => {
        const studentId = row.dataset.studentId;
        const grade = row.querySelector('.grade-input').value;
        const absent = row.querySelector('.absent-check').checked;
        const comment = row.querySelector('.comment-input').value;

        if (grade || absent) {
            // Sauvegarder la note
            const grades = JSON.parse(localStorage.getItem('afertes_grades') || '[]');
            grades.push({
                studentId,
                grade: absent ? null : parseFloat(grade),
                absent,
                comment,
                date: new Date().toISOString(),
                trainerId: currentUser.id
            });
            localStorage.setItem('afertes_grades', JSON.stringify(grades));
            savedCount++;
        }
    });

    showToast(`${savedCount} notes enregistrées`, 'success');
    closeQuickGradeModal();
}

// ==========================================
// NOTIFICATIONS PUSH
// ==========================================

let notifications = [];

// Initialiser les notifications
function initNotifications() {
    // Charger les notifications
    notifications = JSON.parse(localStorage.getItem(`afertes_notifs_${currentUser?.id}`) || '[]');

    // Demander la permission pour les notifications push
    if ('Notification' in window && Notification.permission === 'default') {
        document.getElementById('notif-push')?.addEventListener('change', function() {
            if (this.checked) {
                Notification.requestPermission();
            }
        });
    }

    updateNotificationBadge();
}

// Ajouter une notification
function addNotification(notif) {
    const notification = {
        id: Date.now(),
        ...notif,
        time: notif.time || new Date().toISOString(),
        read: false
    };

    notifications.unshift(notification);

    // Sauvegarder pour l'utilisateur concerné
    if (notif.formation && notif.promo) {
        // Notification de groupe - sauvegarder pour tous les étudiants
        const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
        users.filter(u => u.role === 'student' && u.formation === notif.formation).forEach(u => {
            const userNotifs = JSON.parse(localStorage.getItem(`afertes_notifs_${u.id}`) || '[]');
            userNotifs.unshift(notification);
            localStorage.setItem(`afertes_notifs_${u.id}`, JSON.stringify(userNotifs.slice(0, 50)));
        });
    } else if (currentUser) {
        localStorage.setItem(`afertes_notifs_${currentUser.id}`, JSON.stringify(notifications.slice(0, 50)));
    }

    updateNotificationBadge();
    showPushNotification(notification);
}

// Afficher notification push navigateur
function showPushNotification(notif) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('AFERTES Connect', {
            body: notif.message,
            icon: 'img/logo-afertes.png',
            tag: notif.id
        });
    }
}

// Mettre à jour le badge de notification
function updateNotificationBadge() {
    const unreadCount = notifications.filter(n => !n.read).length;
    const badge = document.getElementById('nav-notif-badge');

    if (badge) {
        badge.textContent = unreadCount;
        badge.classList.toggle('hidden', unreadCount === 0);
    }
}

// Charger la page notifications
function loadNotifications(filter = 'all') {
    const container = document.getElementById('notifications-list');
    if (!container) return;

    let filtered = notifications;
    if (filter === 'unread') {
        filtered = notifications.filter(n => !n.read);
    } else if (filter !== 'all') {
        filtered = notifications.filter(n => n.type === filter);
    }

    if (filtered.length === 0) {
        container.innerHTML = '<p class="empty-message">Aucune notification</p>';
        return;
    }

    container.innerHTML = filtered.map(n => `
        <div class="notification-item ${n.read ? '' : 'unread'}" onclick="markNotificationRead(${n.id})">
            <div class="notif-icon ${n.type}">
                <i class="fas fa-${getNotifIcon(n.type)}"></i>
            </div>
            <div class="notif-content">
                <h4>${n.title}</h4>
                <p>${n.message}</p>
            </div>
            <span class="notif-time">${formatNotifTime(n.time)}</span>
        </div>
    `).join('');
}

function getNotifIcon(type) {
    const icons = {
        grade: 'star',
        schedule: 'calendar-alt',
        message: 'envelope',
        eval: 'tasks',
        attendance: 'user-check'
    };
    return icons[type] || 'bell';
}

function formatNotifTime(time) {
    const date = new Date(time);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'À l\'instant';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' min';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' h';
    return date.toLocaleDateString('fr-FR');
}

// Marquer comme lu
function markNotificationRead(id) {
    const notif = notifications.find(n => n.id === id);
    if (notif) {
        notif.read = true;
        localStorage.setItem(`afertes_notifs_${currentUser.id}`, JSON.stringify(notifications));
        updateNotificationBadge();
        loadNotifications();
    }
}

// Tout marquer comme lu
function markAllNotificationsRead() {
    notifications.forEach(n => n.read = true);
    localStorage.setItem(`afertes_notifs_${currentUser.id}`, JSON.stringify(notifications));
    updateNotificationBadge();
    loadNotifications();
    showToast('Toutes les notifications marquées comme lues', 'success');
}

// Toggle paramètres notifications
function toggleNotificationSettings() {
    const panel = document.getElementById('notification-settings-panel');
    panel.classList.toggle('hidden');
}

// Filtrer notifications
function filterNotifications(filter) {
    document.querySelectorAll('.notifications-filter .filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.toLowerCase().includes(filter) ||
            (filter === 'all' && btn.textContent === 'Toutes'));
    });
    loadNotifications(filter);
}

// ==========================================
// INITIALISATION
// ==========================================

// Initialiser les formulaires
document.addEventListener('DOMContentLoaded', function() {
    // Formulaire d'émargement
    document.getElementById('start-attendance-form')?.addEventListener('submit', startAttendance);

    // Vérifier périodiquement les émargements actifs
    setInterval(checkActiveAttendance, 30000);
});

// Exporter les fonctions globalement
window.startAttendance = startAttendance;
window.stopAttendance = stopAttendance;
window.submitAttendanceCode = submitAttendanceCode;
window.loadAttendanceHistory = loadAttendanceHistory;
window.showCreateEvaluation = showCreateEvaluation;
window.closeCreateEvaluation = closeCreateEvaluation;
window.addQuestion = addQuestion;
window.addOption = addOption;
window.removeOption = removeOption;
window.removeQuestion = removeQuestion;
window.saveEvaluationDraft = saveEvaluationDraft;
window.startEvaluation = startEvaluation;
window.prevEvalQuestion = prevEvalQuestion;
window.nextEvalQuestion = nextEvalQuestion;
window.goToQuestion = goToQuestion;
window.submitEvaluation = submitEvaluation;
window.selectOption = selectOption;
window.saveTextAnswer = saveTextAnswer;
window.loadStudentEvaluations = loadStudentEvaluations;
window.loadTrainerEvaluations = loadTrainerEvaluations;
window.filterEvaluations = loadStudentEvaluations;
window.filterTrainerEvaluations = loadTrainerEvaluations;
window.loadTrainerDashboard = loadTrainerDashboard;
window.openQuickGradeModal = openQuickGradeModal;
window.closeQuickGradeModal = closeQuickGradeModal;
window.saveQuickGrades = saveQuickGrades;
window.initNotifications = initNotifications;
window.addNotification = addNotification;
window.loadNotifications = loadNotifications;
window.markNotificationRead = markNotificationRead;
window.markAllNotificationsRead = markAllNotificationsRead;
window.toggleNotificationSettings = toggleNotificationSettings;
window.filterNotifications = filterNotifications;

// ==========================================
// DOCUMENTS ÉTUDIANTS (Formateur/Secrétaire)
// ==========================================

// Charger la liste des documents étudiants
function loadStudentsDocuments() {
    const tbody = document.getElementById('students-documents-tbody');
    if (!tbody) return;

    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const students = users.filter(u => u.role === 'student');

    let completeCount = 0;
    let incompleteCount = 0;

    tbody.innerHTML = students.map(student => {
        // Vérifier les documents de l'étudiant
        const docs = student.documents || {};
        const hasIdentity = !!docs.identity;
        const hasVitale = !!docs.vitale;
        const hasPhoto = !!docs.photo;
        const isComplete = hasIdentity && hasVitale && hasPhoto;

        if (isComplete) completeCount++;
        else incompleteCount++;

        const docIcon = (has) => has
            ? '<i class="fas fa-check-circle text-success"></i>'
            : '<i class="fas fa-times-circle text-danger"></i>';

        return `
            <tr data-student-id="${student.id}" data-formation="${student.formation || ''}" data-complete="${isComplete}">
                <td><strong>${student.lastname || '--'} ${student.firstname || '--'}</strong></td>
                <td>${APP_CONFIG.formations[student.formation] || student.formation || '--'}</td>
                <td class="text-center">${docIcon(hasIdentity)}</td>
                <td class="text-center">${docIcon(hasVitale)}</td>
                <td class="text-center">${docIcon(hasPhoto)}</td>
                <td>
                    <span class="badge ${isComplete ? 'badge-success' : 'badge-warning'}">
                        ${isComplete ? 'Complet' : 'Incomplet'}
                    </span>
                </td>
                <td>
                    <button onclick="viewStudentDocsModal('${student.id}')" class="btn btn-sm btn-primary">
                        <i class="fas fa-eye"></i> Voir
                    </button>
                    ${isComplete ? `
                        <button onclick="downloadAllDocs('${student.id}')" class="btn btn-sm btn-secondary">
                            <i class="fas fa-download"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');

    // Mettre à jour les stats
    document.getElementById('docs-total-students').textContent = students.length;
    document.getElementById('docs-complete').textContent = completeCount;
    document.getElementById('docs-incomplete').textContent = incompleteCount;
    const percentage = students.length > 0 ? Math.round((completeCount / students.length) * 100) : 0;
    document.getElementById('docs-percentage').textContent = percentage + '%';
}

// Filtrer les documents étudiants
function filterStudentsDocuments() {
    const formation = document.getElementById('docs-formation-filter').value;
    const status = document.getElementById('docs-status-filter').value;
    const search = document.getElementById('docs-search').value.toLowerCase();

    const rows = document.querySelectorAll('#students-documents-tbody tr');

    rows.forEach(row => {
        const studentFormation = row.dataset.formation;
        const isComplete = row.dataset.complete === 'true';
        const studentName = row.querySelector('td:first-child').textContent.toLowerCase();

        let show = true;

        if (formation && studentFormation !== formation) show = false;
        if (status === 'complete' && !isComplete) show = false;
        if (status === 'incomplete' && isComplete) show = false;
        if (search && !studentName.includes(search)) show = false;

        row.style.display = show ? '' : 'none';
    });
}

// Ouvrir le modal avec les documents d'un étudiant
function viewStudentDocsModal(studentId) {
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const student = users.find(u => u.id === studentId || u.id === parseInt(studentId));

    if (!student) {
        showToast('Étudiant non trouvé', 'error');
        return;
    }

    document.getElementById('modal-student-name').textContent = `${student.firstname} ${student.lastname}`;

    const docs = student.documents || {};
    const grid = document.getElementById('modal-docs-grid');

    const docTypes = [
        { key: 'identity', icon: 'fa-id-card', label: 'Pièce d\'identité' },
        { key: 'vitale', icon: 'fa-heart', label: 'Carte Vitale' },
        { key: 'photo', icon: 'fa-camera', label: 'Photo d\'identité' }
    ];

    grid.innerHTML = docTypes.map(type => {
        const doc = docs[type.key];
        return `
            <div class="doc-card ${doc ? 'has-doc' : 'no-doc'}">
                <div class="doc-icon">
                    <i class="fas ${type.icon}"></i>
                </div>
                <h4>${type.label}</h4>
                ${doc ? `
                    <p class="doc-status success"><i class="fas fa-check"></i> Fourni</p>
                    <div class="doc-preview">
                        ${doc.startsWith('data:image')
                            ? `<img src="${doc}" alt="${type.label}" onclick="openDocFullscreen('${doc}')">`
                            : `<i class="fas fa-file-pdf"></i>`
                        }
                    </div>
                    <div class="doc-actions">
                        <button onclick="openDocFullscreen('${doc}')" class="btn btn-sm btn-primary">
                            <i class="fas fa-expand"></i> Agrandir
                        </button>
                        <a href="${doc}" download="${student.lastname}_${type.key}" class="btn btn-sm btn-secondary">
                            <i class="fas fa-download"></i> Télécharger
                        </a>
                    </div>
                ` : `
                    <p class="doc-status danger"><i class="fas fa-times"></i> Non fourni</p>
                `}
            </div>
        `;
    }).join('');

    // Ajouter les informations personnelles
    grid.innerHTML += `
        <div class="doc-card student-info-card">
            <div class="doc-icon">
                <i class="fas fa-user"></i>
            </div>
            <h4>Informations personnelles</h4>
            <ul class="info-list">
                <li><strong>Email:</strong> ${student.email || '--'}</li>
                <li><strong>Téléphone:</strong> ${student.phone || '--'}</li>
                <li><strong>Date de naissance:</strong> ${student.birthDate || '--'}</li>
                <li><strong>N° Sécu:</strong> ${student.socialSecurityNumber ? '•••••' + student.socialSecurityNumber.slice(-4) : '--'}</li>
                <li><strong>Adresse:</strong> ${student.address || '--'}</li>
                <li><strong>CP/Ville:</strong> ${student.postalCode || '--'} ${student.city || '--'}</li>
            </ul>
        </div>
    `;

    document.getElementById('view-student-docs-modal').classList.remove('hidden');
}

// Fermer le modal
function closeStudentDocsModal() {
    document.getElementById('view-student-docs-modal').classList.add('hidden');
}

// Ouvrir un document en plein écran
function openDocFullscreen(docData) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay fullscreen-doc';
    modal.onclick = () => modal.remove();
    modal.innerHTML = `
        <div class="fullscreen-content" onclick="event.stopPropagation()">
            <button class="close-fullscreen" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
            ${docData.startsWith('data:image')
                ? `<img src="${docData}" alt="Document">`
                : `<iframe src="${docData}"></iframe>`
            }
        </div>
    `;
    document.body.appendChild(modal);
}

// Exporter le rapport des documents
function exportDocumentsReport() {
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const students = users.filter(u => u.role === 'student');

    const data = students.map(s => {
        const docs = s.documents || {};
        return {
            'Nom': s.lastname || '',
            'Prénom': s.firstname || '',
            'Email': s.email || '',
            'Formation': APP_CONFIG.formations[s.formation] || s.formation || '',
            'Pièce d\'identité': docs.identity ? 'Oui' : 'Non',
            'Carte Vitale': docs.vitale ? 'Oui' : 'Non',
            'Photo': docs.photo ? 'Oui' : 'Non',
            'Dossier complet': (docs.identity && docs.vitale && docs.photo) ? 'Oui' : 'Non'
        };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Documents étudiants');
    XLSX.writeFile(wb, `documents_etudiants_${new Date().toISOString().split('T')[0]}.xlsx`);

    showToast('Export Excel téléchargé', 'success');
}

// ==========================================
// FONCTIONS UTILITAIRES MANQUANTES
// ==========================================

// Déplacer une question dans le formulaire de création d'évaluation
function moveQuestion(btn, direction) {
    const card = btn.closest('.question-card');
    const container = document.getElementById('questions-container');
    const cards = Array.from(container.querySelectorAll('.question-card'));
    const currentIndex = cards.indexOf(card);
    const newIndex = currentIndex + direction;

    if (newIndex < 0 || newIndex >= cards.length) return;

    if (direction === -1 && currentIndex > 0) {
        container.insertBefore(card, cards[currentIndex - 1]);
    } else if (direction === 1 && currentIndex < cards.length - 1) {
        container.insertBefore(cards[currentIndex + 1], card);
    }

    renumberQuestions();
}

// Voir les résultats d'une évaluation (étudiant)
function viewEvalResults(evalId) {
    const evaluations = JSON.parse(localStorage.getItem('afertes_evaluations') || '[]');
    const evaluation = evaluations.find(e => e.id === evalId);

    if (!evaluation) {
        showToast('Évaluation non trouvée', 'error');
        return;
    }

    const submission = evaluation.submissions?.find(s => s.studentId === currentUser.id);
    if (!submission) {
        showToast('Aucun résultat trouvé', 'error');
        return;
    }

    // Créer un modal pour afficher les résultats
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'eval-results-modal';
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2><i class="fas fa-chart-bar"></i> Résultats - ${escapeHtml(evaluation.title)}</h2>
                <button onclick="this.closest('.modal-overlay').remove()" class="close-btn">&times;</button>
            </div>
            <div class="modal-body">
                <div class="eval-result-summary">
                    <div class="result-score">
                        <span class="score-value">${submission.score}</span>
                        <span class="score-max">/ ${submission.maxScore}</span>
                    </div>
                    <p class="result-percentage">${Math.round((submission.score / submission.maxScore) * 100)}%</p>
                    <p class="result-date">Soumis le ${new Date(submission.submittedAt).toLocaleDateString('fr-FR')}</p>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Voir les soumissions d'une évaluation (formateur)
function viewEvalSubmissions(evalId) {
    const evaluations = JSON.parse(localStorage.getItem('afertes_evaluations') || '[]');
    const evaluation = evaluations.find(e => e.id === evalId);

    if (!evaluation) {
        showToast('Évaluation non trouvée', 'error');
        return;
    }

    const submissions = evaluation.submissions || [];

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'eval-submissions-modal';
    modal.innerHTML = `
        <div class="modal modal-large">
            <div class="modal-header">
                <h2><i class="fas fa-list"></i> Soumissions - ${escapeHtml(evaluation.title)}</h2>
                <button onclick="this.closest('.modal-overlay').remove()" class="close-btn">&times;</button>
            </div>
            <div class="modal-body">
                ${submissions.length === 0 ? '<p class="empty-message">Aucune soumission</p>' : `
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>Étudiant</th>
                                <th>Score</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${submissions.map(s => `
                                <tr>
                                    <td>${escapeHtml(s.studentName)}</td>
                                    <td><strong>${s.score}/${s.maxScore}</strong> (${Math.round((s.score / s.maxScore) * 100)}%)</td>
                                    <td>${new Date(s.submittedAt).toLocaleDateString('fr-FR')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Modifier une évaluation
function editEvaluation(evalId) {
    const evaluations = JSON.parse(localStorage.getItem('afertes_evaluations') || '[]');
    const evaluation = evaluations.find(e => e.id === evalId);

    if (!evaluation) {
        showToast('Évaluation non trouvée', 'error');
        return;
    }

    // Pour l'instant, afficher un message - implémentation complète à venir
    showToast('Fonctionnalité de modification en cours de développement', 'info');
}

// Supprimer une évaluation
function deleteEvaluation(evalId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette évaluation ?')) return;

    const evaluations = JSON.parse(localStorage.getItem('afertes_evaluations') || '[]');
    const idx = evaluations.findIndex(e => e.id === evalId);

    if (idx !== -1) {
        evaluations.splice(idx, 1);
        localStorage.setItem('afertes_evaluations', JSON.stringify(evaluations));
        showToast('Évaluation supprimée', 'success');
        loadTrainerEvaluations();
    }
}

// Voir un groupe d'étudiants
function viewGroup(code, promo) {
    showPage('manage-students');
    setTimeout(() => {
        const formationFilter = document.getElementById('admin-student-formation');
        if (formationFilter) {
            formationFilter.value = code.toLowerCase();
            formationFilter.dispatchEvent(new Event('change'));
        }
    }, 100);
}

// Télécharger tous les documents d'un étudiant
function downloadAllDocs(studentId) {
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const student = users.find(u => u.id === studentId || u.id === parseInt(studentId));

    if (!student || !student.documents) {
        showToast('Aucun document à télécharger', 'error');
        return;
    }

    // Télécharger chaque document
    const docs = student.documents;
    const docTypes = ['identity', 'vitale', 'photo'];

    docTypes.forEach(type => {
        if (docs[type]) {
            const link = document.createElement('a');
            link.href = docs[type];
            link.download = `${student.lastname}_${student.firstname}_${type}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    });

    showToast('Téléchargement des documents en cours...', 'success');
}

// Fonction utilitaire pour échapper le HTML (protection XSS)
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==========================================
// FONCTIONS D'ACCESSIBILITÉ
// ==========================================

// Mettre à jour l'état aria-expanded des boutons toggle
function updateAriaExpanded(buttonSelector, isExpanded) {
    const button = document.querySelector(buttonSelector);
    if (button) {
        button.setAttribute('aria-expanded', isExpanded.toString());
    }
}

// Gérer le focus trap dans les modals
function trapFocus(modalElement) {
    const focusableElements = modalElement.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    modalElement.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            if (e.shiftKey) {
                if (document.activeElement === firstFocusable) {
                    lastFocusable.focus();
                    e.preventDefault();
                }
            } else {
                if (document.activeElement === lastFocusable) {
                    firstFocusable.focus();
                    e.preventDefault();
                }
            }
        }

        // Fermer avec Échap
        if (e.key === 'Escape') {
            const closeBtn = modalElement.querySelector('.close-btn');
            if (closeBtn) closeBtn.click();
        }
    });

    // Focus sur le premier élément focusable
    if (firstFocusable) {
        setTimeout(() => firstFocusable.focus(), 100);
    }
}

// Annoncer un message aux lecteurs d'écran
function announceToScreenReader(message, priority = 'polite') {
    let announcer = document.getElementById('sr-announcer');
    if (!announcer) {
        announcer = document.createElement('div');
        announcer.id = 'sr-announcer';
        announcer.setAttribute('aria-live', priority);
        announcer.setAttribute('aria-atomic', 'true');
        announcer.className = 'sr-only';
        document.body.appendChild(announcer);
    }

    announcer.textContent = '';
    setTimeout(() => {
        announcer.textContent = message;
    }, 100);
}

// Mettre à jour aria-current pour la navigation
function updateNavAriaCurrentPage(pageName) {
    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.dataset.page === pageName) {
            item.setAttribute('aria-current', 'page');
        } else {
            item.removeAttribute('aria-current');
        }
    });
}

// Exporter les fonctions globalement
window.loadStudentsDocuments = loadStudentsDocuments;
window.filterStudentsDocuments = filterStudentsDocuments;
window.viewStudentDocsModal = viewStudentDocsModal;
window.closeStudentDocsModal = closeStudentDocsModal;
window.openDocFullscreen = openDocFullscreen;
window.exportDocumentsReport = exportDocumentsReport;
window.moveQuestion = moveQuestion;
window.viewEvalResults = viewEvalResults;
window.viewEvalSubmissions = viewEvalSubmissions;
window.editEvaluation = editEvaluation;
window.deleteEvaluation = deleteEvaluation;
window.viewGroup = viewGroup;
window.downloadAllDocs = downloadAllDocs;
window.escapeHtml = escapeHtml;
window.updateAriaExpanded = updateAriaExpanded;
window.trapFocus = trapFocus;
window.announceToScreenReader = announceToScreenReader;
window.updateNavAriaCurrentPage = updateNavAriaCurrentPage;
