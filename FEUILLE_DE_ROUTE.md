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
- [x] J8 / V0.5 — Trois cartes, réserves et sources riches, terrains, perception limitée de l’IA et alertes tactiles (périmètre validé le 30/09).
- [ ] J9 / V0.6 — Proposition réorientée après le retour de Martin : actions de peinture, objectif temporaire disputé et évolutions qui changent les comportements. Périmètre à préciser ; aucun de ces ajouts n’est encore implémenté.

## Retour après V0.5 — plaisir de jeu à renforcer

- 30/09 : Martin apprécie la base mais trouve qu’il manque quelque chose pour rendre le jeu amusant ; il envisage un manque d’éléments de gameplay.
- Diagnostic de conception, à vérifier avec lui : la boucle construire → étendre → recruter → envoyer l’armée manque de décisions immédiates et de moments marquants. Les cinq rôles d’unités, trois spécialisations et améliorations existent, mais beaucoup d’évolutions modifient surtout des valeurs. Les objectifs neutres actuels apportent principalement du pigment.
- Réorientation proposée : travailler les coups tactiques et les occasions de prendre un risque avant de produire des missions supplémentaires. Préserver les commandes portrait et la lisibilité ; ne pas ajouter simultanément de nombreuses unités, monnaies et commandes.
- Question utile pour prioriser : l’ennui apparaît-il pendant l’attente de l’expansion, pendant les combats automatiques ou dans la répétition des mêmes débuts de partie ? Réponse encore attendue ; ne pas traiter cette hypothèse comme une préférence validée.

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

### V0.5 — carte et opportunités (réalisé)
- Trois cartes façonnées à la main : La Plaine (expansion libre), Les Couloirs (passages et contournements), Le Carrefour (centre disputé). Disposition symétrique entre les camps.
- Six réserves de 60 pigments à récupérer avec une unité non ingénieur, une seule fois, sans ennemi à proximité ; huit sources dont deux riches à rendement +60 % avec extracteur connecté.
- Papier absorbant : propagation passive des bâtiments deux fois moins fréquente. Terrain lisse : vitesse des unités +30 %. Capture par les unités inchangée.
- IA soumise à sa vision ; exploration des éclaireurs et mémoire des dernières positions observées des bâtiments. Cette priorité est avancée depuis la V0.6.
- Alertes « bâtiment attaqué », « source perdue » et « réseau coupé », touchables pour recentrer la carte ; regroupement pour éviter le bruit.
- Choix de carte avec aperçu, légende au toucher et reprise des anciennes sauvegardes sur leur toile originelle.
- Hors périmètre de cette livraison : points d’observation, événements aléatoires et génération procédurale.

### V0.6 — des coups tactiques et des parties différentes (proposition)

1. **Peindre pour agir.** Pouvoir signature « Trait d’encre » : tracer un passage temporaire depuis son réseau pour reconnecter une branche ou préparer une avancée. Longueur bornée, terrain visible et franchissable, expiration clairement annoncée ; l’adversaire peut couper le passage. Mode de pouvoir explicite avec aperçu pour ne pas confondre dessin et déplacement de caméra. Faire évoluer les deux pouvoirs existants progressivement : une vague qui disperse un groupe, une gomme ciblée qui fragilise une liaison. Effets visibles et possibilité de contre-jeu ; pas de destruction instantanée du Cœur.
2. **Une occasion à saisir sur la carte.** Fontaine d’encre temporaire, annoncée avant activation, capturée en tenant la zone sans adversaire. Une seule active ; apparition prévue et équitable entre les camps. Récompense tactique consommable, plafonnée, plutôt qu’une rente permanente qui accélère encore le camp dominant. Déplacer son armée vers la fontaine laisse une autre partie de son réseau exposée. L’IA doit pouvoir la contester avec les mêmes règles.
3. **Des évolutions de comportement.** Enrichir les spécialisations existantes avec des choix qui changent la manière de jouer : éclaireur laissant une piste rapide pour les renforts ; briseur avec éclaboussure de zone mais cadence réduite ; relais pouvant maintenir brièvement une liaison à sa destruction pour permettre un repli. Choix limités et incompatibles entre eux, présentés à des moments comparables pour les deux camps. Exemples de conception à équilibrer, pas capacités promises.

