-- Migration: Documents Collaboratifs
-- Date: 2024
-- Description: Ajoute les tables pour l'édition collaborative de documents temps réel

-- Table principale des documents collaboratifs
CREATE TABLE IF NOT EXISTS collaborative_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,

    -- Contenu Yjs sérialisé (état CRDT)
    yjs_state BYTEA,

    -- Contenu HTML pour preview/indexation (généré depuis Yjs)
    html_content TEXT,

    -- Métadonnées
    owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    visibility VARCHAR(20) DEFAULT 'private'
        CHECK (visibility IN ('private', 'formation', 'public')),
    formation_id INTEGER REFERENCES formations(id) ON DELETE SET NULL,

    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_edited_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Permissions granulaires par document
CREATE TABLE IF NOT EXISTS document_permissions (
    id SERIAL PRIMARY KEY,
    document_id UUID REFERENCES collaborative_documents(id) ON DELETE CASCADE,

    -- Cible de la permission (utilisateur OU rôle OU formation)
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) CHECK (role IN ('student', 'trainer', 'secretary', 'admin')),
    formation_id INTEGER REFERENCES formations(id) ON DELETE CASCADE,

    -- Niveau de permission
    permission VARCHAR(20) NOT NULL
        CHECK (permission IN ('view', 'comment', 'edit', 'admin')),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Contraintes d'unicité
    UNIQUE(document_id, user_id),
    UNIQUE(document_id, role),
    UNIQUE(document_id, formation_id)
);

-- Historique des versions (snapshots périodiques)
CREATE TABLE IF NOT EXISTS document_versions (
    id SERIAL PRIMARY KEY,
    document_id UUID REFERENCES collaborative_documents(id) ON DELETE CASCADE,

    -- Snapshot de l'état Yjs
    yjs_snapshot BYTEA NOT NULL,
    html_preview TEXT,

    -- Métadonnées
    version_number INTEGER NOT NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    comment VARCHAR(500),

    UNIQUE(document_id, version_number)
);

-- Sessions de collaboration actives (pour présence)
CREATE TABLE IF NOT EXISTS document_sessions (
    id SERIAL PRIMARY KEY,
    document_id UUID REFERENCES collaborative_documents(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

    -- Informations de présence
    cursor_position JSONB,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    color VARCHAR(7), -- Couleur du curseur (#RRGGBB)

    UNIQUE(document_id, user_id)
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_collab_docs_owner ON collaborative_documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_collab_docs_formation ON collaborative_documents(formation_id);
CREATE INDEX IF NOT EXISTS idx_collab_docs_visibility ON collaborative_documents(visibility);
CREATE INDEX IF NOT EXISTS idx_collab_docs_slug ON collaborative_documents(slug);
CREATE INDEX IF NOT EXISTS idx_collab_docs_updated ON collaborative_documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_doc_permissions_document ON document_permissions(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_permissions_user ON document_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_doc_versions_document ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_versions_created ON document_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doc_sessions_document ON document_sessions(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_sessions_last_seen ON document_sessions(last_seen_at);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_collab_doc_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS trigger_update_collab_doc_timestamp ON collaborative_documents;
CREATE TRIGGER trigger_update_collab_doc_timestamp
    BEFORE UPDATE ON collaborative_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_collab_doc_timestamp();

-- Fonction pour nettoyer les sessions inactives (> 5 minutes)
CREATE OR REPLACE FUNCTION cleanup_inactive_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM document_sessions
    WHERE last_seen_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;
