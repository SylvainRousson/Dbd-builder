# Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versions numérotées `MAJEUR.MINEUR.CORRECTIF`.

## [0.1.0] - 2026-11-07

Première version publiée.

### Fonctionnalités
- Création, modification, duplication et suppression de builds Survivant et Tueur (perks, objet ou pouvoir, add-ons, offrande, styles de jeu, tags, note, favori).
- Sélecteur de perks avec recherche français / anglais, catégories, renommage des noms et perks personnalisés.
- Générateur de builds par types de perks, avec perks verrouillables.
- Perks recommandés et avertissements (perks incompatibles, épuisement).
- Équipes de 4 survivants, avec repérage des doublons et des rôles non couverts.
- Infobulles de description des perks.
- Recherche, filtres (rôle, tueur, tag, favoris) et tris ; compteur et réinitialisation des filtres.
- Sauvegarde : export / import JSON (tout ou un seul build), avec validation du fichier et confirmation avant d'écraser ; export CSV ; copie d'un build en texte.

### Données
- Enregistrées dans le navigateur (`localStorage`), propres à chaque appareil.
