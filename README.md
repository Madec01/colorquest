# Colorquest

Un RTS minimaliste conçu en priorité pour téléphone en portrait : colorez la toile, développez un réseau de relais et coupez celui de votre adversaire.

## V0.7.1 — apprendre à peindre et commander au doigt

Le nouveau mode est accessible en tête du menu, avec **Apprendre à peindre** et **Combat libre**. Le duel dure au plus quatre minutes, avec trente secondes de prolongation si les territoires connectés sont exactement égaux. La campagne et le mode libre classiques restent accessibles avec leurs sauvegardes.

- **Peindre** : toucher Pinceau, tracer depuis sa couleur connectée sur le blanc visible, puis lever le doigt. Le chemin et son coût sont montrés avant l’achat. Une portion impossible apparaît en pointillés rouges ; seule la partie valide qui la précède est peinte et payée. Revenir au départ annule le trait. Après un trait, retour à la navigation ; un double toucher sur le bouton Pinceau le verrouille, un toucher le déverrouille.
- **Jouer une carte** : glisser depuis la main et lâcher sur une case valide ; revenir dans la main annule. On peut aussi toucher une carte puis son emplacement. Bâtiments sur son réseau, extracteurs sur une source, pouvoirs sur une cible visible à portée. La main conserve quatre cartes et annonce la suivante.
- **Inspecter** : toucher un bâtiment ou une source affiche son rôle et son état. La pause d’une caserne passe par le bouton de sa fiche ; consulter la fiche ne modifie pas sa production.
- **Commander** : glisser depuis une caserne ou le Cœur redirige son groupe. Glisser depuis le producteur puis revenir dessus rappelle ses unités ; le bouton Rappeler offre le même ordre. Elles rentrent sans riposter, restent vulnérables, puis défendent à l’arrivée. Un envoi normal combat sur le trajet.
- **Comprendre les dépenses** : une caserne forme une goutte toutes les cinq secondes de production, pour six pigments prélevés à sa sortie. La jauge montre le revenu et la consommation prévue des producteurs actifs ; chaque sortie affiche son prélèvement. Les producteurs attendent pendant la visée, faute de pigment, hors réseau ou au plafond d’unités.
- **Gagner** : effacer le Cœur adverse, tenir strictement plus de 50 % du territoire connecté avec une avance pendant 15 secondes, ou avoir le plus grand territoire à la fin du temps. En cas d’égalité à quatre minutes, prolongation de trente secondes : au terme, une seule case d’avance suffit ; égalité persistante = match nul. La dernière minute accélère la recharge des deux camps, y compris pendant la prolongation.
- **Apprendre** : six situations introduisent rejoindre une source, poser l’extracteur, produire et attaquer, reconnecter par le terrain neutre, rappeler pour défendre, puis dominer. Un objectif à la fois, avec les commandes du combat. Le revenu de la source vient de l’extracteur ; une case ennemie ne peut pas être repeinte au pinceau.
- **Se repérer** : silhouettes distinctes, sources dorées, groupes et destinations visibles, hachures et lien rompu sur un secteur isolé. L’isolement arrête la production et retire ce territoire du score connecté ; aucun compte à rebours de disparition. Le pincement et les boutons +/− permettent de zoomer, le mode Vue de déplacer la toile.

Le prototype se met en pause et se reprend **tant que cette page reste ouverte**. Fermer ou recharger la page recommence ce combat ; les sauvegardes classiques restent conservées. Le passage en arrière-plan ne fait pas avancer la simulation.

Cet essai valide d’abord le plaisir et la lisibilité du combat. Courses, récompenses, vernis, chevalet, mélanges de cartes, galerie et alliances viennent ensuite ; ils ne sont pas encore disponibles.

## V0.6 — apprendre en jouant

Dans le **mode classique**, la campagne propose cinq missions, une nouveauté à la fois et uniquement les commandes utiles à l’écran.

1. **Première tache** : atteindre une zone avec des relais, sans adversaire.
2. **La source** : relier une source et y construire un extracteur.
3. **Premier contact** : former des combattants et reprendre un poste adverse.
4. **Le lien** : reconnecter un secteur isolé et le sécuriser.
5. **L’avant-poste** : construire une caserne près du front, y former des renforts et défendre une source pendant 20 secondes.

Chaque victoire débloque la mission suivante. Rejouer un niveau conserve ses règles de départ. Les premiers niveaux sont de courts exercices sans limite de temps ; leur durée en découverte reste à mesurer avec des joueurs.

