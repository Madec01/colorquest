# Colorquest

Un RTS minimaliste conçu en priorité pour téléphone en portrait : colorez la toile, développez un réseau de relais et coupez celui de votre adversaire.

## V0.3 — développer et commander

- File de recrutement (six places) avec durée, progression et annulation : remboursement intégral avant formation, 50 % une fois commencée.
- Point de ralliement des renforts ; trois escouades mémorisées et ordres tenir, attaque et repli.
- Cœur et bâtiments de niveau 1 à 3. Le Cœur niveau 2 débloque les spécialistes et le choix de spécialisation.
- Une spécialisation par partie : expansion, fortification ou mobilité. Les effets et coûts sont indiqués avant le choix.
- Ingénieur qui répare les bâtiments proches ; saboteur efficace contre les relais.
- Panneau **Camp & armée** adapté au téléphone, en complément des commandes rapides.

Le zoom, la minimap, les fiches, les alertes de réseau et le tutoriel interactif de sept étapes de la V0.2 restent disponibles. Les unités du tutoriel attendent maintenant leur formation réelle.

## Installer sur téléphone

Ouvrir le jeu en HTTPS, puis utiliser **Installer sur mon téléphone** dans le menu. Si le navigateur permet une invite d’installation, le bouton la propose ; sinon un guide est affiché, notamment pour l’ajout à l’écran d’accueil sur iPhone.

Attendre l’indication de disponibilité hors ligne lors de la première ouverture. Ensuite les fichiers du jeu peuvent être chargés sans réseau. Les mises à jour sont proposées sans rechargement imposé pendant une partie.

**Le cache hors ligne n’est pas une sauvegarde de partie** : quitter ou recharger fait perdre la progression en cours. L’installation n’est pas disponible depuis un simple fichier local.

## Jouer

Télécharger le dépôt puis ouvrir **index.html** dans un navigateur récent. Aucun serveur ni installation nécessaire. Les fichiers doivent rester ensemble, notamment le dossier assets.

Pour servir le jeu localement : `python3 -m http.server 8000`, puis ouvrir http://localhost:8000.

Version en ligne : https://madec01.github.io/colorquest/ (GitHub Pages).

## Vérification du moteur

```sh
node tests/engine.test.js
node tests/tutorial.test.cjs
node tests/v03.test.cjs
```

Tests navigateur facultatifs : installer Playwright et son navigateur Chromium dans votre environnement de développement, puis exécuter `node tests/camera.browser.cjs`, `node tests/tutorial.browser.cjs`, `node tests/v03.browser.cjs` et `node tests/pwa.browser.cjs`. La variable `PLAYWRIGHT_CHROMIUM_EXECUTABLE` permet de sélectionner un navigateur déjà installé. Le jeu lui-même ne nécessite aucune dépendance.

## Principe

Développez votre territoire avec les relais, exploitez les sources de pigment et recrutez une armée. Seul le terrain relié au Cœur compte pour la domination. Couper une liaison affaiblit toute une branche.

Sur téléphone : touchez une unité (ou « Toute l’armée »), puis **Donner un ordre**, puis sa destination. Glissez pour déplacer la carte et pincez pour zoomer. Les onglets du bas donnent accès aux constructions, aux unités et aux pouvoirs. Le bouton « ? » ouvre l’aide.

Les contrôles et les prix sont indiqués dans le jeu. Une première partie en mode détente est conseillée.

## Fichiers

- `engine.js` : simulation, économie, déplacements, combats, IA et conditions de victoire.
- `app.js` : affichage Canvas, commandes, audio et interface.
- `camera.js` / `camera.css` : gestes, caméra et minimap.
- `readability.js` / `readability.css` : fiches, frontières, trajets et alertes.
- `tutorial.js` / `tutorial.css` : scénario pédagogique, étapes et guidage.
- `strategy.js` / `strategy.css` : production, progression et escouades.
- `manifest.webmanifest`, `sw.js`, `install.js` / `install.css` : installation et cache hors ligne.
- `style.css` et `index.html` : présentation et menus.
- `FEUILLE_DE_ROUTE.md` : suivi vivant du projet.
- `ASSETS.md` : provenance et licences des ressources.
- `AGENTS.md` : règles de travail pour les prochaines sessions.

Cette première version sert à tester le plaisir de conquête et l'équilibrage ; elle ne constitue pas encore une version commerciale finalisée.
