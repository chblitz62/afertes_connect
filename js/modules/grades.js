/**
 * Module Grades (Notes)
 * Gère l'affichage des notes étudiants, la saisie des notes par les formateurs
 * et l'administration des notes par le secrétariat
 */

// ===========================================
// Cache du logo pour les PDF
// ===========================================
let logoBase64Cache = null;

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

// ===========================================
// Affichage des notes (Étudiants)
// ===========================================

function loadGrades() {
    const grades = getStudentGrades();

    // Calculer les statistiques
    if (grades.length > 0) {
        const sum = grades.reduce((acc, g) => acc + g.value, 0);
        const avg = (sum / grades.length).toFixed(2);
        const best = Math.max(...grades.map(g => g.value));

        const avgEl = document.getElementById('average-grade');
        const totalEl = document.getElementById('total-grades');
        const bestEl = document.getElementById('best-grade');

        if (avgEl) avgEl.textContent = avg + '/20';
        if (totalEl) totalEl.textContent = grades.length;
        if (bestEl) bestEl.textContent = best + '/20';
    }

    renderGradesTable(grades);
}

function getStudentGrades() {
    const allGrades = JSON.parse(localStorage.getItem('afertes_grades') || '[]');
    return allGrades.filter(g => g.studentId === window.currentUser?.id);
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
                <td><strong>${escapeHtml(grade.title)}</strong></td>
                <td>${escapeHtml(grade.dc?.toUpperCase() || '')}</td>
                <td>${new Date(grade.date).toLocaleDateString('fr-FR')}</td>
                <td><span class="grade-value ${gradeClass}">${grade.value}/20</span></td>
                <td>${grade.coefficient}</td>
                <td class="grade-comment">${escapeHtml(grade.comment || '-')}</td>
            </tr>
        `;
    }).join('');
}

// ===========================================
// Gestion des notes (Formateurs)
// ===========================================

function initGradeManagement() {
    const dateInput = document.getElementById('grade-date');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }
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

    const titleEl = document.getElementById('grade-entry-title');
    const cardEl = document.getElementById('grade-entry-card');

    if (titleEl) titleEl.textContent = title;
    if (cardEl) cardEl.classList.remove('hidden');

    const tbody = document.getElementById('grade-entry-tbody');
    if (tbody) {
        tbody.innerHTML = students.map(student => `
            <tr data-student-id="${student.id}">
                <td>${escapeHtml(student.firstName || student.firstname)} ${escapeHtml(student.lastName || student.lastname)}</td>
                <td><input type="number" min="0" max="20" step="0.5" class="student-grade"></td>
                <td><input type="text" class="student-comment" placeholder="Commentaire optionnel"></td>
            </tr>
        `).join('');
    }
}

function cancelGradeEntry() {
    const cardEl = document.getElementById('grade-entry-card');
    const formEl = document.getElementById('grade-entry-form');

    if (cardEl) cardEl.classList.add('hidden');
    if (formEl) formEl.reset();
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

        if (gradeInput && gradeInput.value) {
            grades.push({
                id: Date.now() + '-' + studentId,
                studentId: studentId,
                formation: formation,
                dc: dc,
                title: title,
                date: date,
                value: parseFloat(gradeInput.value),
                coefficient: coefficient,
                comment: commentInput ? commentInput.value : '',
                teacherId: window.currentUser?.id,
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
// Administration des notes (Secrétariat)
// ===========================================

function loadAdminGrades() {
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const grades = JSON.parse(localStorage.getItem('afertes_grades') || '[]');
    const students = users.filter(u => u.role === 'student');
    const tbody = document.getElementById('admin-grades-tbody');
    if (!tbody) return;

    tbody.innerHTML = students.map(student => {
        const studentGrades = grades.filter(g => g.userId === student.id || g.studentId === student.id);
        const dcGrades = { dc1: [], dc2: [], dc3: [], dc4: [] };
        studentGrades.forEach(g => {
            if (dcGrades[g.dc]) dcGrades[g.dc].push(g.value);
        });
        const avg = (arr) => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : '-';
        const totalAvg = [...dcGrades.dc1, ...dcGrades.dc2, ...dcGrades.dc3, ...dcGrades.dc4];
        return `
            <tr>
                <td>${escapeHtml(student.lastname || '')} ${escapeHtml(student.firstname || '')}</td>
                <td>${escapeHtml((student.formation || '').toUpperCase())}</td>
                <td>${avg(dcGrades.dc1)}</td>
                <td>${avg(dcGrades.dc2)}</td>
                <td>${avg(dcGrades.dc3)}</td>
                <td>${avg(dcGrades.dc4)}</td>
                <td><strong>${totalAvg.length ? (totalAvg.reduce((a, b) => a + b, 0) / totalAvg.length).toFixed(1) : '-'}</strong></td>
                <td>
                    <button class="action-btn" onclick="viewStudentGrades(${student.id})" title="Détails" aria-label="Voir les notes de ${escapeHtml(student.firstname)}">
                        <i class="fas fa-eye" aria-hidden="true"></i>
                    </button>
                    <button class="action-btn" onclick="generateStudentBulletin(${student.id})" title="Télécharger PDF" aria-label="Télécharger le bulletin de ${escapeHtml(student.firstname)}">
                        <i class="fas fa-file-pdf" aria-hidden="true"></i>
                    </button>
                    <button class="action-btn" onclick="sendBulletinByEmail(${student.id})" title="Envoyer par email" aria-label="Envoyer le bulletin par email à ${escapeHtml(student.firstname)}">
                        <i class="fas fa-envelope" aria-hidden="true"></i>
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
    const studentGrades = grades.filter(g => g.userId === studentId || g.studentId === studentId);

    if (!student) {
        showToast('Étudiant non trouvé', 'error');
        return;
    }

    const modalContent = `
        <h2>Notes de ${escapeHtml(student.firstname)} ${escapeHtml(student.lastname)}</h2>
        <table class="grades-table">
            <thead>
                <tr><th>Matière</th><th>DC</th><th>Note</th><th>Date</th><th>Commentaire</th></tr>
            </thead>
            <tbody>
                ${studentGrades.map(g => `
                    <tr>
                        <td>${escapeHtml(g.subject || g.title || '')}</td>
                        <td>${escapeHtml((g.dc || '').toUpperCase())}</td>
                        <td><span class="grade-value ${getGradeClass(g.value)}">${g.value}/20</span></td>
                        <td>${formatDate(g.date)}</td>
                        <td>${escapeHtml(g.comment || '-')}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    const modalContentEl = document.getElementById('modal-content');
    const modalOverlay = document.getElementById('modal-overlay');

    if (modalContentEl) modalContentEl.innerHTML = modalContent;
    if (modalOverlay) modalOverlay.classList.remove('hidden');
}

