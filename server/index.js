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
const collabRoutes = require('./routes/collaborative-documents');
const { startCollabServer } = require('./websocket/collab-server');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de sécurité
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", "ws:", "wss:"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: []
        }
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
        maxAge: 31536000, // 1 an
        includeSubDomains: true,
        preload: true
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
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
app.use('/api/collab', collabRoutes);

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
const COLLAB_PORT = process.env.COLLAB_WS_PORT || 1234;

app.listen(PORT, async () => {
    console.log(`
    ╔═══════════════════════════════════════════╗
    ║     AFERTES Connect - Serveur API         ║
    ║     Port HTTP: ${PORT}                          ║
    ║     Port WebSocket: ${COLLAB_PORT}                    ║
    ║     Mode: ${process.env.NODE_ENV || 'development'}                 ║
    ╚═══════════════════════════════════════════╝
    `);

    // Démarrer le serveur WebSocket pour la collaboration
    try {
        await startCollabServer();
    } catch (error) {
        console.error('[Collab] Erreur démarrage serveur WebSocket:', error.message);
    }
});

module.exports = app;
