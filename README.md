# AFERTES Connect

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa)](https://web.dev/progressive-web-apps/)
[![YunoHost](https://img.shields.io/badge/YunoHost-Compatible-green?logo=yunohost)](https://yunohost.org/)

Application web progressive (PWA) pour le centre de formation en travail social AFERTES. Portail unifié pour les étudiants, formateurs et secrétaires.

## Fonctionnalités

### Gestion de formation
- **Gestion des étudiants** : inscription, suivi, documents administratifs
- **Gestion des notes** : saisie, consultation, export des bulletins
- **Emplois du temps** : affichage, création, modification
- **Messagerie** : communication entre utilisateurs et groupes
- **Émargement** : signature électronique de présence (code PIN ou QR code)
- **Évaluations en ligne** : QCM et questionnaires
- **Espace documentaire** : stockage et partage de fichiers

### Documents collaboratifs (Nouveau)
- **Édition temps réel** : plusieurs utilisateurs peuvent éditer simultanément
- **Éditeur riche** : formatage, listes, images, tableaux
- **Gestion des permissions** : lecture, édition, administration par document
- **Archivage** : archiver les documents sans les supprimer
- **Historique** : versions et suivi des modifications

### Sécurité
- **Réinitialisation de mot de passe** par email
- **Authentification JWT** avec expiration
- **Rate limiting** contre les attaques brute force
- **Mode sombre** pour l'accessibilité

## Rôles utilisateurs

| Rôle | Fonctionnalités |
|------|-----------------|
| **Étudiant** | Consulter notes, emploi du temps, signer présence, déposer documents |
| **Formateur** | Saisir notes, gérer emploi du temps, publier actualités, lancer émargement |
| **Secrétaire** | Gérer étudiants, inscriptions, documents, exports administratifs |
| **Administrateur** | Accès complet à toutes les fonctionnalités |

## Prérequis

- **Node.js** 18.0 ou supérieur
- **PostgreSQL** 14.0 ou supérieur
- **npm** 9.0 ou supérieur

## Installation

### 1. Cloner le dépôt

```bash
git clone https://github.com/chblitz62/afertes_connect.git
cd afertes_connect
```

### 2. Installer les dépendances

```bash
cd server
npm install
```

### 3. Configurer PostgreSQL

```sql
CREATE DATABASE afertes_connect;
CREATE USER afertes WITH PASSWORD 'votre_mot_de_passe';
GRANT ALL PRIVILEGES ON DATABASE afertes_connect TO afertes;
\c afertes_connect
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO afertes;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO afertes;
```

### 4. Configuration

Créer le fichier `.env` dans le dossier `server/` :

```env
# Base de données
DB_HOST=localhost
DB_PORT=5432
DB_NAME=afertes_connect
DB_USER=afertes
DB_PASSWORD=votre_mot_de_passe

# JWT
JWT_SECRET=votre_secret_jwt_securise_aleatoire

# Serveur
PORT=3000
NODE_ENV=development
APP_URL=http://localhost:3000

# Email (optionnel - pour la réinitialisation de mot de passe)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=password
SMTP_FROM="AFERTES Connect" <noreply@example.com>

# Admin (optionnel - par défaut: Admin2024!)
ADMIN_PASSWORD=Admin2024!
```

### 5. Initialiser la base de données

```bash
npm run init-db
```

## Lancement

### Mode développement

```bash
cd server
npm run dev
```

Le serveur démarre sur `http://localhost:3000` avec rechargement automatique.

### Mode production

```bash
cd server
npm start
```

## Déploiement YunoHost

AFERTES Connect est compatible avec [YunoHost](https://yunohost.org/).

### Installation sur YunoHost

```bash
# Installation depuis le catalogue (si publié)
sudo yunohost app install afertes-connect

# Ou installation depuis GitHub
sudo yunohost app install https://github.com/chblitz62/afertes_connect
```

### Configuration post-installation

1. Accédez à l'application via le domaine configuré
2. Connectez-vous avec le compte admin créé lors de l'installation
3. Configurez les paramètres SMTP pour l'envoi d'emails (optionnel)

### Mise à jour

```bash
sudo yunohost app upgrade afertes-connect
```

## Structure du projet

```
afertes-connect/
├── index.html              # Application frontend (SPA)
├── css/
│   ├── style.css           # Styles principaux
│   ├── features.css        # Styles des fonctionnalités
│   ├── collaborative.css   # Styles éditeur collaboratif
│   └── accessibility.css   # Styles d'accessibilité
├── js/
│   ├── app.js              # Logique principale
│   ├── api.js              # Client API
│   └── modules/
│       ├── auth.js         # Authentification
│       ├── ui.js           # Interface utilisateur
│       └── collab-ui.js    # Documents collaboratifs
├── server/
│   ├── index.js            # Point d'entrée du serveur
│   ├── database/
│   │   ├── db.js           # Connexion PostgreSQL
│   │   └── schema.sql      # Schéma de base de données
│   ├── routes/
│   │   ├── auth.js         # Authentification
│   │   ├── users.js        # Gestion utilisateurs
│   │   ├── students.js     # Gestion étudiants
│   │   ├── grades.js       # Gestion des notes
│   │   ├── documents.js    # Gestion documents
│   │   └── collaborative-documents.js  # Documents collaboratifs
│   ├── services/
│   │   └── mailer.js       # Service d'envoi d'emails
│   ├── middleware/
│   │   ├── auth.js         # Middleware JWT
│   │   └── document-access.js  # Permissions documents
│   └── websocket/
│       └── collab-server.js    # Serveur WebSocket collaboration
├── yunohost/               # Configuration YunoHost
│   ├── manifest.toml
│   ├── conf/
│   └── scripts/
├── manifest.json           # Configuration PWA
├── sw.js                   # Service Worker
└── README.md
```

## API Endpoints

### Authentification

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/login` | Connexion |
| POST | `/api/auth/logout` | Déconnexion |
| GET | `/api/auth/me` | Utilisateur courant |
| POST | `/api/auth/change-password` | Changer mot de passe |
| POST | `/api/auth/forgot-password` | Demande de réinitialisation |
| POST | `/api/auth/reset-password` | Réinitialiser avec token |

### Documents collaboratifs

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/collab/documents` | Liste des documents |
| POST | `/api/collab/documents` | Créer un document |
| GET | `/api/collab/documents/:id` | Détails d'un document |
| PUT | `/api/collab/documents/:id` | Modifier métadonnées |
| PUT | `/api/collab/documents/:id/archive` | Archiver |
| PUT | `/api/collab/documents/:id/unarchive` | Désarchiver |
| DELETE | `/api/collab/documents/:id` | Supprimer |

### Autres endpoints

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/users` | Liste des utilisateurs |
| GET | `/api/students` | Liste des étudiants |
| GET | `/api/grades` | Liste des notes |
| GET | `/api/documents` | Liste des documents |
| GET | `/api/export/students` | Export Excel |
| GET | `/api/export/bulletin/:id` | Bulletin PDF |

## Configuration email

Pour activer l'envoi réel d'emails (réinitialisation de mot de passe), configurez les variables SMTP :

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre-email@gmail.com
SMTP_PASS=votre-mot-de-passe-application
SMTP_FROM="AFERTES Connect" <noreply@afertes.org>
```

Sans configuration SMTP, les emails sont simulés et affichés dans la console du serveur (mode démo).

## Sécurité

L'application implémente plusieurs mesures de sécurité :

- **Authentification JWT** avec expiration des tokens (24h)
- **Hachage bcrypt** des mots de passe (coût 10)
- **Rate limiting** sur les tentatives de connexion (5 essais, blocage 15 min)
- **Validation des entrées** contre XSS et injection SQL
- **CORS** configuré pour les domaines autorisés
- **Headers de sécurité** (Helmet)
- **HTTPS** recommandé en production

## Accessibilité

L'application respecte les standards WCAG 2.1 niveau AA :

- Navigation au clavier
- Attributs ARIA pour les lecteurs d'écran
- Contraste des couleurs suffisant
- Mode sombre disponible
- Taille de police ajustable

## Tests

```bash
cd server
npm test
```

## Comptes de test

Après initialisation de la base de données :

| Utilisateur | Mot de passe | Rôle |
|-------------|--------------|------|
| admin | Admin2024! | Administrateur |

## Contribution

Les contributions sont les bienvenues ! Veuillez :

1. Forker le projet
2. Créer une branche (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Commiter vos changements (`git commit -m 'Ajout nouvelle fonctionnalité'`)
4. Pusher la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Ouvrir une Pull Request

## Licence

Ce projet est sous licence [Apache License 2.0](LICENSE).

---

Développé pour la communauté AFERTES - Centre de formation en travail social
