# Guide de Déploiement AFERTES Connect sur YunoHost

## Prérequis

- YunoHost version 11.0 ou supérieure
- Accès SSH au serveur
- Un domaine ou sous-domaine configuré (ex: afertes-connect.votre-domaine.fr)

## Méthode 1 : Installation manuelle (recommandée pour commencer)

### Étape 1 : Connexion SSH

```bash
ssh admin@votre-serveur-yunohost
```

### Étape 2 : Installation de PostgreSQL

```bash
sudo yunohost app install postgresql
```

### Étape 3 : Création de la base de données

```bash
sudo -u postgres psql

# Dans PostgreSQL :
CREATE DATABASE afertes_connect;
CREATE USER afertes WITH ENCRYPTED PASSWORD 'votre_mot_de_passe_securise';
GRANT ALL PRIVILEGES ON DATABASE afertes_connect TO afertes;
\q
```

### Étape 4 : Installation de Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Étape 5 : Déploiement de l'application

```bash
# Créer le répertoire
sudo mkdir -p /var/www/afertes-connect
cd /var/www/afertes-connect

# Cloner le dépôt (ou copier les fichiers)
sudo git clone https://github.com/votre-repo/afertes-app.git .

# Installer les dépendances
cd server
sudo npm install --production
```

### Étape 6 : Configuration

```bash
# Copier et éditer le fichier de configuration
sudo cp .env.example .env
sudo nano .env
```

Contenu du fichier `.env` :

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=afertes_connect
DB_USER=afertes
DB_PASSWORD=votre_mot_de_passe_securise
JWT_SECRET=cle_aleatoire_64_caracteres_minimum_generee_avec_openssl_rand
JWT_EXPIRES_IN=24
NODE_ENV=production
APP_URL=https://afertes-connect.votre-domaine.fr
UPLOAD_DIR=/home/yunohost.app/afertes-connect/uploads
```

Générer une clé JWT sécurisée :
```bash
openssl rand -base64 64
```

### Étape 7 : Initialisation de la base de données

```bash
cd /var/www/afertes-connect/server
npm run init-db
```

### Étape 8 : Créer le service systemd

```bash
sudo nano /etc/systemd/system/afertes-connect.service
```

Contenu :

```ini
[Unit]
Description=AFERTES Connect
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/afertes-connect/server
ExecStart=/usr/bin/node index.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=afertes-connect
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable afertes-connect
sudo systemctl start afertes-connect
```

### Étape 9 : Configuration Nginx (proxy inverse)

```bash
sudo nano /etc/nginx/conf.d/afertes-connect.conf
```

Contenu :

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name afertes-connect.votre-domaine.fr;

    # Redirection HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name afertes-connect.votre-domaine.fr;

    # Certificats SSL (gérés par YunoHost/Let's Encrypt)
    ssl_certificate /etc/yunohost/certs/afertes-connect.votre-domaine.fr/crt.pem;
    ssl_certificate_key /etc/yunohost/certs/afertes-connect.votre-domaine.fr/key.pem;

    # Taille max des uploads (10 MB)
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Étape 10 : Certificat SSL

```bash
sudo yunohost domain cert install afertes-connect.votre-domaine.fr
```

## Méthode 2 : Installation via le catalogue YunoHost (à venir)

Une fois l'application packagée pour YunoHost :

```bash
sudo yunohost app install https://github.com/votre-repo/afertes-app
```

## Création des comptes utilisateurs

### Via l'interface admin

1. Connectez-vous avec `admin` / `Admin2024!`
2. Allez dans "Gestion des utilisateurs"
3. Cliquez sur "Ajouter un utilisateur"

### Import en masse via CSV

Préparez un fichier CSV :

```csv
username,password,role,firstName,lastName,email,formationCode
etudiant1,Etudiant2024!,student,Marie,Martin,marie.martin@email.fr,DEES
etudiant2,Etudiant2024!,student,Pierre,Durand,pierre.durand@email.fr,DEME
formateur1,Trainer2024!,trainer,Jean,Bernard,jean.bernard@afertes.fr,
```

## Sauvegardes

### Sauvegarde automatique (recommandé)

YunoHost gère les sauvegardes automatiquement. Vérifiez la configuration :

```bash
sudo yunohost backup list
```

### Sauvegarde manuelle de la base de données

```bash
sudo -u postgres pg_dump afertes_connect > backup_$(date +%Y%m%d).sql
```

### Sauvegarde des documents uploadés

```bash
sudo tar -czvf uploads_backup_$(date +%Y%m%d).tar.gz /home/yunohost.app/afertes-connect/uploads
```

## Monitoring

### Vérifier le statut du service

```bash
sudo systemctl status afertes-connect
```

### Voir les logs

```bash
sudo journalctl -u afertes-connect -f
```

### Vérifier la santé de l'API

```bash
curl https://afertes-connect.votre-domaine.fr/api/health
```

## Mise à jour

```bash
cd /var/www/afertes-connect
sudo git pull origin main
cd server
sudo npm install --production
sudo systemctl restart afertes-connect
```

## Dépannage

### L'application ne démarre pas

```bash
# Vérifier les logs
sudo journalctl -u afertes-connect -n 50

# Vérifier la connexion à la base de données
sudo -u postgres psql -c "SELECT 1" afertes_connect
```

### Erreur 502 Bad Gateway

```bash
# Vérifier que l'application tourne
sudo systemctl status afertes-connect

# Vérifier le port
sudo netstat -tlpn | grep 3000
```

### Problème de permissions

```bash
sudo chown -R www-data:www-data /var/www/afertes-connect
sudo chown -R www-data:www-data /home/yunohost.app/afertes-connect
```

## Performance pour 500+ utilisateurs

L'architecture actuelle supporte facilement 500+ utilisateurs. Recommandations :

| Composant | Configuration recommandée |
|-----------|--------------------------|
| RAM | 2 Go minimum |
| CPU | 2 cœurs minimum |
| Stockage | 20 Go SSD (pour les documents) |
| PostgreSQL | Configuration par défaut suffisante |

Pour plus de 1000 utilisateurs simultanés, envisagez :
- Augmenter les workers Node.js (PM2)
- Ajouter un système de cache (Redis)
- Configurer la réplication PostgreSQL

## Support

En cas de problème :
1. Consultez les logs : `sudo journalctl -u afertes-connect`
2. Vérifiez la documentation YunoHost
3. Contactez le support technique
