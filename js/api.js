/**
 * AFERTES Connect - Client API
 * Module de communication avec le backend
 */

const API = {
    // URL de base de l'API (sera automatiquement détectée)
    baseUrl: '',

    // Token JWT stocké en mémoire
    token: null,

    /**
     * Initialisation de l'API
     */
    init() {
        // Détecter l'URL de base
        this.baseUrl = window.location.origin + '/api';

        // Récupérer le token stocké
        this.token = localStorage.getItem('authToken');

        console.log('API initialisée:', this.baseUrl);
    },

    /**
     * Définir le token d'authentification
     */
    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('authToken', token);
        } else {
            localStorage.removeItem('authToken');
        }
    },

    /**
     * Récupérer les headers avec authentification
     */
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    },

    /**
     * Effectuer une requête API
     */
    async request(method, endpoint, data = null) {
        const url = `${this.baseUrl}${endpoint}`;
        const options = {
            method,
            headers: this.getHeaders()
        };

        if (data && method !== 'GET') {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);

            // Gérer les erreurs d'authentification
            if (response.status === 401) {
                this.setToken(null);
                window.location.reload();
                throw new Error('Session expirée');
            }

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Erreur serveur');
            }

            return result;
        } catch (error) {
            console.error(`API Error [${method} ${endpoint}]:`, error);
            throw error;
        }
    },

    /**
     * Upload de fichier
     */
    async uploadFile(endpoint, file, docType) {
        const url = `${this.baseUrl}${endpoint}`;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('docType', docType);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`
            },
            body: formData
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Erreur upload');
        }

        return result;
    },

    // ==================== AUTH ====================

    /**
     * Connexion
     */
    async login(username, password) {
        const result = await this.request('POST', '/auth/login', { username, password });
        if (result.token) {
            this.setToken(result.token);
        }
        return result;
    },

    /**
     * Déconnexion
     */
    async logout() {
        try {
            await this.request('POST', '/auth/logout');
        } catch (e) {
            // Ignorer les erreurs de logout
        }
        this.setToken(null);
    },

    /**
     * Récupérer l'utilisateur courant
     */
    async getCurrentUser() {
        return await this.request('GET', '/auth/me');
    },

    /**
     * Changer le mot de passe
     */
    async changePassword(currentPassword, newPassword) {
        return await this.request('POST', '/auth/change-password', {
            currentPassword,
            newPassword
        });
    },

    // ==================== USERS ====================

    /**
     * Liste des utilisateurs
     */
    async getUsers(filters = {}) {
        let query = '';
        if (Object.keys(filters).length > 0) {
            query = '?' + new URLSearchParams(filters).toString();
        }
        return await this.request('GET', `/users${query}`);
    },

    /**
     * Créer un utilisateur
     */
    async createUser(userData) {
        return await this.request('POST', '/users', userData);
    },

    /**
     * Mettre à jour un utilisateur
     */
    async updateUser(userId, userData) {
        return await this.request('PUT', `/users/${userId}`, userData);
    },

    /**
     * Supprimer un utilisateur
     */
    async deleteUser(userId) {
        return await this.request('DELETE', `/users/${userId}`);
    },

    // ==================== STUDENTS ====================

    /**
     * Liste des étudiants
     */
    async getStudents(filters = {}) {
        let query = '';
        if (Object.keys(filters).length > 0) {
            query = '?' + new URLSearchParams(filters).toString();
        }
        return await this.request('GET', `/students${query}`);
    },

    /**
     * Détails d'un étudiant
     */
    async getStudent(studentId) {
        return await this.request('GET', `/students/${studentId}`);
    },

    /**
     * Notes d'un étudiant
     */
    async getStudentGrades(studentId) {
        return await this.request('GET', `/students/${studentId}/grades`);
    },

    /**
     * Bulletin d'un étudiant
     */
    async getStudentBulletin(studentId) {
        return await this.request('GET', `/students/${studentId}/bulletin`);
    },

    /**
     * Compléter la première connexion
     */
    async completeFirstLogin(studentId, data) {
        return await this.request('POST', `/students/${studentId}/complete-first-login`, data);
    },

    // ==================== GRADES ====================

    /**
     * Liste des notes
     */
    async getGrades(filters = {}) {
        let query = '';
        if (Object.keys(filters).length > 0) {
            query = '?' + new URLSearchParams(filters).toString();
        }
        return await this.request('GET', `/grades${query}`);
    },

    /**
     * Ajouter une note
     */
    async addGrade(gradeData) {
        return await this.request('POST', '/grades', gradeData);
    },

    /**
     * Modifier une note
     */
    async updateGrade(gradeId, gradeData) {
        return await this.request('PUT', `/grades/${gradeId}`, gradeData);
    },

    /**
     * Supprimer une note
     */
    async deleteGrade(gradeId) {
        return await this.request('DELETE', `/grades/${gradeId}`);
    },

    // ==================== DOCUMENTS ====================

    /**
     * Liste des documents de l'utilisateur
     */
    async getMyDocuments() {
        return await this.request('GET', '/documents');
    },

    /**
     * Documents d'un utilisateur (admin/secretary)
     */
    async getUserDocuments(userId) {
        return await this.request('GET', `/documents/user/${userId}`);
    },

    /**
     * Upload un document
     */
    async uploadDocument(file, docType) {
        return await this.uploadFile('/documents', file, docType);
    },

    /**
     * Supprimer un document
     */
    async deleteDocument(docId) {
        return await this.request('DELETE', `/documents/${docId}`);
    },

    /**
     * URL de téléchargement d'un document
     */
    getDocumentUrl(docId) {
        return `${this.baseUrl}/documents/${docId}`;
    },

    /**
     * URL de visualisation d'un document
     */
    getDocumentViewUrl(docId) {
        return `${this.baseUrl}/documents/${docId}/view`;
    },

    // ==================== FORMATIONS ====================

    /**
     * Liste des formations
     */
    async getFormations() {
        return await this.request('GET', '/formations');
    },

    /**
     * Détails d'une formation
     */
    async getFormation(code) {
        return await this.request('GET', `/formations/${code}`);
    },

    /**
     * Matières d'une formation
     */
    async getFormationSubjects(code) {
        return await this.request('GET', `/formations/${code}/subjects`);
    },

    // ==================== EXPORT ====================

    /**
     * Export des étudiants
     */
    async exportStudents(filters = {}) {
        let query = '';
        if (Object.keys(filters).length > 0) {
            query = '?' + new URLSearchParams(filters).toString();
        }
        return await this.request('GET', `/export/students${query}`);
    },

    /**
     * Export des notes
     */
    async exportGrades(filters = {}) {
        let query = '';
        if (Object.keys(filters).length > 0) {
            query = '?' + new URLSearchParams(filters).toString();
        }
        return await this.request('GET', `/export/grades${query}`);
    },

    /**
     * Export du bulletin
     */
    async exportBulletin(studentId) {
        return await this.request('GET', `/export/bulletin/${studentId}`);
    },

    // ==================== HEALTH ====================

    /**
     * Vérifier la santé de l'API
     */
    async checkHealth() {
        try {
            const result = await this.request('GET', '/health');
            return result.status === 'ok';
        } catch (e) {
            return false;
        }
    }
};

// Initialiser l'API au chargement
API.init();

// Exporter pour utilisation globale
window.API = API;
