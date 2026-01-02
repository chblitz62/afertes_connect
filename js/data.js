/**
 * AFERTES Connect - Données de démonstration
 * Ce fichier contient les données de test et les fonctions d'accès aux données
 */

// ===========================================
// Initialisation des données de démonstration
// ===========================================
function initDemoData() {
    // Utilisateurs de démonstration
    if (!localStorage.getItem('afertes_users')) {
        const demoUsers = [
            {
                id: 1,
                firstname: 'Marie',
                lastname: 'Dupont',
                email: 'marie.dupont@afertes.org',
                password: 'demo123',
                role: 'student',
                formation: 'es',
                promo: '2024-2027',
                site: 'slb',
                avatar: 'img/default-avatar.svg',
                bio: 'Étudiante en ES, passionnée par l\'accompagnement des publics en difficulté.',
                privacy: { directory: true, email: false, photo: true }
            },
            {
                id: 2,
                firstname: 'Thomas',
                lastname: 'Martin',
                email: 'thomas.martin@afertes.org',
                password: 'demo123',
                role: 'student',
                formation: 'es',
                promo: '2024-2027',
                site: 'slb',
                avatar: 'img/default-avatar.svg',
                bio: '',
                privacy: { directory: true, email: true, photo: true }
            },
            {
                id: 3,
                firstname: 'Sophie',
                lastname: 'Bernard',
                email: 'sophie.bernard@afertes.org',
                password: 'demo123',
                role: 'student',
                formation: 'me',
                promo: '2024-2026',
                site: 'avion',
                avatar: 'img/default-avatar.svg',
                bio: 'Future monitrice éducatrice, j\'aime le travail en équipe.',
                privacy: { directory: true, email: false, photo: true }
            },
            {
                id: 4,
                firstname: 'Lucas',
                lastname: 'Petit',
                email: 'lucas.petit@afertes.org',
                password: 'demo123',
                role: 'student',
                formation: 'aes',
                promo: '2024-2025',
                site: 'slb',
                avatar: 'img/default-avatar.svg',
                bio: '',
                privacy: { directory: true, email: false, photo: true }
            },
            {
                id: 5,
                firstname: 'Emma',
                lastname: 'Leroy',
                email: 'emma.leroy@afertes.org',
                password: 'demo123',
                role: 'student',
                formation: 'es',
                promo: '2024-2027',
                site: 'slb',
                avatar: 'img/default-avatar.svg',
                bio: 'Engagée dans le BDE !',
                privacy: { directory: true, email: true, photo: true }
            },
            {
                id: 6,
                firstname: 'Hugo',
                lastname: 'Moreau',
                email: 'hugo.moreau@afertes.org',
                password: 'demo123',
                role: 'student',
                formation: 'caferuis',
                promo: '2024-2025',
                site: 'avion',
                avatar: 'img/default-avatar.svg',
                bio: 'Cadre en reconversion.',
                privacy: { directory: true, email: false, photo: true }
            },
            {
                id: 7,
                firstname: 'Philippe',
                lastname: 'Durand',
                email: 'philippe.durand@afertes.org',
                password: 'demo123',
                role: 'teacher',
                formation: null,
                promo: null,
                site: 'slb',
                avatar: 'img/default-avatar.svg',
                bio: 'Formateur en ES depuis 15 ans.',
                privacy: { directory: true, email: true, photo: true }
            },
            {
                id: 8,
                firstname: 'Caroline',
                lastname: 'Rousseau',
                email: 'caroline.rousseau@afertes.org',
                password: 'demo123',
                role: 'teacher',
                formation: null,
                promo: null,
                site: 'avion',
                avatar: 'img/default-avatar.svg',
                bio: 'Responsable pédagogique site d\'Avion.',
                privacy: { directory: true, email: true, photo: true }
            },
            {
                id: 9,
                firstname: 'Isabelle',
                lastname: 'Mercier',
                email: 'isabelle.mercier@afertes.org',
                password: 'demo123',
                role: 'secretary',
                formation: null,
                promo: null,
                site: 'slb',
                avatar: 'img/default-avatar.svg',
                bio: 'Secrétaire pédagogique - Site de Saint-Laurent-Blangy.',
                privacy: { directory: true, email: true, photo: true }
            },
            {
                id: 10,
                firstname: 'Marc',
                lastname: 'Lefebvre',
                email: 'marc.lefebvre@afertes.org',
                password: 'demo123',
                role: 'secretary',
                formation: null,
                promo: null,
                site: 'avion',
                avatar: 'img/default-avatar.svg',
                bio: 'Secrétaire administratif - Site d\'Avion.',
                privacy: { directory: true, email: true, photo: true }
            },
            {
                id: 11,
                firstname: 'Antoine',
                lastname: 'Garcia',
                email: 'antoine.garcia@afertes.org',
                password: 'demo123',
                role: 'bde',
                formation: 'es',
                promo: '2024-2027',
                site: 'slb',
                avatar: 'img/default-avatar.svg',
                bio: 'Président du BDE AFERTES 2024-2025.',
                privacy: { directory: true, email: true, photo: true }
            }
        ];
        localStorage.setItem('afertes_users', JSON.stringify(demoUsers));
    }

    // Actualités de démonstration
    if (!localStorage.getItem('afertes_news')) {
        const demoNews = [
            {
                id: 1,
                title: 'Forum pour l\'accessibilité universelle',
                content: 'Le forum pour l\'accessibilité universelle organisé par les ES1 et ME1 à Saint-Laurent-Blangy a récemment eu lieu ! Un grand succès avec plus de 200 visiteurs et de nombreux partenaires associatifs présents. Merci à tous les étudiants pour leur investissement dans ce projet collectif qui met en lumière les enjeux de l\'inclusion.',
                site: 'slb',
                date: new Date(Date.now() - 86400000).toISOString(),
                author: 'Direction AFERTES',
                image: null
            },
            {
                id: 2,
                title: 'Nouvelle formation : Travailleur social en établissement médico-social',
                content: 'L\'AFERTES lance une nouvelle formation à destination des travailleurs sociaux exerçant en établissement médico-social pour personnes âgées ou à domicile. Inscriptions ouvertes pour la session de mars 2025. Cette formation répond aux besoins croissants du secteur du grand âge.',
                site: 'all',
                date: new Date(Date.now() - 172800000).toISOString(),
                author: 'Service Formation Continue',
                image: null
            },
            {
                id: 3,
                title: 'Fermeture hivernale',
                content: 'L\'AFERTES sera fermé du 23 décembre au 3 janvier inclus pour les vacances de Noël. Nous vous souhaitons de très bonnes fêtes de fin d\'année ! Les cours reprendront le 6 janvier 2025. L\'équipe administrative reste joignable par email pour les urgences.',
                site: 'all',
                date: new Date(Date.now() - 259200000).toISOString(),
                author: 'Direction AFERTES',
                image: null
            },
            {
                id: 4,
                title: 'Rencontre avec les professionnels du secteur',
                content: 'Une rencontre est organisée le 15 janvier avec des professionnels du secteur médico-social pour les étudiants ES2 et ES3. L\'occasion d\'échanger sur les réalités du terrain et les perspectives de carrière. Inscription obligatoire auprès de votre référent de formation.',
                site: 'slb',
                date: new Date(Date.now() - 345600000).toISOString(),
                author: 'Philippe Durand',
                image: null
            },
            {
                id: 5,
                title: 'Atelier théâtre-forum sur le site d\'Avion',
                content: 'Un atelier théâtre-forum sera proposé aux étudiants ME1 le mercredi 22 janvier. Cette technique permet d\'explorer des situations professionnelles complexes de manière interactive. Venez nombreux découvrir cet outil pédagogique innovant !',
                site: 'avion',
                date: new Date(Date.now() - 432000000).toISOString(),
                author: 'Caroline Rousseau',
                image: null
            }
        ];
        localStorage.setItem('afertes_news', JSON.stringify(demoNews));
    }

    // Événements BDE de démonstration
    if (!localStorage.getItem('afertes_bde_events')) {
        const demoEvents = [
            {
                id: 1,
                title: 'Galette des rois',
                description: 'Venez partager la galette des rois avec le BDE ! Ambiance conviviale garantie.',
                date: new Date('2025-01-10T12:30:00').toISOString(),
                location: 'Cafétéria SLB'
            },
            {
                id: 2,
                title: 'Soirée bowling',
                description: 'Soirée détente au bowling d\'Arras. Inscription avant le 20 janvier. Tarif préférentiel pour les adhérents BDE.',
                date: new Date('2025-01-24T19:00:00').toISOString(),
                location: 'Bowling d\'Arras'
            },
            {
                id: 3,
                title: 'Café débat : L\'éthique dans le travail social',
                description: 'Échangeons ensemble sur les questions éthiques que nous rencontrons en stage et dans notre future pratique.',
                date: new Date('2025-02-05T14:00:00').toISOString(),
                location: 'Salle polyvalente SLB'
            },
            {
                id: 4,
                title: 'Tournoi de baby-foot inter-promos',
                description: 'ES contre ME, qui remportera le trophée ? Inscrivez votre équipe de 2 personnes.',
                date: new Date('2025-02-12T17:30:00').toISOString(),
                location: 'Foyer des étudiants'
            },
            {
                id: 5,
                title: 'Journée solidaire',
                description: 'Le BDE organise une collecte pour les Restos du Cœur. Apportez vos dons (conserves, hygiène, vêtements chauds).',
                date: new Date('2025-02-20T09:00:00').toISOString(),
                location: 'Hall d\'entrée SLB et Avion'
            }
        ];
        localStorage.setItem('afertes_bde_events', JSON.stringify(demoEvents));
    }

    // Notifications de démonstration
    if (!localStorage.getItem('afertes_notifications')) {
        const demoNotifications = [
            {
                id: 1,
                title: 'Nouveau message',
                message: 'Philippe Durand vous a envoyé un message concernant votre stage.',
                date: new Date(Date.now() - 3600000).toISOString(),
                read: false
            },
            {
                id: 2,
                title: 'Événement BDE',
                message: 'N\'oubliez pas la galette des rois le 10 janvier !',
                date: new Date(Date.now() - 86400000).toISOString(),
                read: false
            },
            {
                id: 3,
                title: 'Actualité',
                message: 'Une nouvelle actualité a été publiée : Fermeture hivernale',
                date: new Date(Date.now() - 172800000).toISOString(),
                read: true
            }
        ];
        localStorage.setItem('afertes_notifications', JSON.stringify(demoNotifications));
    }

    // Conversations de démonstration
    if (!localStorage.getItem('afertes_conversations')) {
        const demoConversations = [
            {
                id: 1,
                userId: 7,
                name: 'Philippe Durand',
                avatar: 'img/default-avatar.svg',
                role: 'Formateur',
                lastMessage: 'Avez-vous trouvé un terrain de stage ?',
                lastDate: new Date(Date.now() - 3600000).toISOString(),
                unread: true,
                unreadCount: 1
            },
            {
                id: 2,
                userId: 5,
                name: 'Emma Leroy',
                avatar: 'img/default-avatar.svg',
                role: 'ES - Promo 2024',
                lastMessage: 'Ok pour le travail de groupe !',
                lastDate: new Date(Date.now() - 7200000).toISOString(),
                unread: true,
                unreadCount: 2
            },
            {
                id: 3,
                userId: 2,
                name: 'Thomas Martin',
                avatar: 'img/default-avatar.svg',
                role: 'ES - Promo 2024',
                lastMessage: 'Merci pour les notes de cours !',
                lastDate: new Date(Date.now() - 86400000).toISOString(),
                unread: false,
                unreadCount: 0
            }
        ];
        localStorage.setItem('afertes_conversations', JSON.stringify(demoConversations));
    }

    // Messages de démonstration
    if (!localStorage.getItem('afertes_messages_1')) {
        const demoMessages1 = [
            {
                id: 1,
                content: 'Bonjour, j\'espère que vous allez bien.',
                sent: false,
                date: new Date(Date.now() - 86400000).toISOString()
            },
            {
                id: 2,
                content: 'Bonjour M. Durand, oui très bien merci !',
                sent: true,
                date: new Date(Date.now() - 82800000).toISOString()
            },
            {
                id: 3,
                content: 'Je voulais vous demander : avez-vous trouvé un terrain de stage pour le semestre prochain ?',
                sent: false,
                date: new Date(Date.now() - 3600000).toISOString()
            }
        ];
        localStorage.setItem('afertes_messages_1', JSON.stringify(demoMessages1));
    }

    if (!localStorage.getItem('afertes_messages_2')) {
        const demoMessages2 = [
            {
                id: 1,
                content: 'Salut ! On se retrouve pour le travail de groupe ?',
                sent: false,
                date: new Date(Date.now() - 10800000).toISOString()
            },
            {
                id: 2,
                content: 'Oui carrément ! Demain 14h à la BU ?',
                sent: true,
                date: new Date(Date.now() - 10000000).toISOString()
            },
            {
                id: 3,
                content: 'Parfait ! J\'ai commencé à lire les textes.',
                sent: false,
                date: new Date(Date.now() - 9000000).toISOString()
            },
            {
                id: 4,
                content: 'Ok pour le travail de groupe !',
                sent: false,
                date: new Date(Date.now() - 7200000).toISOString()
            }
        ];
        localStorage.setItem('afertes_messages_2', JSON.stringify(demoMessages2));
    }

    // Documents de démonstration
    if (!localStorage.getItem('afertes_documents')) {
        const demoDocuments = [
            {
                id: 1,
                title: 'Règlement intérieur AFERTES',
                description: 'Version 2024-2025',
                type: 'pdf',
                url: '#'
            },
            {
                id: 2,
                title: 'Calendrier de formation ES',
                description: 'Planning annuel 2024-2025',
                type: 'pdf',
                url: '#'
            },
            {
                id: 3,
                title: 'Guide du stagiaire',
                description: 'Informations pratiques pour vos stages',
                type: 'doc',
                url: '#'
            },
            {
                id: 4,
                title: 'Convention de stage type',
                description: 'Document à faire compléter par l\'établissement',
                type: 'doc',
                url: '#'
            },
            {
                id: 5,
                title: 'Fiche d\'évaluation stage',
                description: 'Grille d\'évaluation pour les tuteurs',
                type: 'xls',
                url: '#'
            },
            {
                id: 6,
                title: 'Présentation AFERTES',
                description: 'Diaporama de présentation du centre',
                type: 'ppt',
                url: '#'
            }
        ];
        localStorage.setItem('afertes_documents', JSON.stringify(demoDocuments));
    }

    // Emplois du temps de démonstration
    if (!localStorage.getItem('afertes_schedules')) {
        const today = new Date();
        const monday = new Date(today);
        monday.setDate(today.getDate() - today.getDay() + 1);
        
        const demoSchedules = [
            // Lundi
            {
                id: 1,
                date: formatDateISO(monday),
                start: '09:00',
                end: '12:00',
                title: 'Psychologie du développement',
                room: 'Salle 101',
                type: 'cours',
                formation: 'es',
                site: 'slb'
            },
            {
                id: 2,
                date: formatDateISO(monday),
                start: '14:00',
                end: '17:00',
                title: 'Méthodologie de projet',
                room: 'Salle 203',
                type: 'td',
                formation: 'es',
                site: 'slb'
            },
            // Mardi
            {
                id: 3,
                date: formatDateISO(addDays(monday, 1)),
                start: '09:00',
                end: '12:00',
                title: 'Droit et législation sociale',
                room: 'Amphi A',
                type: 'cours',
                formation: 'es',
                site: 'slb'
            },
            {
                id: 4,
                date: formatDateISO(addDays(monday, 1)),
                start: '14:00',
                end: '16:00',
                title: 'Analyse des pratiques',
                room: 'Salle 105',
                type: 'td',
                formation: 'es',
                site: 'slb'
            },
            // Mercredi
            {
                id: 5,
                date: formatDateISO(addDays(monday, 2)),
                start: '09:00',
                end: '12:00',
                title: 'Sociologie des institutions',
                room: 'Salle 201',
                type: 'cours',
                formation: 'es',
                site: 'slb'
            },
            // Jeudi
            {
                id: 6,
                date: formatDateISO(addDays(monday, 3)),
                start: '09:00',
                end: '17:00',
                title: 'Stage en établissement',
                room: '',
                type: 'stage',
                formation: 'es',
                site: 'slb'
            },
            // Vendredi
            {
                id: 7,
                date: formatDateISO(addDays(monday, 4)),
                start: '09:00',
                end: '17:00',
                title: 'Stage en établissement',
                room: '',
                type: 'stage',
                formation: 'es',
                site: 'slb'
            }
        ];
        localStorage.setItem('afertes_schedules', JSON.stringify(demoSchedules));
    }

    // Notes de démonstration
    if (!localStorage.getItem('afertes_grades')) {
        const demoGrades = [
            {
                id: 1,
                studentId: 1,
                formation: 'es',
                dc: 'dc1',
                title: 'Devoir sur table - Psychologie du développement',
                date: '2024-11-15',
                value: 14.5,
                coefficient: 2,
                comment: 'Bonne analyse, des pistes d\'amélioration sur la partie théorique',
                teacherId: 7
            },
            {
                id: 2,
                studentId: 1,
                formation: 'es',
                dc: 'dc2',
                title: 'Dossier de méthodologie de projet',
                date: '2024-11-28',
                value: 16,
                coefficient: 3,
                comment: 'Excellent travail, projet bien structuré',
                teacherId: 7
            },
            {
                id: 3,
                studentId: 1,
                formation: 'es',
                dc: 'dc3',
                title: 'Oral de communication professionnelle',
                date: '2024-12-10',
                value: 13,
                coefficient: 2,
                comment: 'À l\'aise à l\'oral, attention aux supports visuels',
                teacherId: 8
            },
            {
                id: 4,
                studentId: 1,
                formation: 'es',
                dc: 'dc4',
                title: 'Évaluation de stage - Période 1',
                date: '2024-12-20',
                value: 15,
                coefficient: 4,
                comment: 'Très bon investissement sur le terrain',
                teacherId: 7
            },
            {
                id: 5,
                studentId: 2,
                formation: 'es',
                dc: 'dc1',
                title: 'Devoir sur table - Psychologie du développement',
                date: '2024-11-15',
                value: 12,
                coefficient: 2,
                comment: '',
                teacherId: 7
            }
        ];
        localStorage.setItem('afertes_grades', JSON.stringify(demoGrades));
    }
}

