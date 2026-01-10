#!/bin/bash
# Fonctions communes pour les scripts YunoHost

# Version de Node.js requise
NODEJS_VERSION=20

# Nom du service
SERVICE_NAME="$app"

# Fonction pour obtenir le chemin de l'application
get_final_path() {
    echo "/var/www/$app"
}

# Fonction pour obtenir le chemin des données
get_data_path() {
    echo "/home/yunohost.app/$app"
}
