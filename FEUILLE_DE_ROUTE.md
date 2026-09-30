# Colorquest — feuille de route vivante

Dernière mise à jour : 30 septembre 2026.

## Vision et décisions validées

- RTS minimaliste et coloré sur une toile blanche, joueur contre ordinateur.
- Une ressource : le pigment. Réseau de territoire relié à un Cœur.
- Exploration distincte de la possession ; couper les connexions est une tactique centrale.
- Plateforme principale : téléphone en portrait. Carte verticale et commandes tactiles prioritaires ; PC secondaire.
- Début progressif, parties visées de 10–15 minutes, interface française.
- Première version autonome en HTML/CSS/JS, puis enrichissement à partir des retours de jeu.

## Jalons

- [x] J1 — Moteur jouable : territoire, réseau, constructions, économie, unités et IA.
- [x] J2 — Interface initiale : menu, commandes, aide textuelle et sons (tutoriel interactif non livré).
- [x] J3 — Vérifications du moteur et du parcours navigateur ; livraison initiale sur main.
- [x] J4 — Premier retour de Martin : potentiel apprécié ; lisibilité insuffisante, demande de tutoriel, zoom et enrichissement du gameplay.
- [ ] J5 / V0.2 — Priorité demandée : lisibilité, caméra tactile et tutoriel interactif.
- [ ] J6 / V0.3 — Proposition : ordres d’escouades, progression de base et spécialisations.
- [ ] J7 / V0.4 — Proposition : objectifs secondaires, terrains et cartes variées.
- [ ] J8 / V0.5 — Proposition : perception limitée de l’IA, équilibre, sauvegarde et rejouabilité.

## Prochaine livraison proposée : V0.2 — comprendre et commander

Demandes utilisateur confirmées, fonctionnalités pas encore implémentées :
- Zoom pincé centré entre les doigts ; boutons +/− ; glisser pour déplacer la caméra ; limites empêchant de perdre la carte.
- Un toucher sélectionne, un glisser déplace la caméra ; bouton d’ordre explicite pour limiter les déplacements accidentels. Tester le passage un/deux doigts sans ordre parasite.
- Boutons retour au Cœur et vue globale ; minimap rétractable lorsque la carte est zoomée.
- Silhouettes d’unités et bâtiments plus distinctes, sélection contrastée, trajet et destination visibles ; taille des cibles tactiles indépendante du zoom.
- Frontières claires, états connecté/isolé explicites, alerte de coupure et revenus de pigment affichés.
- Fiche contextuelle de l’objet sélectionné : rôle, vie, état du réseau et commandes.
- Tutoriel court sur scénario dédié : sélectionner/déplacer, relais, source/extracteur, recrutement, combat, coupure/reconnexion et victoire.
- Chaque étape validée par une action réussie ; caméra guidée ; possibilité de passer/rejouer ; adversaire scripté et non agressif au départ.
- Critères : une partie jouable au toucher sans consulter les raccourcis, aucun ordre involontaire après zoom/glisser, étapes du tutoriel réalisables après erreur et redémarrage.

## Enrichissement proposé après V0.2 (à valider)

### V0.3 — décisions et progression
- Escouades et ordres tenir, attaquer, revenir se soigner ; points de ralliement et files de recrutement.
- Cœur à trois niveaux, deux améliorations maximum par bâtiment ; coûts obligeant à choisir armée/économie/technologie.
- Choix exclusif de spécialisation par partie : expansion, fortification ou mobilité.
- Ingénieur réparateur et saboteur spécialisé dans les relais ; éviter l’accumulation de classes redondantes.
- Priorité critique : armée facile à commander avant d’augmenter son nombre de rôles.

### V0.4 — carte et opportunités
- Points d’observation, réserves ponctuelles de pigment et source centrale riche à défendre.
- Passages étroits, terrain absorbant qui ralentit la propagation, terrain lisse qui accélère les déplacements.
- Événements rares, annoncés à l’avance et symétriques ; pas de perte aléatoire arbitraire de la base.
- Trois cartes conçues à la main avant un générateur procédural.

