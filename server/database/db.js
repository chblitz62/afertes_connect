/**
 * Configuration de la connexion PostgreSQL
 */

const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'afertes_connect',
    user: process.env.DB_USER || 'afertes',
    password: process.env.DB_PASSWORD,
    max: 20, // Nombre maximum de connexions
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test de connexion au démarrage
pool.on('connect', () => {
    console.log('✓ Connexion à PostgreSQL établie');
});

pool.on('error', (err) => {
    console.error('Erreur PostgreSQL:', err);
});

// Fonction helper pour les requêtes
const query = async (text, params) => {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        if (process.env.NODE_ENV !== 'production') {
            console.log('Query:', { text: text.substring(0, 100), duration, rows: result.rowCount });
        }
        return result;
    } catch (error) {
        console.error('Erreur SQL:', { text: text.substring(0, 100), error: error.message });
        throw error;
    }
};

// Fonction pour les transactions
const transaction = async (callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    pool,
    query,
    transaction
};
