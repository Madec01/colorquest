# Colorquest

Un RTS minimaliste conçu en priorité pour téléphone en portrait : colorez la toile, développez un réseau de relais et coupez celui de votre adversaire.

## Jouer

Télécharger le dépôt puis ouvrir **index.html** dans un navigateur récent. Aucun serveur ni installation nécessaire. Les fichiers doivent rester ensemble, notamment le dossier assets.

Pour servir le jeu localement : `python3 -m http.server 8000`, puis ouvrir http://localhost:8000.

Le dépôt contient une version statique compatible avec GitHub Pages. L'hébergement Pages doit être activé dans les paramètres du dépôt pour obtenir une adresse de jeu publique.

## Vérification du moteur

`node tests/engine.test.js`

## Principe

Développez votre territoire avec les relais, exploitez les sources de pigment et recrutez une armée. Seul le terrain relié au Cœur compte pour la domination. Couper une liaison affaiblit toute une branche.

Sur téléphone : touchez une unité (ou « Toute l’armée »), puis sa destination. Les onglets du bas donnent accès aux constructions, aux unités et aux pouvoirs. Le bouton « ? » ouvre l’aide.

Les contrôles et les prix sont indiqués dans le jeu. Une première partie en mode détente est conseillée.

## Fichiers

- `engine.js` : simulation, économie, déplacements, combats, IA et conditions de victoire.
- `app.js` : affichage Canvas, commandes, audio et interface.
- `style.css` et `index.html` : présentation et menus.
- `FEUILLE_DE_ROUTE.md` : suivi vivant du projet.
- `ASSETS.md` : provenance et licences des ressources.
- `AGENTS.md` : règles de travail pour les prochaines sessions.

Cette première version sert à tester le plaisir de conquête et l'équilibrage ; elle ne constitue pas encore une version commerciale finalisée.
