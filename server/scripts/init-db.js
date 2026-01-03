/**
 * Script d'initialisation de la base de données
 * Usage: npm run init-db
 */

require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'afertes_connect',
    user: process.env.DB_USER || 'afertes',
    password: process.env.DB_PASSWORD,
});

async function initDatabase() {
    console.log('╔═══════════════════════════════════════╗');
    console.log('║  Initialisation de la base de données ║');
    console.log('╚═══════════════════════════════════════╝\n');

    try {
        // Lire et exécuter le schéma SQL
        const schemaPath = path.join(__dirname, '../database/schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        console.log('➤ Exécution du schéma SQL...');
        await pool.query(schema);
        console.log('✓ Schéma créé avec succès\n');

        // Créer le mot de passe admin par défaut
        console.log('➤ Création du compte admin...');
        const adminPassword = process.env.ADMIN_PASSWORD || 'Admin2024!';
        const hash = await bcrypt.hash(adminPassword, 10);

        await pool.query(
            `UPDATE users SET password_hash = $1 WHERE username = 'admin'`,
            [hash]
        );
        console.log('✓ Compte admin créé (mot de passe: ' + adminPassword + ')\n');

        // Créer quelques comptes de test si en mode développement
        if (process.env.NODE_ENV !== 'production') {
            console.log('➤ Création des comptes de test...');

            // Secrétaire
            const secretaryHash = await bcrypt.hash('Secret2024!', 10);
            await pool.query(
                `INSERT INTO users (username, password_hash, role, first_name, last_name, first_login_completed)
                 VALUES ('secretaire', $1, 'secretary', 'Marie', 'Dupont', TRUE)
                 ON CONFLICT (username) DO NOTHING`,
                [secretaryHash]
            );

            // Formateur
            const trainerHash = await bcrypt.hash('Trainer2024!', 10);
            await pool.query(
                `INSERT INTO users (username, password_hash, role, first_name, last_name, first_login_completed)
                 VALUES ('formateur', $1, 'trainer', 'Jean', 'Martin', TRUE)
                 ON CONFLICT (username) DO NOTHING`,
                [trainerHash]
            );

            // Étudiant
            const studentHash = await bcrypt.hash('Student2024!', 10);
            const studentResult = await pool.query(
                `INSERT INTO users (username, password_hash, role, first_name, last_name, first_login_completed)
                 VALUES ('etudiant', $1, 'student', 'Pierre', 'Durand', FALSE)
                 ON CONFLICT (username) DO UPDATE SET id = users.id
                 RETURNING id`,
                [studentHash]
            );

            // Inscrire l'étudiant à une formation
            if (studentResult.rows.length > 0) {
                const formationResult = await pool.query('SELECT id FROM formations WHERE code = $1', ['DEES']);
                if (formationResult.rows.length > 0) {
                    await pool.query(
                        `INSERT INTO enrollments (student_id, formation_id, school_year)
                         VALUES ($1, $2, '2024-2025')
                         ON CONFLICT DO NOTHING`,
                        [studentResult.rows[0].id, formationResult.rows[0].id]
                    );
                }
            }

            console.log('✓ Comptes de test créés:\n');
            console.log('  ┌──────────────┬────────────────┬──────────────┐');
            console.log('  │ Utilisateur  │ Mot de passe   │ Rôle         │');
            console.log('  ├──────────────┼────────────────┼──────────────┤');
            console.log('  │ admin        │ Admin2024!     │ admin        │');
            console.log('  │ secretaire   │ Secret2024!    │ secretary    │');
            console.log('  │ formateur    │ Trainer2024!   │ trainer      │');
            console.log('  │ etudiant     │ Student2024!   │ student      │');
            console.log('  └──────────────┴────────────────┴──────────────┘\n');
        }

        console.log('╔═══════════════════════════════════════╗');
        console.log('║  ✓ Initialisation terminée !          ║');
        console.log('╚═══════════════════════════════════════╝');

    } catch (error) {
        console.error('✗ Erreur lors de l\'initialisation:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

initDatabase();
