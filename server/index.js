/**
 * AFERTES Connect - Serveur Backend
 * API REST pour la gestion des étudiants, notes et documents
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const studentsRoutes = require('./routes/students');
const gradesRoutes = require('./routes/grades');
const documentsRoutes = require('./routes/documents');
const formationsRoutes = require('./routes/formations');
const exportRoutes = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de sécurité
app.use(helmet({
    contentSecurityPolicy: false, // Désactivé pour permettre le chargement des ressources
    crossOriginEmbedderPolicy: false
}));

// CORS - Autoriser les requêtes cross-origin
app.use(cors({
    origin: process.env.APP_URL || '*',
    credentials: true
}));

// Parser JSON
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir les fichiers statiques du frontend
app.use(express.static(path.join(__dirname, '../')));

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/grades', gradesRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/formations', formationsRoutes);
app.use('/api/export', exportRoutes);

// Route de santé pour YunoHost
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Toutes les autres routes renvoient vers le frontend (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// Gestion des erreurs globale
app.use((err, req, res, next) => {
    console.error('Erreur:', err);
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Une erreur est survenue'
            : err.message
    });
});

// Démarrage du serveur
app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════════╗
    ║     AFERTES Connect - Serveur API         ║
    ║     Port: ${PORT}                            ║
    ║     Mode: ${process.env.NODE_ENV || 'development'}                 ║
    ╚═══════════════════════════════════════════╝
    `);
});

module.exports = app;
