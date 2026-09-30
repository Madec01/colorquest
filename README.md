# Colorquest

Un RTS minimaliste conçu en priorité pour téléphone en portrait : colorez la toile, développez un réseau de relais et coupez celui de votre adversaire.

## V0.5 — choisir son terrain de conquête

- Trois cartes symétriques à choisir au menu : **La Plaine**, ouverte ; **Les Couloirs**, avec des passages à défendre ; **Le Carrefour**, au centre riche et disputé.
- Six réserves de **60 pigments** par carte : approchez une unité, sauf un ingénieur, pour les récupérer une seule fois. Un ennemi proche bloque la collecte.
- Huit sources, dont deux riches : un extracteur connecté sur une source riche produit **60 % de plus**.
- Papier absorbant : propagation des bâtiments deux fois moins fréquente. Terrain lisse : déplacement des unités **30 % plus rapide**. Touchez le nom de la carte pour la légende ou un terrain découvert, sans unité sélectionnée, pour son effet.
- IA limitée par sa vision, avec éclaireurs et mémoire des bâtiments observés. Les alertes d’attaque, de source perdue et de réseau coupé recentrent la caméra au toucher.
- Sauvegardes V0.4 compatibles : reprise sur la toile d’origine, sans changement du terrain ni ajout de ressources. La carte choisie au menu concerne la prochaine partie.

## V0.4 — reprendre sa conquête, choisir sa couleur

- Six couleurs dans le menu : cyan, bleu, violet, rose, vert et orange. Le camp adverse est assorti automatiquement ; le choix est mémorisé sur l’appareil.
- Sauvegarde locale automatique toutes les 10 secondes et lors des pauses, du passage en arrière-plan, du retour au menu et avant une mise à jour.
- **Reprendre la partie** retrouve l’état du jeu, la caméra et la sélection. La reprise est en pause : toucher **Reprendre** pour continuer. Le temps d’absence ne fait pas avancer l’IA.
- Le tutoriel conserve votre partie habituelle. Une nouvelle partie demande confirmation avant de remplacer la sauvegarde.
- Détente plus progressif : premiers raids après 3 min, pression accrue après 5 min, attaque volontaire du Cœur après 7 min. La victoire territoriale peut survenir avant ; Stratégie conserve son rythme.

Une seule sauvegarde par navigateur ou application, sur cet appareil. Il n’y a pas de synchronisation en ligne. Effacer les données du navigateur efface la partie ; une fermeture forcée peut perdre les dernières secondes depuis la dernière écriture. Un stockage indisponible ou plein est signalé. Les exercices du tutoriel ne sont pas sauvegardés.

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

Le cache hors ligne conserve les fichiers du jeu ; la sauvegarde locale conserve séparément la progression. L’installation n’est pas disponible depuis un simple fichier local. Les sauvegardes existent depuis la V0.4 ; une partie d’une version antérieure ne peut pas être récupérée rétroactivement.

## Jouer

Télécharger le dépôt puis ouvrir **index.html** dans un navigateur récent. Aucun serveur ni installation nécessaire. Les fichiers doivent rester ensemble, notamment le dossier assets.

Pour servir le jeu localement : `python3 -m http.server 8000`, puis ouvrir http://localhost:8000.

Version en ligne : https://madec01.github.io/colorquest/ (GitHub Pages).

## Vérification du moteur

```sh
node tests/engine.test.js
node tests/tutorial.test.cjs
node tests/v03.test.cjs
node tests/snapshots.test.cjs
node tests/world.test.cjs
node tests/balance.test.cjs
```

Tests navigateur : installer Playwright et son navigateur Chromium dans votre environnement de développement, puis exécuter les fichiers `tests/camera.browser.cjs`, `tests/tutorial.browser.cjs`, `tests/v03.browser.cjs`, `tests/pwa.browser.cjs`, `tests/session.browser.cjs`, `tests/palette.browser.cjs`, `tests/world.browser.cjs`, `tests/alerts.browser.cjs` et `tests/migration.browser.cjs` avec `node`. La variable `PLAYWRIGHT_CHROMIUM_EXECUTABLE` permet de sélectionner un navigateur déjà installé. Le jeu lui-même ne nécessite aucune dépendance.

## Principe

Développez votre territoire avec les relais, exploitez les sources de pigment et recrutez une armée. Seul le terrain relié au Cœur compte pour la domination. Couper une liaison affaiblit toute une branche.

Sur téléphone : touchez une unité (ou « Toute l’armée »), puis **Donner un ordre**, puis sa destination. Glissez pour déplacer la carte et pincez pour zoomer. Les onglets du bas donnent accès aux constructions, aux unités et aux pouvoirs. Le bouton « ? » ouvre l’aide.

Les contrôles et les prix sont indiqués dans le jeu. Une première partie en mode détente est conseillée.

## Fichiers

- `engine.js` : simulation, économie, déplacements, combats, IA et conditions de victoire.
- `maps.js` : disposition des trois cartes, terrains et ressources, commune au moteur et aux aperçus.
- `app.js` : affichage Canvas, commandes, audio et interface.
- `world-ui.js` / `world-ui.css` : sélection de carte, légende, inspection et rendu des terrains/objectifs.
- `alerts.js` / `alerts.css` : alertes tactiles d’attaque, de source et de réseau.
- `camera.js` / `camera.css` : gestes, caméra et minimap.
- `readability.js` / `readability.css` : fiches, frontières et trajets.
- `tutorial.js` / `tutorial.css` : scénario pédagogique, étapes et guidage.
- `strategy.js` / `strategy.css` : production, progression et escouades.
- `snapshots.js` : format versionné, validation et restauration déterministe de la simulation.
- `session.js` / `session.css` : sauvegarde locale, reprise et cycle de vie mobile.
- `palette.js` / `palette.css` : couleurs des camps et préférence locale.
- `manifest.webmanifest`, `sw.js`, `install.js` / `install.css` : installation et cache hors ligne.
- `style.css` et `index.html` : présentation et menus.
- `FEUILLE_DE_ROUTE.md` : suivi vivant du projet.
- `ASSETS.md` : provenance et licences des ressources.
- `AGENTS.md` : règles de travail pour les prochaines sessions.

Ce prototype sert à tester le plaisir de conquête et l’équilibrage. Les parcours tactiles sont vérifiés en Chromium émulé ; les essais sur téléphones physiques et les retours de parties humaines restent nécessaires.
