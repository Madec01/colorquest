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
- [x] J5 / V0.2 — Lisibilité, caméra tactile et tutoriel interactif livrés.
- [x] J6 / V0.3 — Ordres d’escouades, progression de base, spécialisations et installation sur téléphone livrés.
- [x] J7 / V0.4 — Sauvegarde/reprise, six couleurs et rythme Détente progressif. Priorité confort mobile validée par « Go pour la suite » après V0.3.
- [ ] J8 / V0.5 — Proposition : objectifs secondaires, terrains et cartes variées.
- [ ] J9 / V0.6 — Proposition : perception limitée de l’IA, personnalités et rejouabilité.

## V0.2 — comprendre et commander (réalisé)

Demandes implémentées ; vérifications décrites en bas du document :
- Zoom pincé centré entre les doigts ; boutons +/− ; glisser pour déplacer la caméra ; limites empêchant de perdre la carte.
- Un toucher sélectionne, un glisser déplace la caméra ; bouton d’ordre explicite pour limiter les déplacements accidentels. Tester le passage un/deux doigts sans ordre parasite.
- Boutons retour au Cœur et vue globale ; minimap rétractable lorsque la carte est zoomée.
- Silhouettes d’unités et bâtiments plus distinctes, sélection contrastée, trajet et destination visibles ; taille des cibles tactiles indépendante du zoom.
- Frontières claires, états connecté/isolé explicites, alerte de coupure et revenus de pigment affichés.
- Fiche contextuelle de l’objet sélectionné : rôle, vie, état du réseau et commandes.
- Tutoriel court sur scénario dédié : sélectionner/déplacer, relais, source/extracteur, recrutement, combat, coupure/reconnexion et victoire.
- Chaque étape validée par une action réussie ; caméra guidée ; possibilité de passer/rejouer ; adversaire scripté et non agressif au départ.
- Critères : une partie jouable au toucher sans consulter les raccourcis, aucun ordre involontaire après zoom/glisser, étapes du tutoriel réalisables après erreur et redémarrage.

## Enrichissement après V0.2

### V0.3 — décisions et progression (réalisé)
- Escouades et ordres tenir, attaquer, revenir se soigner ; points de ralliement et files de recrutement.
- Cœur à trois niveaux, deux améliorations maximum par bâtiment ; coûts obligeant à choisir armée/économie/technologie.
- Choix exclusif de spécialisation par partie : expansion, fortification ou mobilité.
- Ingénieur réparateur et saboteur spécialisé dans les relais ; éviter l’accumulation de classes redondantes.
- Priorité critique : armée facile à commander avant d’augmenter son nombre de rôles.
- Demande ajoutée le 30/09 : installation sur téléphone (PWA), icône, lancement autonome et cache hors ligne après première ouverture ; guide iPhone et installation proposée quand le navigateur le permet.

### V0.4 — retrouver sa partie et sa couleur (réalisé)
- Sauvegarde locale automatique, reprise en pause, caméra et sélection retrouvées.
- Une partie conservée pendant les exercices ; remplacement confirmé avant une nouvelle conquête.
- Six couleurs choisies dans le menu et mémorisées, adversaire assorti pour distinguer les camps.
- Détente : développement initial plus lent, petits raids puis pression croissante. Stratégie inchangée.
- La carte et les objectifs secondaires passent au jalon suivant : priorité à une expérience mobile que l’on peut interrompre.

### V0.5 — carte et opportunités
- Points d’observation, réserves ponctuelles de pigment et source centrale riche à défendre.
- Passages étroits, terrain absorbant qui ralentit la propagation, terrain lisse qui accélère les déplacements.
- Événements rares, annoncés à l’avance et symétriques ; pas de perte aléatoire arbitraire de la base.
- Trois cartes conçues à la main avant un générateur procédural.

### V0.6 — rejouabilité et confort
- IA limitée par sa vision, personnalités distinctes et vraie courbe de difficulté.
- Statistiques de fin et historique visuel du territoire ; sauvegarde/reprise livrée en V0.4.
- Défis optionnels et déblocages de nouvelles options ; éviter les bonus permanents qui rendent les anciennes parties triviales.
- Musique d’ambiance et retour sonore des événements majeurs.

## Modifications réalisées

