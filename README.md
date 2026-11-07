# DBD Builder

Site web perso, sans serveur, pour créer et retenir des builds **Dead by Daylight** (perks, add-ons, offrandes, notes, équipes).

- Données enregistrées dans le navigateur (`localStorage`), propres à chaque appareil.
- Sauvegarde et partage : export / import JSON (tout ou un seul build), export CSV pour Google Sheets, copie en texte pour Discord.
- Aucune dépendance : ouvrir `index.html` via un petit serveur statique, par exemple `python3 -m http.server 8765`.

## Crédits et mentions

Projet de fan, non officiel, sans lien avec Behaviour Interactive.

- *Dead by Daylight*, ses noms, perks et visuels sont la propriété de **Behaviour Interactive Inc.**
- Descriptions des perks : résumés du site officiel [deadbydaylight.com](https://deadbydaylight.com) et textes du wiki Dead by Daylight (Fandom), disponibles sous licence **CC BY-SA** ([voir la licence](https://www.fandom.com/licensing)). Le script `outils/fetch-descriptions.mjs` les récupère.
- Icônes de perks : issues du wiki Dead by Daylight et du jeu, utilisées à titre d'illustration.

Si tu es ayant droit et souhaites le retrait d'un contenu, ouvre une issue sur ce dépôt.