### V0.5 — rejouabilité et confort
- IA limitée par sa vision, personnalités distinctes et vraie courbe de difficulté.
- Sauvegarde/reprise sur téléphone, statistiques de fin et historique visuel du territoire.
- Défis optionnels et déblocages de nouvelles options ; éviter les bonus permanents qui rendent les anciennes parties triviales.
- Musique d’ambiance et retour sonore des événements majeurs.

## Modifications réalisées

- 30/09, retour utilisateur : feuille de route réordonnée. Aucun changement de gameplay effectué lors de cette phase de planification.
- Initialisation du projet et des règles de session dans AGENTS.md.
- Architecture séparant simulation, présentation et documentation.
- Carte verticale 32 × 48, joueur en bas et IA en haut, obstacles et huit sources.
- Trois unités, relais/extracteurs/bastions, pouvoirs Impulsion et Décoloration.
- Victoire à 60 % connectés pendant 45 s, à la destruction du Cœur ou au score après 12 minutes.
- Interface portrait avec onglets de commandes, boutons tactiles de 44 px, aide, pause en arrière-plan et effets de combat.
- Sons et jingles Kenney CC0 intégrés au dépôt, licences et provenance conservées.
- Corrections pendant le développement : attaque directe du Cœur retardée (240 s en détente, 180 s en stratégie), séparation des unités et retraite possible sous le feu.

## Bugs trouvés non corrigés

- Aucun défaut bloquant détecté dans les scénarios moteur exécutés ; parcours navigateur validé.
- Retour utilisateur : lisibilité insuffisante en jeu. Détailler les cas lors de V0.2 et vérifier sur téléphone réel.

## Limites et risques à suivre

- L’IA connaît actuellement toute la carte et les positions adverses : ajouter une perception limitée avant une version compétitive.
- Carte à disposition fixe avec petits écarts aléatoires ; symétrie imparfaite.
- Production immédiate, sans file d’attente ; bâtiments traversables ; séparation souple des unités.
- Pas de sauvegarde/reprise après fermeture.
- Tutoriel guidé mobile encore absent : aide accessible et message de départ seulement.
- Carte entière affichée, sans zoom : vérifier le confort sur petits téléphones réels.
- Essais effectués en émulation Chromium, pas encore sur appareils Android/iPhone physiques.
- Audio : effets et jingles, pas encore de musique d’ambiance longue.
- La cible 10–15 min reste à valider en jeu actif : sans aucune action, défaite observée vers 4 min 20 en détente et 3 min 13 en stratégie (graine 42).

- L'équilibrage doit être confirmé par des parties humaines ; des simulations ne mesurent pas le plaisir.
- Vérifier la capacité à reprendre l'avantage après une coupure et limiter l'effet boule de neige.
- Garder les fronts lisibles malgré la saturation des couleurs et les unités groupées.
- Éviter la multiplication des systèmes avant d'avoir validé l'expansion et le combat.

## Idées à évaluer (non promises)

- Spécialisations exclusives : expansion, fortification, mobilité.
- Cartes avec fissures, passages et différentes propriétés du papier.
- IA expansionniste, défensive ou orientée raids.
- Statistiques de fin de partie et replay de la progression des couleurs.
- Mode chronométré à points cumulés et mode domination.
- Palettes adaptées aux troubles de la vision des couleurs.

## Vérifications

- Huit scénarios moteur automatisés réussis : économie, coupure/reconnexion, obstacles, recrutement/pouvoirs, IA et fin de partie, domination, limite de temps, retraite.
- Chromium, tailles 390 × 844, 360 × 640 et 1440 × 900 : aucune erreur JavaScript ni débordement, captures inspectées.
- Parcours tactile validé : démarrer, construire un relais, recruter, sélectionner l’armée, déplacer, suspendre, afficher une égalité, relancer.
- Validation du lancement direct par fichier index.html sans serveur.