### V0.4 — 30 septembre 2026

- Sauvegarde toutes les 10 secondes de simulation, lors des pauses, au passage en arrière-plan, avant mise à jour et au retour au menu. Écriture atomique : un stockage plein conserve la précédente sauvegarde réussie.
- Reprise en pause, sans simuler le temps d’absence. Économie, carte/brouillard, dégâts, files de formation, identifiants, ralliements, escouades, spécialisations, ordres, RNG et temporisations conservés ; caméra, zoom et sélection également retrouvés.
- Format de sauvegarde versionné et validé. Données illisibles/incompatibles conservées et signalées ; refus de remplacement sans confirmation. Une ancienne fenêtre est mise en pause lorsqu’une autre reprend la partie.
- Menu : carte « Reprendre la partie » prioritaire lorsqu’une sauvegarde existe, durée/mode/territoire affichés. Bouton de reprise directement sur la carte mise en pause. Lancement du jeu remonté pour les petits écrans.
- Le tutoriel n’écrase pas la sauvegarde normale. Annuler le passage à une nouvelle partie garde l’exercice actif. Une partie terminée libère son emplacement.
- Six palettes natives : cyan, bleu, violet, rose, vert et orange. Camp adverse assorti, aperçu dans le menu, choix mémorisé. Carte, unités, bâtiments, territoires, frontières, minimap, ralliement, HUD et écran d’accueil suivent la palette.
- Orange choisi plutôt qu’ambre afin de mieux distinguer les sources dorées. Textes pédagogiques adaptés aux rôles et aux camps plutôt qu’au cyan/corail imposé.
- Détente : expansion bridée au nord pendant les premières minutes, premiers raids à 3 min (3 combattants, durée 35 s toutes les 90 s), pression accrue à 5 min, assaut volontaire du Cœur à partir de 7 min. Défense possible dès le départ ; mêmes prix, dégâts et conditions de victoire.
- Mise à jour PWA : nouveaux modules précachés, version du cache incrémentée, sauvegarde avant le rechargement à partir de V0.4. Une erreur de sauvegarde bloque la mise à jour en cours de partie.


### V0.3 — 30 septembre 2026

- File séquentielle de 6 recrutements, pigment débité une seule fois, progression visible, annulation à 100 % en attente / 50 % en formation (arrondi inférieur), plafond 36 unités formations incluses.
- Ralliement appliqué aux nouvelles unités et affichage du drapeau ; trois escouades mémorisées avec nettoyage des pertes.
- Ordres tenir (sans poursuite), attaquer (arrêt pour combattre en chemin), déplacer et repli vers le Cœur pour récupération.
- Tous les bâtiments progressent jusqu’au niveau 3. Le Cœur niveau 2 débloque ingénieur, saboteur et spécialisation. Les améliorations augmentent les stats effectives et ne suppriment pas les dégâts déjà subis.
- Spécialisation exclusive, coût 100 : expansion (relais −25 %, portée +1), fortification (+30 % PV bâtiments, isolement 25 s), mobilité (+20 % vitesse, durée formation −15 %).
- Ingénieur : réparation alliée à proximité, 12 PV/s, aucun tir ; saboteur : fragile, priorité aux relais, dégâts renforcés sur bâtiments.
- IA utilisant la même économie et les mêmes règles de production, progression retardée en détente et deux rôles de soutien intégrés.
- Panneau Camp & armée : recrutement, améliorations, escouades et guide ; partie en cours explicitement indiquée, pause disponible, progression de production toujours visible dans le panneau.
- Tutoriel adapté à la formation différée ; retour à une partie normale vérifié.
- Installation PWA : manifeste, icônes originales, invite lorsque le navigateur la permet et guide iPhone, mode autonome, précache complet et confirmation du mode hors ligne.
- Mise à jour proposée sans rechargement imposé pendant une partie ; cache isolé par chemin, échec du précache signalé sans fausse disponibilité hors ligne.
- Correctifs d’intégration : conserver la pause lors de l’ouverture/fermeture du Camp, ne pas annoncer une mise à jour lors de la première installation et éviter de compter deux fois les marges de sécurité du téléphone.


### V0.2 — 30 septembre 2026

