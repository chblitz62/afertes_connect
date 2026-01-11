# Améliorations futures - AFERTES Connect

## Performance
- [ ] Minifier les fichiers JS/CSS pour la production
- [ ] Ajouter du lazy loading pour les images et modules non critiques
- [ ] Mettre en cache les appels API fréquents (emplois du temps, notes)

## UX/Interface
- [x] Ajouter un skeleton loading au lieu des spinners pour un ressenti plus fluide
- [x] Notifications push réelles via Service Worker (actuellement simulées)
- [x] Mode hors-ligne amélioré avec sync automatique au retour en ligne

## Fonctionnalités
- [ ] Export PDF des emplois du temps
- [ ] Système de rappels personnalisables (cours, devoirs, émargement)
- [ ] Statistiques de présence pour les formateurs (graphiques)
- [ ] Chat en temps réel avec WebSocket (actuellement polling simulé)

## Technique
- [ ] Migrer les shims inline (Yjs, y-quill) vers des fichiers locaux bundlés
- [ ] Ajouter des tests automatisés (Jest pour le backend)
- [ ] Unifier les deux systèmes de notifications (`afertes_notifications` et `afertes_notifs_${userId}`)
- [ ] Ajouter de la validation côté serveur plus stricte

## Sécurité
- [ ] Ajouter CSRF tokens pour les formulaires
- [ ] Implémenter le refresh token pour les sessions longues
- [ ] Logs d'audit pour les actions sensibles
