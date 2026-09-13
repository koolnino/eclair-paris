# Éclair Paris

Projet de classement des meilleurs éclairs au chocolat à Paris.

## Objectif
- recenser les boulangeries et pâtisseries parisiennes
- géolocaliser les établissements
- identifier les établissements proposant un éclair au chocolat
- permettre les votes utilisateurs
- distinguer les dégustations vérifiées
- proposer un classement global et par arrondissement
- gérer les favoris et les établissements "à tester"

## Architecture actuelle
- Frontend / prototype : Base44
- Base de données : Supabase
- Versioning cible : GitHub
- Développement assisté : Codex / ChatGPT

## Données
Ne jamais considérer comme vérifiée une information générée automatiquement.
Chaque établissement/éclair doit pouvoir porter :
- une source
- une date de vérification
- un statut de disponibilité

## Priorités
1. Import large des boulangeries/pâtisseries de Paris
2. Déduplication
3. Distinction établissement recensé / éclair vérifié
4. Géolocalisation et carte
5. Vote multicritère sur 100
6. Favoris
7. Authentification
8. Publication iPhone/PWA
