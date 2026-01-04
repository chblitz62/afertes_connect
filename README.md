# AFERTES Connect

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa)](https://web.dev/progressive-web-apps/)

Application web progressive (PWA) pour le centre de formation en travail social AFERTES. Portail unifié pour les étudiants, formateurs et secrétaires.

## Description du projet

AFERTES Connect est une plateforme complète de gestion de formation qui permet :

- **Gestion des étudiants** : inscription, suivi, documents administratifs
- **Gestion des notes** : saisie, consultation, export des bulletins
- **Emplois du temps** : affichage, création, modification
- **Messagerie** : communication entre utilisateurs et groupes
- **Émargement** : signature électronique de présence (code PIN ou QR code)
- **Évaluations en ligne** : QCM et questionnaires
- **Espace documentaire** : stockage et partage de fichiers

### Rôles utilisateurs

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
git clone https://github.com/votre-repo/afertes-app.git
cd afertes-app
```

### 2. Installer les dépendances

```bash
# Dépendances du serveur
cd server
npm install
cd ..
```

### 3. Configurer PostgreSQL

Créer une base de données PostgreSQL :

```sql
CREATE DATABASE afertes_connect;
CREATE USER afertes WITH PASSWORD 'votre_mot_de_passe';
GRANT ALL PRIVILEGES ON DATABASE afertes_connect TO afertes;
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

# Admin (optionnel - par défaut: Admin2024!)
ADMIN_PASSWORD=Admin2024!
```

### 5. Initialiser la base de données

```bash
cd server
npm run init-db
```

Cette commande crée les tables et insère les données initiales (formations, compte admin).

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

## Structure du projet

```
afertes-app/
├── index.html              # Application frontend (SPA)
├── css/
│   ├── style.css           # Styles principaux
│   ├── features.css        # Styles des fonctionnalités
│   └── accessibility.css   # Styles d'accessibilité
├── js/
│   ├── app.js              # Logique principale
│   ├── api.js              # Client API
│   ├── api-adapter.js      # Adaptateur API/mode démo
│   ├── features.js         # Fonctionnalités avancées
│   ├── accessibility.js    # Fonctions d'accessibilité
│   └── data.js             # Données de démonstration
├── img/                    # Images et icônes
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
│   │   ├── formations.js   # Gestion formations
│   │   ├── documents.js    # Gestion documents
│   │   └── export.js       # Export Excel/PDF
│   ├── middleware/
│   │   └── auth.js         # Middleware JWT
│   ├── scripts/
│   │   └── init-db.js      # Initialisation BDD
│   └── tests/
│       └── security.test.js # Tests de sécurité
├── manifest.json           # Configuration PWA
├── sw.js                   # Service Worker
└── README.md
```

## API Endpoints principaux

### Authentification

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/login` | Connexion |
| POST | `/api/auth/logout` | Déconnexion |
| GET | `/api/auth/me` | Utilisateur courant |
| POST | `/api/auth/change-password` | Changer mot de passe |
| POST | `/api/auth/forgot-password` | Demande de réinitialisation |
| POST | `/api/auth/reset-password` | Réinitialiser avec token |

### Utilisateurs

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/users` | Liste des utilisateurs |
| GET | `/api/users/:id` | Détails utilisateur |
| PUT | `/api/users/:id` | Mettre à jour utilisateur |
| DELETE | `/api/users/:id` | Supprimer utilisateur |

### Étudiants

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/students` | Liste des étudiants |
| GET | `/api/students/:id` | Détails étudiant |
| POST | `/api/students` | Créer un étudiant |
| PUT | `/api/students/:id` | Mettre à jour étudiant |

### Notes

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/grades` | Liste des notes |
| GET | `/api/grades/student/:id` | Notes d'un étudiant |
| POST | `/api/grades` | Créer une note |
| POST | `/api/grades/bulk` | Saisie en masse |

### Documents

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/documents` | Liste des documents |
| POST | `/api/documents/upload` | Uploader un document |
| GET | `/api/documents/:id/download` | Télécharger un document |

### Exports

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/export/students` | Export liste étudiants (Excel) |
| GET | `/api/export/grades` | Export notes (Excel) |
| GET | `/api/export/bulletin/:id` | Bulletin étudiant (PDF) |

## Tests

### Exécuter les tests

```bash
cd server
npm test
```

Les tests vérifient :
- Validation des entrées (XSS, injection SQL)
- Authentification et autorisation
- Intégrité des données

### Tests de sécurité

```bash
node tests/security.test.js
```

## Sécurité

L'application implémente plusieurs mesures de sécurité :

- **Authentification JWT** avec expiration des tokens
- **Hachage bcrypt** des mots de passe (coût 10)
- **Rate limiting** sur les tentatives de connexion
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

## Comptes de test

Après initialisation de la base de données :

| Utilisateur | Mot de passe | Rôle |
|-------------|--------------|------|
| admin | Admin2024! | Administrateur |
| secretaire | Secret2024! | Secrétaire |
| formateur | Trainer2024! | Formateur |
| etudiant | Student2024! | Étudiant |

## Contribution

Les contributions sont les bienvenues ! Veuillez :

1. Forker le projet
2. Créer une branche (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Commiter vos changements (`git commit -m 'Ajout nouvelle fonctionnalité'`)
4. Pusher la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Ouvrir une Pull Request

## Licence

Ce projet est sous licence [GNU General Public License v3.0](LICENSE).

---

Développé pour la communauté AFERTES - Centre de formation en travail social