- Premier prototype conseillé : Trait d’encre + une fontaine disputée + retours visuels/sonores de leurs effets. Introduire les évolutions ensuite selon les essais ; garder les couleurs de camp purement cosmétiques.
- Validation recherchée : un ordre ou pouvoir produit un effet compréhensible immédiatement ; une partie offre plusieurs décisions entre protéger son réseau et tenter une prise ; une perte locale reste récupérable ; le joueur peut raconter un coup réussi ou raté. Tester le confort au doigt et la réaction de l’IA, pas seulement la durée des simulations.
- Les missions courtes, personnalités d’IA, statistiques/historique visuel et musique d’ambiance restent des idées pour la suite. Les gains permanents entre parties ne doivent pas rendre les anciennes oppositions triviales.

## Modifications réalisées

### Discussion après V0.5 — 30 septembre 2026

- Retour sur le manque de plaisir consigné ; priorité V0.6 proposée autour d’actions tactiques, d’un objectif temporaire et de choix de comportement.
- Lecture du moteur et de la feuille de route pour distinguer les fonctionnalités présentes des idées nouvelles. Cette session modifie uniquement le document de suivi ; la V0.5 jouable reste la version livrée.

### V0.5 — 30 septembre 2026

- Trois dispositions façonnées à la main et symétriques, y compris les unités de départ. Les aperçus utilisent exactement les mêmes données que le moteur. Choix mémorisé sur l’appareil, indépendant de la carte sauvegardée.
- Réserves contestables : collecte dans un rayon de 1,2 case, bloquée par un ennemi dans un rayon de 2,2 cases. Gain unique de 60 pigments, notification locale à la collecte. L’ingénieur reste consacré aux réparations.
- Sources riches avec rendement ×1,6 à tous les niveaux d’extracteur connecté. Papier absorbant : une propagation passive sur deux ; terrain lisse : vitesse ×1,3. La capture des unités reste inchangée.
- Vision calculée pour les deux camps avec les mêmes règles. L’IA cherche les ressources connues, explore avec ses éclaireurs et recrute un remplaçant si besoin. Sa mémoire conserve les dernières positions observées des bâtiments, pas leurs changements cachés. Pouvoirs et tirs de bastions exigent une vision alliée.
- Rythme Détente conservé : développement initial, raids à partir de 3 min, pression à 5 min et assauts du Cœur à 7 min. Une régression qui envoyait trop tôt l’armée Stratégie vers la base adverse a été corrigée pendant les essais.
- Légende tactile accessible par le nom de la carte ; inspection des terrains découverts quand aucune unité n’est sélectionnée. Pause explicite, navigation clavier contenue dans le panneau, fermeture à la fin de partie. Présentation des terrains sobre pour préserver la toile blanche et la lisibilité des camps. Introduction du menu resserrée sur écran court pour garder le bouton de lancement entièrement visible en 360 × 640.
- Alertes prioritaires sur les bâtiments attaqués/détruits, les sources isolées/perdues et les coupures du réseau. Toucher recentre et sélectionne le bâtiment allié restant, sans ordre d’unité ni reprise automatique. Jusqu’à quatre alertes regroupées, rotation et fermeture manuelles ; pas de révélation de l’état ennemi caché.
- Snapshot v2 : carte, ressources consommées, terrains et mémoire/vision IA sauvegardés. Migration du snapshot v1 : ancienne géométrie, unités, économie, files et caméra conservées ; aucun ajout de ressource ni simulation du temps d’absence. L’enveloppe locale et la clé de stockage restent compatibles.
- Ancienne carte gardée pour le tutoriel, dont la conclusion renvoie à la nouvelle légende. Cache PWA incrémenté et tous les modules ajoutés au précache. Aucune dépendance réseau ajoutée.

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

- Aucun défaut bloquant détecté dans les scénarios moteur et navigateur V0.5 exécutés.
- Validation humaine de la lisibilité et des gestes sur téléphone réel encore attendue ; les parcours automatisés ne remplacent pas ces retours.

## Limites et risques à suivre