// Fonctions utilitaires pour les dates
function formatDateISO(date) {
    return date.toISOString().split('T')[0];
}

function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

// Initialiser les données au chargement
initDemoData();

// ===========================================
// Fonctions d'accès aux données
// ===========================================

function getNews() {
    return JSON.parse(localStorage.getItem('afertes_news') || '[]');
}

function getBDEEvents() {
    return JSON.parse(localStorage.getItem('afertes_bde_events') || '[]');
}

function getNotifications() {
    return JSON.parse(localStorage.getItem('afertes_notifications') || '[]');
}

function getConversations() {
    return JSON.parse(localStorage.getItem('afertes_conversations') || '[]');
}

function getConversationMessages(conversationId) {
    return JSON.parse(localStorage.getItem(`afertes_messages_${conversationId}`) || '[]');
}

function getRecentMessages() {
    const conversations = getConversations();
    return conversations.map(conv => ({
        senderName: conv.name,
        content: conv.lastMessage,
        date: conv.lastDate
    }));
}

function getPromoMembers() {
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    const currentUser = JSON.parse(localStorage.getItem('afertes_user'));
    
    if (!currentUser || currentUser.role !== 'student') {
        return users.filter(u => u.role === 'student');
    }
    
    return users.filter(u => 
        u.role === 'student' && 
        u.formation === currentUser.formation && 
        u.promo === currentUser.promo &&
        u.privacy?.directory !== false
    );
}

function getAllUsers() {
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    return users.filter(u => u.privacy?.directory !== false);
}

function getDocuments() {
    return JSON.parse(localStorage.getItem('afertes_documents') || '[]');
}

// ===========================================
// Export des fonctions
// ===========================================
window.getNews = getNews;
window.getBDEEvents = getBDEEvents;
window.getNotifications = getNotifications;
window.getConversations = getConversations;
window.getConversationMessages = getConversationMessages;
window.getRecentMessages = getRecentMessages;
window.getPromoMembers = getPromoMembers;
window.getAllUsers = getAllUsers;
window.getDocuments = getDocuments;
