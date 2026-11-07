# Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versions numérotées `MAJEUR.MINEUR.CORRECTIF`.

## [Non publié]

### Accessibilité
- Puces, étoiles, « Favori », « garder » et « retirer » sont de vrais boutons (clavier, `aria-pressed`), non imbriqués ; « Importer » est atteignable au clavier.
- Lignes du sélecteur de perks navigables au clavier ; perks déjà pris désactivés.
- Le focus est conservé ou rendu au bon bouton après un changement d'emplacement ; infobulle des perks affichée au focus clavier, fermée par Échap.
- Champs et listes déroulantes nommés pour les lecteurs d'écran ; contour de focus visible partout.
- Cibles tactiles plus grandes sur mobile ; les messages longs restent affichés plus longtemps.

### Cohérence et vocabulaire
- « Annuler » dans l'éditeur ne demande confirmation que si le build a été modifié.
- Une équipe créée puis quittée sans rien y mettre est supprimée automatiquement.
- Copies numérotées « (copie 2) » au lieu de « (copie) (copie) » ; message indiquant que l'on modifie la copie.
- Libellés harmonisés : « Exporter tout » / « Exporter CSV » / « Importer », « Copier en texte », « Dupliquer l'équipe », « Copier un build ici… », « catégories » au lieu de « rôles » ou « types » pour les perks.
- « Mes builds » reste actif dans le menu pendant la modification d'un build ; le sous-titre des cartes ne répète plus le badge.
- Nom généré « Soin + Chase (généré) » ; date du CSV en heure locale.

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