// ===========================================
// Génération de bulletins PDF
// ===========================================

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

    const studentGrades = grades.filter(g => g.userId === studentId || g.studentId === studentId);

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
        g.subject || g.title || '-',
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

// ===========================================
// Export des notes
// ===========================================

function exportGradesList() {
    // Vérifier les droits
    if (!window.currentUser || !['secretary', 'teacher', 'admin'].includes(window.currentUser.role)) {
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
        const studentGrades = grades.filter(g => g.userId === student.id || g.studentId === student.id);
        studentGrades.forEach(g => {
            exportData.push({
                'Nom': student.lastname || '',
                'Prénom': student.firstname || '',
                'Formation': window.APP_CONFIG?.formations[student.formation] || student.formation?.toUpperCase() || '',
                'Promotion': student.promo ? `${student.promo}-${parseInt(student.promo) + 3}` : '',
                'Matière': g.subject || g.title || '',
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

// ===========================================
// Envoi de bulletins par email
// ===========================================

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
                <input type="email" id="email-recipient" value="${escapeHtml(student.email)}" required>
            </div>
            <div class="form-group">
                <label>Objet</label>
                <input type="text" id="email-subject" value="Bulletin de notes - ${escapeHtml(student.firstname)} ${escapeHtml(student.lastname)}" required>
            </div>
            <div class="form-group">
                <label>Message</label>
                <textarea id="email-body" rows="6">Bonjour ${escapeHtml(student.firstname)},

Veuillez trouver ci-joint votre bulletin de notes.

Cordialement,
L'équipe pédagogique AFERTES</textarea>
            </div>
            <div class="form-group">
                <label><i class="fas fa-paperclip"></i> Pièce jointe</label>
                <div class="attachment-preview">
                    <i class="fas fa-file-pdf"></i>
                    <span>bulletin_${escapeHtml(student.lastname)}_${escapeHtml(student.firstname)}.pdf</span>
                    <a href="${pdfUrl}" download="bulletin_${escapeHtml(student.lastname)}_${escapeHtml(student.firstname)}.pdf" class="btn btn-sm">
                        <i class="fas fa-download"></i> Télécharger
                    </a>
                </div>
            </div>
            <div class="email-actions">
                <button type="button" class="btn btn-primary" onclick="openMailClient('${escapeHtml(student.email)}', '${escapeHtml(student.firstname)}', '${escapeHtml(student.lastname)}')">
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

    const modalContentEl = document.getElementById('modal-content');
    const modalOverlay = document.getElementById('modal-overlay');

    if (modalContentEl) modalContentEl.innerHTML = modalContent;
    if (modalOverlay) modalOverlay.classList.remove('hidden');
}

function openMailClient(email, firstname, lastname) {
    const subject = document.getElementById('email-subject')?.value || '';
    const body = document.getElementById('email-body')?.value || '';

    const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink);

    showToast('Application mail ouverte', 'info');
}

function copyEmailContent() {
    const body = document.getElementById('email-body')?.value || '';
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
        <p>Promo: <strong>${escapeHtml(promoFilter)}</strong> - ${students.length} étudiant(s)</p>
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
                            <td>${escapeHtml(s.firstname)} ${escapeHtml(s.lastname)}</td>
                            <td>${escapeHtml(s.email)}</td>
                            <td>
                                <button class="action-btn" onclick="sendBulletinByEmail(${s.id})" title="Envoyer" aria-label="Envoyer le bulletin à ${escapeHtml(s.firstname)}">
                                    <i class="fas fa-envelope" aria-hidden="true"></i>
                                </button>
                                <button class="action-btn" onclick="generateStudentBulletin(${s.id})" title="Télécharger PDF" aria-label="Télécharger le bulletin de ${escapeHtml(s.firstname)}">
                                    <i class="fas fa-download" aria-hidden="true"></i>
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

    const modalContentEl = document.getElementById('modal-content');
    const modalOverlay = document.getElementById('modal-overlay');

    if (modalContentEl) modalContentEl.innerHTML = modalContent;
    if (modalOverlay) modalOverlay.classList.remove('hidden');
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

function getGradeClass(value) {
    if (typeof window.getGradeClass === 'function') {
        return window.getGradeClass(value);
    }
    if (value >= 16) return 'excellent';
    if (value >= 14) return 'good';
    if (value >= 10) return 'average';
    return 'below';
}

function formatDate(dateStr) {
    if (typeof window.formatDate === 'function') {
        return window.formatDate(dateStr);
    }
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR');
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

window.loadGrades = loadGrades;
window.getStudentGrades = getStudentGrades;
window.renderGradesTable = renderGradesTable;
window.initGradeManagement = initGradeManagement;
window.loadStudentsForGrading = loadStudentsForGrading;
window.cancelGradeEntry = cancelGradeEntry;
window.saveGrades = saveGrades;
window.loadAdminGrades = loadAdminGrades;
window.viewStudentGrades = viewStudentGrades;
window.generateStudentBulletin = generateStudentBulletin;
window.generateBulletins = generateBulletins;
window.exportGradesList = exportGradesList;
window.sendBulletinByEmail = sendBulletinByEmail;
window.openMailClient = openMailClient;
window.copyEmailContent = copyEmailContent;
window.sendBulletinsToPromo = sendBulletinsToPromo;
window.toggleAllEmails = toggleAllEmails;
window.downloadAllBulletins = downloadAllBulletins;
window.exportEmailList = exportEmailList;
window.loadLogoBase64 = loadLogoBase64;