- Caméra centrée sur le Cœur au départ, pincement, glissement, molette, boutons de zoom, Cœur et vue globale, minimap repliable et recentrable.
- Protection des gestes : aucun ordre/construction à la fin d’un pan, pincement ou geste annulé ; déplacement explicite via le bouton d’ordre, clic droit sur PC.
- Revenus par seconde, contours de territoires, unités agrandies, sélection contrastée, trajets, noms des bâtiments en zoom et fiches de vie/rôle/connexion.
- Alerte de réseau isolé qui recentre la caméra et ouvre la fiche du bâtiment.
- Sept leçons validées par le moteur, cibles dorées et commandes surlignées ; recommencer, quitter et passer à une partie normale.
- Séparation des modules caméra, lisibilité et tutoriel ; conservation du fonctionnement hors ligne par index.html.

### V0.1 et planification

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
- Retour utilisateur sur la lisibilité traité par la V0.2 ; validation humaine sur téléphone réel encore attendue. Aucun blocage détecté dans les parcours automatisés V0.2.

## Limites et risques à suivre

- L’IA connaît actuellement toute la carte et les positions adverses : ajouter une perception limitée avant une version compétitive.
- Carte à disposition fixe avec petits écarts aléatoires ; symétrie imparfaite.
- Bâtiments traversables ; séparation souple des unités. Files de recrutement ajoutées en V0.3.
- Les bonus de formation sont fixés quand l’unité entre en file : les améliorations suivantes bénéficient aux nouveaux recrutements.
- Une seule sauvegarde locale par navigateur/application, sans synchronisation entre appareils. Effacer les données du navigateur efface la partie et la couleur. Une fermeture forcée peut perdre les dernières secondes depuis la dernière écriture réussie. Le tutoriel se recommence et ne se sauvegarde pas.
- Le tutoriel utilise des scènes pédagogiques contrôlées et des ressources garanties. Les scènes réseau figent la propagation passive pour rendre la coupure lisible.
- Zoom limité à 1–4× ; minimap repliée par défaut sur téléphone. Confort à confirmer sur appareils réels.
- Essais effectués en émulation Chromium, pas encore sur appareils Android/iPhone physiques.
- Audio : effets et jingles, pas encore de musique d’ambiance longue.
- La cible 10–15 min reste à valider en jeu actif : en V0.4, sans aucune action, défaite par domination vers 6 min 09 à 6 min 38 en Détente (trois graines), contre ~4 min 20 en V0.3. Stratégie reste à ~3 min 11–13. Une victoire territoriale peut précéder le seuil de 7 min des assauts du Cœur.

- L'équilibrage doit être confirmé par des parties humaines ; des simulations ne mesurent pas le plaisir.
- Vérifier la capacité à reprendre l'avantage après une coupure et limiter l'effet boule de neige.
- Garder les fronts lisibles malgré la saturation des couleurs et les unités groupées.
- Éviter la multiplication des systèmes avant d'avoir validé l'expansion et le combat.

## Idées à évaluer (non promises)

- Variantes supplémentaires de spécialisations après validation des trois branches V0.3.
- Cartes avec fissures, passages et différentes propriétés du papier.
- IA expansionniste, défensive ou orientée raids.
- Statistiques de fin de partie et replay de la progression des couleurs.
- Mode chronométré à points cumulés et mode domination.
- Palettes adaptées aux troubles de la vision des couleurs.

## Vérifications

### V0.4