- Retour de Martin après V0.5 : plaisir de jeu encore insuffisant. Les validations techniques ne mesurent pas la qualité des décisions ni la satisfaction des combats ; les pistes V0.6 restent à éprouver en partie humaine.
- L’IA connaît la géométrie des cartes pour naviguer ; elle ne connaît plus les positions adverses cachées. Vision radiale sans occlusion par les obstacles, identique pour les deux camps.
- Trois dispositions fixes et symétriques ; aucune génération procédurale. Les reprises V0.4 et le tutoriel conservent l’ancienne géométrie.
- Le calcul de trajet cherche un chemin géométrique, sans optimiser son temps selon les terrains lisses. Le bonus de vitesse s’applique bien sur les cases traversées.
- Bâtiments traversables ; séparation souple des unités. Files de recrutement ajoutées en V0.3.
- Les bonus de formation sont fixés quand l’unité entre en file : les améliorations suivantes bénéficient aux nouveaux recrutements.
- Une seule sauvegarde locale par navigateur/application, sans synchronisation entre appareils. Effacer les données du navigateur efface la partie, la couleur et la préférence de carte. Une fermeture forcée peut perdre les dernières secondes depuis la dernière écriture réussie. Le tutoriel se recommence et ne se sauvegarde pas.
- Le tutoriel utilise des scènes pédagogiques contrôlées et des ressources garanties. Les scènes réseau figent la propagation passive pour rendre la coupure lisible.
- Zoom limité à 1–4× ; minimap repliée par défaut sur téléphone. Confort à confirmer sur appareils réels.
- Essais effectués en émulation Chromium, pas encore sur appareils Android/iPhone physiques.
- Audio : effets et jingles, pas encore de musique d’ambiance longue.
- La cible 10–15 min reste à valider en jeu actif : en V0.5, sans aucune action, défaite entre 6 min 09 et 7 min 32 en Détente et entre 3 min 01 et 3 min 10 en Stratégie (trois cartes × trois graines par mode). Une victoire territoriale peut précéder le seuil de 7 min des assauts du Cœur. Ces diagnostics ne prédisent pas la durée d’une partie jouée.

- L'équilibrage doit être confirmé par des parties humaines ; des simulations ne mesurent pas le plaisir.
- Vérifier la capacité à reprendre l'avantage après une coupure et limiter l'effet boule de neige.
- Garder les fronts lisibles malgré la saturation des couleurs et les unités groupées.
- Éviter la multiplication des systèmes avant d'avoir validé l'expansion et le combat.

## Idées à évaluer (non promises)

- Variantes supplémentaires de spécialisations après validation des trois branches V0.3.
- Autres propriétés du papier et points d’observation, après validation des terrains V0.5.
- IA expansionniste, défensive ou orientée raids.
- Statistiques de fin de partie et replay de la progression des couleurs.
- Mode chronométré à points cumulés et mode domination.
- Palettes adaptées aux troubles de la vision des couleurs.

## Vérifications

### V0.5

- 10 scénarios monde/perception : symétrie et accessibilité des cases/objectifs sur les trois cartes, collecte unique et contestée, source riche à chaque niveau et coupure de revenus, terrains, égalité des rayons de vision, mémoire sans mise à jour cachée, exploration et portée des bastions conditionnée par la vision alliée.
- 7 scénarios de difficulté, dont 18 parties complètes : trois cartes × trois graines × deux modes. Aucune attaque du Cœur inactif avant 420 s en Détente ou 180 s en Stratégie dans ces diagnostics ; raids contre une expansion exposée et défense immédiate toujours actifs. Crédits de réserves distingués des revenus économiques dans les contrôles.
- 15 scénarios de sauvegarde/migration : état exact, continuation déterministe, trois cartes et ressources/mémoire IA conservées, anciennes données validées avant migration, fichier authentique V0.4 continué pendant 150 s, données invalides rejetées. Les 8 scénarios moteur historiques, 15 V0.3 et 2 parcours tutoriel en simulation passent également.
- Navigateur 390 × 844 et 360 × 640 : trois choix de carte et aperçu conformes, préférence conservée, reprise sur sa propre carte, légende/pause/focus clavier, inspection tactile et priorité aux ordres/constructions, brouillard respecté et absence de blocage si le stockage est refusé. Légende fermée automatiquement au résultat ; pause après passage en arrière-plan reflétée dans le panneau.
- Alertes testées avec dégâts, destructions et déconnexions réels des quatre types de bâtiments ; reconnexion, recentrage, priorité, regroupement, absence d’alerte ennemie ou de reprise des anciens dégâts au rechargement. Boutons ≥44 px et contrôles de caméra accessibles sur les deux tailles.
- Migration navigateur avec le fichier V0.4 réel : menu sans réécriture prématurée, reprise exacte sur l’ancienne toile, premier enregistrement v2 puis second rechargement identique ; nouvelle carte uniquement après remplacement confirmé.
- Régressions navigateur : sauvegarde/reprise et erreurs de stockage, six couleurs, tutoriel de sept étapes, annulation du remplacement pendant un exercice, Camp/escouades et gestes caméra. PWA : modules précachés, mise à jour en partie suivie d’une reprise exacte hors ligne, installation/guide iOS/mode autonome simulés, échec de précache et cache tiers.
- Captures portrait du choix de carte, de la légende, des terrains et des alertes inspectées. Essais en Chromium émulé ; fluidité, installation native et stockage sur téléphones physiques restent à confirmer.

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