- **Construction en campagne** : choisir le bâtiment, toucher une case, vérifier le coût, la portée et la connexion, puis toucher **Valider**. On peut déplacer l’aperçu ou annuler sans dépenser.
- Un objectif permanent indique la prochaine action ; **Voir** recentre et zoome sur sa cible. Les missions avec unités commencent près du Cœur. Glisser et pincer restent disponibles.
- Les fiches expliquent l’activité ou l’isolement ; sélectionner un relais affiche sa connexion réelle au Cœur.
- **Caserne avancée**, également disponible en mode libre : 100 pigments, file indépendante de six places, ralliement propre et formation suspendue si le bâtiment est déconnecté. Le plafond de 36 unités, formations comprises, reste commun au camp. L’IA du mode libre recrute encore uniquement au Cœur.
- Deux sauvegardes indépendantes : une partie libre et une mission. La progression des niveaux et le producteur sélectionné sont mémorisés ; reprise en pause, sans temps simulé pendant l’absence. Les parties V0.4/V0.5 restent compatibles.

Les missions suivantes, les autres nouveaux bâtiments et les alliances à plusieurs IA restent dans la feuille de route.

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

Une sauvegarde de partie libre et une sauvegarde de mission par navigateur ou application, sur cet appareil. Il n’y a pas de synchronisation en ligne. Effacer les données du navigateur efface la partie ; une fermeture forcée peut perdre les dernières secondes depuis la dernière écriture. Un stockage indisponible ou plein est signalé. Les exercices du tutoriel ne sont pas sauvegardés.

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

Le cache hors ligne conserve les fichiers des deux modes ; la sauvegarde locale conserve séparément les parties et la progression classiques. Le combat prototype reste uniquement dans la page ouverte. L’installation n’est pas disponible depuis un simple fichier local. Les sauvegardes existent depuis la V0.4 ; une partie d’une version antérieure ne peut pas être récupérée rétroactivement.

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
node tests/missions.test.cjs
node tests/barracks.test.cjs
node tests/paint-engine.test.cjs
node tests/paint-ai.test.cjs
node tests/paint-balance.test.cjs
node tests/paint-tutorial.test.cjs
node tests/paint-renderer.test.cjs
```

Tests navigateur : installer Playwright et son navigateur Chromium dans votre environnement de développement, puis exécuter les fichiers `tests/camera.browser.cjs`, `tests/tutorial.browser.cjs`, `tests/v03.browser.cjs`, `tests/pwa.browser.cjs`, `tests/session.browser.cjs`, `tests/palette.browser.cjs`, `tests/world.browser.cjs`, `tests/alerts.browser.cjs`, `tests/migration.browser.cjs`, `tests/campaign.browser.cjs`, `tests/campaign-session.browser.cjs`, `tests/campaign-camera.browser.cjs`, `tests/barracks.browser.cjs`, `tests/readability.browser.cjs`, `tests/paint.browser.cjs`, `tests/paint-tutorial.browser.cjs` et `tests/paint-integration.browser.cjs` avec `node`. La variable `PLAYWRIGHT_CHROMIUM_EXECUTABLE` permet de sélectionner un navigateur déjà installé. Le jeu lui-même ne nécessite aucune dépendance.

## Principe du mode classique

Développez votre territoire avec les relais, exploitez les sources de pigment et recrutez une armée. Seul le terrain relié au Cœur compte pour la domination. Couper une liaison affaiblit toute une branche.

Sur téléphone : touchez une unité (ou « Toute l’armée »), puis **Donner un ordre**, puis sa destination. Glissez pour déplacer la carte et pincez pour zoomer. Les onglets du bas donnent accès aux constructions, aux unités et aux pouvoirs. Le bouton « ? » ouvre l’aide.

Les contrôles et les prix sont indiqués dans le jeu. Commencez par la campagne pour découvrir les bases, puis essayez le mode libre en Détente.

## Fichiers

- `paint-engine.js` : règles, cartes, pinceau, réseau, production et combat V0.7.1.
- `paint-ai.js` : décisions du nouvel adversaire depuis sa perception limitée.
- `paint-renderer.js` : rendu de la toile, des camps, des flux et des effets.
- `paint.js` / `paint.css` : interface tactile, caméra, inspection et reprise en mémoire du prototype.
- `paint-tutorial.js` / `paint-tutorial.css` : six situations d’apprentissage avec objectifs, guidage et progression propres au mode peinture.
- `engine.js` : simulation, économie, déplacements, combats, IA et conditions de victoire.
- `missions.js` : cinq scénarios, restrictions, objectifs et opposition de campagne.
- `campaign.js` / `campaign.css` : choix des missions, déblocages, guidage et interface progressive.
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