- 10 scénarios de sauvegarde moteur : round-trip JSON exact, continuation déterministe des trois spécialisations, RNG, files partielles/remboursements, IDs réservés sans doublon, dégâts et brouillard, absence de références partagées, rejet de données corrompues/incompatibles et partie IA complète sérialisable.
- 7 scénarios de difficulté : découverte initiale, raids capables de détruire un relais avancé, répit entre raids, défense immédiate, attaque du Cœur à 7 min, fin possible par domination et rythme normal conservé. Trois simulations Stratégie complètes comparées à V0.3 sans différence d’état moteur.
- 8 scénarios historiques du moteur, 15 scénarios V0.3 et 2 parcours tutoriel en simulation passants.
- Reprise réelle au navigateur en 390 × 844 et 360 × 640 : rechargement, sauvegarde périodique, arrière-plan, caméra/sélection, formations et spécialisation retrouvées, reprise attendue en pause, tutoriel sans écrasement, remplacement confirmé et partie terminée effacée.
- Erreurs de stockage : quota plein conserve la précédente écriture ; quitter sans sauvegarder est explicite ; stockage refusé laisse jouer et affiche l’erreur ; données corrompues conservées ; reprise dans un deuxième onglet empêche le premier de réécrire la partie.
- Six palettes testées au toucher (cibles ≥44 px), couleurs effectivement utilisées par le Canvas, persistance, absence de modification du moteur, préférence invalide/stockage indisponible tolérés.
- PWA : mise à jour puis lancement à froid hors ligne avec restauration de l’état exact de la partie ; actifs précachés, portée /colorquest/, installation sur geste, guide iOS et mode autonome simulés, échec de précache signalé et cache tiers préservé.
- Régressions navigateur : tutoriel de sept étapes, annulation du remplacement pendant les exercices, Camp V0.3 et gestes caméra. Captures portrait du menu, de la pause et de la reprise inspectées.
- Tests effectués en Chromium émulé. Installation native, fluidité et éventuelle purge du stockage restent à observer sur téléphones physiques.


### V0.3

- 15 scénarios moteur V0.3 passants : files/débit/durée/remboursement/caps/ralliement, upgrades, trois spécialisations, réparation, sabotage, ordres, escouades et développement IA.
- 8 scénarios historiques moteur et 2 parcours de tutoriel en simulation toujours passants.
- Navigateur tactile 390 × 844 et 360 × 640 : progression, spécialisation exclusive, spécialiste, production/remboursement, pause, ralliement, escouades, ordres et remise à zéro lors d’une nouvelle partie ; aucun débordement horizontal ni erreur JavaScript.
- Tutoriel complet de 7 étapes rejoué au toucher sur les deux tailles ; attente de production réelle, reprise/sortie et retour à l’IA vérifiés.
- Régression des gestes V0.2 : pan/pincement/annulation sans ordre parasite, zoom/recentrage/redimensionnement et commandes PC.
- PWA via serveur HTTP local sous /colorquest/ : manifeste et icônes, cache complet, chargement hors ligne incluant sons, demande d’installation au geste, guide iOS simulé, mode autonome simulé, mise à jour acceptée/refusée en partie, cache tiers préservé, précache incomplet et fichier local traités correctement.
- Captures mobiles du Camp, du recrutement, des escouades et de l’installation inspectées.
- Simulation sans action, graine 42 : défaite en détente à 260,6 s et en stratégie à 191 s. La durée 10–15 min reste un objectif à valider en partie humaine.
- Pas encore d’installation testée sur Android/iPhone physique. La disponibilité de l’invite dépend du navigateur ; un guide manuel est fourni.


### V0.2

- Huit tests du moteur V0.1 toujours passants.
- Tutoriel en simulation : sept étapes réelles, attente sans progression automatique, revenus, capture/connexion, restrictions pédagogiques et retour à une IA active ; stockage indisponible toléré.
- Chromium tactile 390 × 844 et 360 × 640 : tutoriel entier joué par boutons et toucher, redémarrage, sortie, fiches et alerte réseau ; aucune erreur JavaScript.
- Gestes multi-touch via CDP : pan pendant construction, pincement puis retrait d’un doigt, annulation, toucher sans ordre, ordre explicite ; limites de zoom, recentrage, redimensionnement, molette et clic droit bureau.
- Captures du menu, de la carte et du tutoriel inspectées ; pas de débordement horizontal constaté.
- Ces contrôles sont en émulation Chromium ; Safari/iOS et téléphones physiques restent à valider.

### V0.1

- Huit scénarios moteur automatisés réussis : économie, coupure/reconnexion, obstacles, recrutement/pouvoirs, IA et fin de partie, domination, limite de temps, retraite.
- Chromium, tailles 390 × 844, 360 × 640 et 1440 × 900 : aucune erreur JavaScript ni débordement, captures inspectées.
- Parcours tactile validé : démarrer, construire un relais, recruter, sélectionner l’armée, déplacer, suspendre, afficher une égalité, relancer.
- Validation du lancement direct par fichier index.html sans serveur.
