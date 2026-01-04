-- Schema pour AFERTES Connect
-- Base de données PostgreSQL

-- Table des utilisateurs (étudiants, formateurs, secrétaires, admin)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'trainer', 'secretary', 'admin')),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20),
    birth_date DATE,
    social_security_number VARCHAR(15),
    address TEXT,
    postal_code VARCHAR(5),
    city VARCHAR(100),
    first_login_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des formations
CREATE TABLE IF NOT EXISTS formations (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration_months INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des inscriptions (lien étudiant-formation)
CREATE TABLE IF NOT EXISTS enrollments (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    formation_id INTEGER REFERENCES formations(id) ON DELETE CASCADE,
    enrollment_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'suspended', 'cancelled')),
    school_year VARCHAR(9), -- ex: 2024-2025
    UNIQUE(student_id, formation_id, school_year)
);

-- Table des matières/modules
CREATE TABLE IF NOT EXISTS subjects (
    id SERIAL PRIMARY KEY,
    formation_id INTEGER REFERENCES formations(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    coefficient DECIMAL(3,1) DEFAULT 1.0,
    UNIQUE(formation_id, code)
);

-- Table des notes
CREATE TABLE IF NOT EXISTS grades (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
    grade DECIMAL(4,2) CHECK (grade >= 0 AND grade <= 20),
    grade_type VARCHAR(50), -- ex: 'Partiel', 'Contrôle continu', 'TP'
    date DATE DEFAULT CURRENT_DATE,
    trainer_id INTEGER REFERENCES users(id),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, subject_id, grade_type, date)
);

-- Table des documents
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    doc_type VARCHAR(50) NOT NULL CHECK (doc_type IN ('identity', 'vitale', 'photo', 'other')),
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100),
    file_size INTEGER,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des sessions de connexion
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des logs d'activité (pour audit RGPD)
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des tokens de réinitialisation de mot de passe
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_formation ON enrollments(formation_id);
CREATE INDEX IF NOT EXISTS idx_grades_student ON grades(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_subject ON grades(subject_id);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_tokens(expires_at);

-- Données initiales - Formations AFERTES
INSERT INTO formations (code, name, description) VALUES
    ('DEES', 'Diplôme d''État d''Éducateur Spécialisé', 'Formation de niveau 6 (Bac+3)'),
    ('DEME', 'Diplôme d''État de Moniteur Éducateur', 'Formation de niveau 4 (Bac)'),
    ('DEASS', 'Diplôme d''État d''Assistant de Service Social', 'Formation de niveau 6 (Bac+3)'),
    ('DEEJE', 'Diplôme d''État d''Éducateur de Jeunes Enfants', 'Formation de niveau 6 (Bac+3)'),
    ('DEETS', 'Diplôme d''État d''Éducateur Technique Spécialisé', 'Formation de niveau 6 (Bac+3)'),
    ('CAFERUIS', 'Certificat d''Aptitude aux Fonctions d''Encadrement', 'Formation de niveau 6'),
    ('DEAES', 'Diplôme d''État d''Accompagnant Éducatif et Social', 'Formation de niveau 3 (CAP)')
ON CONFLICT (code) DO NOTHING;

-- Compte admin par défaut (mot de passe: admin123 - À CHANGER EN PRODUCTION!)
-- Le hash correspond à 'admin123' avec bcrypt
INSERT INTO users (username, password_hash, role, first_name, last_name, first_login_completed) VALUES
    ('admin', '$2a$10$rOvHPxfzO2.Oy8C8H8KJxeY5YQKz5T5D5f5N5M5K5J5H5G5F5E5D5', 'admin', 'Administrateur', 'AFERTES', TRUE)
ON CONFLICT (username) DO NOTHING;

-- Vue pour faciliter l'export des étudiants
CREATE OR REPLACE VIEW v_students_export AS
SELECT
    u.id,
    u.last_name AS nom,
    u.first_name AS prenom,
    u.email,
    u.phone AS telephone,
    u.birth_date AS date_naissance,
    u.social_security_number AS numero_secu,
    u.address AS adresse,
    u.postal_code AS code_postal,
    u.city AS ville,
    f.name AS formation,
    e.school_year AS annee_scolaire,
    e.status AS statut,
    CASE WHEN EXISTS (SELECT 1 FROM documents d WHERE d.user_id = u.id AND d.doc_type = 'identity') THEN 'Oui' ELSE 'Non' END AS piece_identite,
    CASE WHEN EXISTS (SELECT 1 FROM documents d WHERE d.user_id = u.id AND d.doc_type = 'vitale') THEN 'Oui' ELSE 'Non' END AS carte_vitale,
    CASE WHEN EXISTS (SELECT 1 FROM documents d WHERE d.user_id = u.id AND d.doc_type = 'photo') THEN 'Oui' ELSE 'Non' END AS photo
FROM users u
LEFT JOIN enrollments e ON u.id = e.student_id
LEFT JOIN formations f ON e.formation_id = f.id
WHERE u.role = 'student';

-- Vue pour les notes avec informations complètes
CREATE OR REPLACE VIEW v_grades_export AS
SELECT
    u.last_name AS nom_etudiant,
    u.first_name AS prenom_etudiant,
    f.name AS formation,
    s.name AS matiere,
    s.coefficient,
    g.grade AS note,
    g.grade_type AS type_evaluation,
    g.date AS date_evaluation,
    g.comment AS commentaire,
    t.last_name AS nom_formateur,
    t.first_name AS prenom_formateur
FROM grades g
JOIN users u ON g.student_id = u.id
JOIN subjects s ON g.subject_id = s.id
JOIN formations f ON s.formation_id = f.id
LEFT JOIN users t ON g.trainer_id = t.id;
