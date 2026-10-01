# Colorquest — feuille de route vivante

Dernière mise à jour : 1er octobre 2026.

## Vision et décisions validées

- RTS minimaliste et coloré sur une toile blanche, joueur contre ordinateur.
- Une ressource : le pigment. Réseau de territoire relié à un Cœur.
- Exploration distincte de la possession ; couper les connexions est une tactique centrale.
- Plateforme principale : téléphone en portrait. Carte verticale et commandes tactiles prioritaires ; PC secondaire.
- Début progressif, interface française. **Validé le 1er octobre :** combats courts de 3 à 5 minutes (les parties libres de 12 minutes sont abandonnées) ; une course complète de 5 à 7 combats peut être interrompue et reprise. Remplace l’ancienne cible de 10 à 15 minutes par partie.
- **Validé le 1er octobre :** Colorquest devient un « roguelite de peinture » mêlé à un jeu de cartes en temps réel : on peint au doigt, l’armée se dirige par flux, on joue une main de cartes, et on progresse par courses de petits combats. Détail dans la section « Nouvelle direction » ci-dessous.
- Direction demandée le 30/09 après V0.5 : progression par niveaux, déblocage graduel des possibilités et apprentissage des bases dans les premières missions.
- Niveaux avancés : plusieurs IA, possibilité d’alliance et territoire affiché dans un mélange des couleurs des deux camps. Direction demandée ; fonctionnement détaillé encore proposé ci-dessous.
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
- [x] J9 / V0.6 — Cinq missions progressives, interface adaptée à chaque niveau, construction avec aperçu/confirmation et caserne avancée livrées. Parcours tactiles vérifiés ; compréhension et plaisir à confirmer avec Martin avant la suite.
- [x] J10 — Analyse du plaisir de jeu et choix d’une nouvelle direction, validés par Martin le 1er octobre (documentation uniquement).
- [x] J11 / V0.7 — Combat d’essai isolé livré : quatre minutes maximum, pinceau permanent, quatre cartes, production automatique, flux et apprentissage propre. Vérifications moteur, gestes et compatibilité ; essai de Martin attendu avant la suite.
- [ ] J12 / V0.8 — Course roguelite : carte de chapitre, choix de cartes et de vernis entre les combats, mélange des couleurs, adversaires à caractère, histoire courte, sauvegarde de course.
- [ ] J13 / V0.9 — Envie de revenir : galerie de tableaux, défi du jour, étoiles, collection, rejeu accéléré, sensations et musique.
- [ ] J14 — Plusieurs camps et alliances (ancienne V0.8), reportés après la validation de la nouvelle boucle.

V0.6 reste accessible pendant l’essai. Le Go du 1er octobre a lancé la V0.7 livrée ici ; V0.8 et les étapes suivantes restent à réaliser après validation du plaisir et de la lisibilité.

## Retour après V0.5 — plaisir de jeu à renforcer

- 30/09 : Martin apprécie la base mais trouve qu’il manque quelque chose pour rendre le jeu amusant ; il envisage un manque d’éléments de gameplay.
- Diagnostic de conception, à vérifier avec lui : la boucle construire → étendre → recruter → envoyer l’armée manque de décisions immédiates et de moments marquants. Les cinq rôles d’unités, trois spécialisations et améliorations existent, mais beaucoup d’évolutions modifient surtout des valeurs. Les objectifs neutres actuels apportent principalement du pigment.
- Première piste proposée : coups tactiques et occasions de prendre un risque. Le retour suivant sur l’apprentissage place désormais la campagne et l’allègement de l’interface en premier ; intégrer les nouveautés dans cette progression.
- Précision de Martin le 30/09 : il envisage aussi de nouveaux bâtiments. Développer les choix de construction et l’organisation de la base fait donc partie des pistes demandées ; les bâtiments précis ci-dessous restent des propositions.
- Précision suivante le 30/09 : Martin souhaite des niveaux débloquant progressivement les possibilités, les premières missions servant à apprendre les bases. Il signale explicitement que le jeu reste difficile à lire et à comprendre même après le tutoriel.
- Autre direction demandée : plusieurs IA dans les niveaux élevés, alliances possibles et mélange des couleurs pour les zones de l’alliance. Conserver cette identité visuelle tout en distinguant les armées commandables des armées alliées.

## Nouvelle direction validée — 1er octobre 2026

### Constat qui motive le changement

- Retour de Martin : « on s’ennuie vite, le jeu ne donne pas envie d’y rester » ; le RTS seul ne suffit pas.
- Partie libre observée en 390 × 844 et lecture du moteur :
  - il faut attendre avant d’agir (2,6 pigments/s, relais à 45, extension surtout passive) : sans action pendant 3 min, l’IA atteint 36,7 % contre 9,8 % ;
  - le jeu parle de peinture, mais le joueur ne peint jamais : il pose des bâtiments qui peignent ;
  - un ordre demande trois touchers (Toute l’armée → Donner un ordre → case) ;
  - beaucoup de règles ne changent que des chiffres (cinq unités, trois niveaux par bâtiment, spécialisations, escouades, postures, remboursements partiels) ;
  - victoire « 60 % pendant 45 s » abstraite et parties de 12 min longues sur téléphone ;
  - peu de sensations, pas de musique, adversaire sans personnalité ;
  - rien ne pousse à rejouer : aucune progression entre parties, aucun souvenir d’une partie ;
  - la toile n’occupe qu’environ 60 % de l’écran (bulle d’aide sur la carte, brouillard gris, panneaux).
- Points forts conservés : la toile qui se colore, la coupure de réseau, la priorité au téléphone portrait, l’IA qui ne triche pas, la palette de couleurs, le fonctionnement hors ligne et la sauvegarde.
- Jeux de référence : Galcon / Auralux / State.io (envoi par glisser), Splatoon / paper.io (peindre comme geste), Clash Royale (main de cartes et jauge en temps réel), Slay the Spire / Against the Storm (courses de combats et choix entre eux), Mini Metro / Dorfromantik (résultat beau à regarder), Polytopia (adversaires à caractère, défis).

### Validé par Martin

- **Idée A — roguelite de peinture**, **mêlée à un jeu de cartes en temps réel**.
- **Toutes les idées C** (rétention et ambiance).
- **Toutes les simplifications D**.

### Boucle du prototype V0.7 (quatre minutes maximum)

1. **Jauge de pigment en temps réel.** Le Cœur garantit une recharge ; le réseau et les extracteurs l’augmentent. La production d’unités partage cette jauge avec les cartes et le pinceau.
2. **Pinceau permanent, hors de la main.** Choisir Pinceau, tracer depuis son réseau sur des cases neutres visibles et praticables, puis confirmer le coût. Le territoire créé est durable. On peut reconnecter une branche ; on ne repeint pas directement une case ennemie.
3. **Quatre cartes et la suivante visible**, dans un paquet de huit. Une carte jouée rejoint la fin du paquet ; une action refusée ne dépense rien et ne change pas la main. Le prototype utilise relais, caserne, extracteur, bastion, vague, gomme et éclaboussure.
4. **Déploiement et ciblage distincts.** Les bâtiments exigent une case libre de son réseau ; l’extracteur exige une source. Les pouvoirs visent une case visible à portée du réseau, y compris chez l’ennemi. Une carte peut être glissée depuis la main ou choisie puis placée au toucher.
5. **Armée en flux.** La caserne produit automatiquement, chaque unité étant payée à sa sortie. Glisser d’un producteur vers une destination redirige toutes ses unités et les suivantes. Toucher suspend/reprend sa production sans changer les ordres ; l’appui long rappelle son groupe. Les survivants d’une caserne détruite sont rattachés au Cœur.
6. **Victoire visible.** Effacer le Cœur adverse, tenir au moins 50 % du terrain praticable connecté avec une avance stricte pendant 15 s, ou avoir le plus grand territoire au bout de quatre minutes. Une égalité finale donne un match nul. La recharge des deux camps est multipliée par 1,5 pendant la dernière minute, annoncée à l’écran.
7. **Gestes séparés.** Navigation et pinceau ont des modes explicites. Pincer ou annuler abandonne l’aperçu sans achat. Les prélèvements automatiques des casernes attendent pendant la visée, puis reprennent à la validation ou à l’annulation ; l’IA et le combat continuent.

### Course roguelite (étape suivante, non livrée dans V0.7)

- Une course = 5 à 7 combats sur une carte de chapitre à embranchements : combat, combat d’élite, chevalet, événement, boss. La course peut être interrompue et reprise, sans simuler le temps d’absence.
- **Après chaque combat**, choisir une récompense parmi 3 : une nouvelle carte, l’amélioration d’une carte ou un **vernis** (effet passif pour la course, par exemple trait plus long, relais qui éclaboussent à leur destruction, unités qui laissent une traînée de couleur).
- **Chevalet** : retirer une carte du deck, améliorer, ou mélanger.
- **Mélange des couleurs comme système.** Chaque carte porte une couleur primaire ; jouer deux couleurs différentes au même endroit en peu de temps crée un mélange avec un effet propre (exemple : bleu + jaune = vert qui régénère ; à équilibrer). Les couleurs de camp choisies dans le menu restent cosmétiques et distinctes des couleurs de cartes.
- Une défaite termine la course ; les déblocages de collection et la galerie sont conservés. Éviter les bonus permanents de puissance qui rendraient les premières courses triviales.

### Idées C validées (rétention et ambiance)

- **Défi du jour** : même graine pour tous les joueurs ce jour-là, calculée localement à partir de la date ; classement local sur l’appareil. Pas de serveur ni de dépendance réseau.
- **Adversaires à caractère** : nom, couleur, style de jeu (le Rapide, le Bâtisseur, la Gomme…) et quelques répliques. Leurs décisions respectent toujours la perception limitée.
- **Histoire courte** : la toile menacée d’effacement par « la Gomme », racontée entre les combats en quelques lignes.
- **Collection** : palettes, toiles, motifs et pinceaux à débloquer ; cosmétiques uniquement.
- **Étoiles et objectifs bonus** par combat ou mission, records de temps.
- **Événements de carte** : fontaine d’encre, tache de rouille, pluie qui délave ; annoncés avant d’agir, équitables entre camps.
- **Sensations** : éclaboussures, coulures, vibration du téléphone quand l’appareil le permet (désactivable), musique qui s’intensifie, ralenti sur la victoire. Toute musique externe doit être documentée dans ASSETS.md avec sa licence.
- **Chaque partie devient un tableau** conservé dans une galerie, avec rejeu accéléré de la coloration et quelques statistiques ; partage d’image si le navigateur le permet.

### Simplifications D validées

1. Supprimer les niveaux d’amélioration de tous les bâtiments sauf le Cœur.
2. Supprimer escouades, postures et ordre en deux temps ; remplacés par l’envoi par glisser.
3. Supprimer les remboursements partiels de recrutement.
4. Abandonner les parties libres de 12 minutes : viser des combats de 3 à 5 minutes (au plus 4 à 6 minutes en mode libre).
5. Retirer la bulle d’aide permanente posée sur la carte et réduire les panneaux affichés en permanence ; donner plus de place à la toile.
6. Ne plus ajouter de règles ni d’outils de sauvegarde tant que le plaisir du prototype n’est pas validé.

### Conséquences et questions à trancher

- **Sauvegardes** : ces changements modifient l’état moteur persistant (deck, main, jauge, course, collection). Il faudra un nouveau schéma de snapshot, une migration ou une séparation claire des anciennes parties, et conserver les fixtures V0.4/V0.5 tant que les anciens modes restent jouables.
- **Campagne V0.6 et mode libre actuels** : conservés comme modes classiques pendant l’essai, avec leurs sauvegardes. Leur maintien à long terme reste à décider ; l’apprentissage du prototype utilise ses propres commandes.
- **IA** : elle doit jouer avec les mêmes cartes, la même jauge et la même vision limitée ; garder les tests d’indépendance vis-à-vis des états cachés.
- **Plusieurs camps et alliances** : toujours souhaités, reportés après la validation de la nouvelle boucle ; le mélange de couleurs des cartes et celui des alliances devront rester distinguables.
- **PWA** : tout nouveau module ou asset doit entrer dans le précache, et RELEASE doit changer dans sw.js.

### Dix précisions de règles (validées pour le prototype par le Go du 1er octobre)

Les réponses de Claude du commit `d3d9176` sont la base du prototype. Les adaptations pratiques précisées après la liste règlent les gestes, l’équité et les égalités.

1. **Trait d’encre = pinceau permanent**, hors de la main de cartes : toujours disponible, payé case par case avec la jauge (longueur maximale bornée). Il part de son territoire connecté, ne traverse que des cases neutres et franchissables, et crée du territoire normal, non temporaire : l’adversaire le reprend avec ses unités ou le coupe. Il ne repeint pas directement le territoire ennemi. Des cartes peuvent modifier le pinceau (trait large, trait rapide).
2. **Trois notions distinctes pour jouer une carte** : *origine* (où commence le geste : toujours son territoire connecté), *emplacement* (bâtiments et producteurs : uniquement sur son territoire connecté) et *cible* (pouvoirs : toute case visible à portée limitée de son territoire connecté, y compris en territoire ennemi).
3. **Production automatique** : la carte producteur se paie une fois ; chaque unité prélève ensuite son coût dans la jauge au moment de sortir. Jauge insuffisante ou plafond de population atteint : le producteur attend sans rien prélever. Producteur coupé du réseau : production suspendue, comme la caserne V0.6.
4. **Trois gestes de flux distincts** : glisser d’un producteur vers une cible y envoie toutes ses unités, celles déjà sorties comprises (remplace les escouades) ; toucher le producteur met sa production en pause, les unités gardent leur ordre ; glisser vers le producteur lui-même rappelle ses unités pour le défendre.
5. **Aucune carte n’est indispensable** : le pinceau est permanent, la carte suivante est toujours visible et le deck reste petit (environ 8 cartes) pour que la main tourne vite.
6. **Victoire mesurée et visible** : une barre en haut de l’écran montre la part de territoire *connecté* de chaque camp. Victoire en effaçant le Cœur adverse, ou en tenant 50 % de la toile connectée pendant 15 s avec un compte à rebours visible. À la limite de temps, le camp le plus étendu gagne ; dans la dernière minute, la jauge se recharge plus vite. Remplacer le nom « jauge de tableau » par « barre de domination ».
7. **Deux noms** : *pigment* reste la ressource de combat ; les bonus passifs de course s’appellent des **vernis**.
8. **Deux ateliers** : l’étape de course qui modifie le deck s’appelle le **chevalet**. L’ancien bâtiment « Atelier de pigments » (recherches) est retiré du catalogue : il contredit les simplifications validées.
9. **Trois usages de la couleur, trois rendus** : l’aplat de territoire et la couleur des unités et bâtiments sont réservés au camp ; les couleurs de cartes et leurs mélanges apparaissent seulement sur la carte jouée et sous forme d’éclaboussures à motif (hachures, points, rayures) et d’icônes de forme, qui s’effacent après quelques secondes ; l’alliance utilise la teinte mélangée pour le sol, tandis que unités et bâtiments gardent la couleur de leur camp avec un signe d’alliance. Rien ne doit reposer sur la seule teinte.
10. **Mode classique** : conservé tel quel pendant l’essai, gelé (corrections seulement, sauvegardes préservées). Recommandation : ne pas le convertir en tutoriel du nouveau mode, car ses commandes (sélection, ordres, améliorations) contredisent les simplifications ; écrire un tutoriel propre au nouveau mode, puis décider avec Martin du retrait ou de la conservation du classique.

### Avis technique du 1er octobre et choix appliqués après le Go

- Martin indique que Claude Code est le directeur du gameplay et de la direction artistique. Codex assure l’implémentation, l’intégration et les tests ; ses réserves de conception sont exposées comme avis, sans remplacer les arbitrages de Claude Code et Martin.
- Lecture du commit `d3d9176` : avis favorable à cette base de prototype. Le pinceau permanent est hors de la main ; la main conserve donc quatre cartes, et non les trois cartes tournantes proposées précédemment par Codex. Peinture normale sur terrain neutre, noms pigment/vernis/chevalet, distinction visuelle des couleurs et conservation provisoire du classique sont cohérents. Cet avis précédait le Go de Martin ; les dix précisions sont désormais appliquées au prototype.
- **Point 2 — origine du geste :** distinguer l’ancrage dans le monde du départ physique du doigt. Une carte glissée depuis la main commence forcément dans l’interface. L’origine connectée doit désigner le point d’ancrage sur la toile ; le pinceau, lui, commence bien sur une case connectée.
- **Point 3 — production et budget :** le paiement à la sortie est une bonne base à tester. Plusieurs producteurs peuvent cependant absorber automatiquement la jauge et empêcher de peindre/jouer une carte. Montrer les coûts/cadences et proposer, si nécessaire, une protection du budget pendant un geste de placement/tracé ; ne pas ajouter d’office un nouveau système économique.
- **Point 4 — gestes et affiliation :** le retour d’un glisser sur son propre point de départ doit être distingué du toucher qui suspend la production. Variante proposée à Claude : appui long pour rappeler, si le glisser-retour est ambigu à l’essai. La destruction d’un producteur ne doit pas laisser ses unités survivantes impossibles à commander ; proposition de rattachement au Cœur. Le glisser doit changer la destination du groupe, sans téléporter les unités.
- **Point 6 — domination :** seuil de 50 % pendant 15 s acceptable comme hypothèse d’équilibrage, non comme durée de partie garantie. Exiger une avance stricte pour éviter deux victoires à 50/50 et fixer le traitement de l’égalité à la fin du temps. L’accélération de recharge finale doit être annoncée et identique pour les deux camps ; c’est une accélération de fin de combat, pas encore une définition complète de mort subite.
- **Choix d’implémentation après le Go :** appui long pour rappeler le flux ; survivants rattachés au Cœur ; prélèvements automatiques suspendus pendant la visée ; avance stricte pour la domination et match nul en cas d’égalité finale.
- **Vision du pinceau :** seules les cases neutres visibles sont peintes. Le réseau révèle ses alentours, permettant d’avancer par tracés successifs ; refuser une zone hors de vue sans dévoiler si elle contient un adversaire. Cette précision s’applique aussi à l’IA.
- **Périmètre :** un combat isolé et son apprentissage, conservé uniquement en mémoire dans cette page. Aucune nouvelle sauvegarde de course avant l’essai ; sauvegardes classiques inchangées. Les vérifications effectives de la livraison sont consignées en fin de document.

### Ordre de réalisation proposé

1. **Prototype V0.7 isolé** : un combat contre l’IA avec jauge, main de 4 cartes, trait d’encre, envoi par glisser, victoire courte et simplifications D. Martin y joue une dizaine de minutes et dit si c’est plus amusant.
2. **Si oui, V0.8** : course de 3 combats avec choix de récompense, puis carte de chapitre complète, mélange des couleurs, adversaires et histoire.
3. **V0.9** : galerie, défi du jour, étoiles, collection, sensations et musique.
4. Ensuite seulement : plusieurs camps et alliances.

### Relecture critique antérieure aux dix réponses — historique du 1er octobre

Cette relecture conserve l’origine des questions et des idées. Les dix réponses validées et les choix du prototype ci-dessus priment sur les variantes historiques ci-dessous.

- Relecture demandée par Martin de l’analyse, des ajouts, des retraits et des conséquences. Source : branche `claude/affectionate-dirac-ckdw8k`, commit `cba35dc`, distincte de `main` qui contient toujours la V0.6. Cette section constitue un avis de conception ; elle ne transforme pas les propositions ci-dessous en décisions validées.
- Compréhension : le pivot porte sur la boucle entière — peinture directe, cartes, armée en flux, combats courts et choix entre combats — en conservant la toile, la connexion au Cœur, la priorité portrait et l’IA à perception limitée. Les alliances restent souhaitées, mais arrivent après ce pivot.
- Nuances au diagnostic : le moteur V0.6 donne 165 pigments au départ, donc le joueur peut agir immédiatement malgré un revenu de base de 2,6/s ; c’est surtout le rythme des décisions suivantes qui doit être évalué. La campagne fournit déjà des déblocages de missions : ce qui manque est une progression variée d’une course à l’autre. Le résultat après trois minutes sans action décrit un scénario observé, sans mesurer à lui seul le plaisir ou l’équilibrage d’une partie jouée.
- Les six retraits D concernent le nouveau mode. Garder provisoirement le classique et ses sauvegardes pendant l’essai ne vaut pas décision de le maintenir indéfiniment. Les améliorations de cartes entre combats restent compatibles avec la suppression des niveaux des bâtiments en combat ; le sort des spécialisations et des cinq rôles d’unités n’est pas tranché.

**Points à préciser avant le prototype**

- Déploiement et ciblage : distinguer l’endroit où une carte bâtiment peut être posée, le départ connecté d’un trait, et la zone visible adverse qu’un pouvoir peut atteindre. Une lecture littérale « toutes les cartes uniquement sur notre territoire » empêcherait certains effets offensifs.
- Trait d’encre : durée temporaire ou possession durable, peinture d’une case ennemie, coût selon la longueur, largeur, obstacles et reconnexion après une coupure. L’ancien catalogue le dit temporaire ; la nouvelle boucle ne fixe pas cette durée.
- Production et flux : coût initial/seconde/unité, conditions d’arrêt en cas d’isolement, plafond de population, comportement des unités déjà en route, et sens de « toucher pour arrêter » (envoi ou production). Les producteurs automatiques remplacent vraisemblablement la file manuelle, mais leurs règles restent à définir.
- Main et deck : ordre des tirages, recyclage des cartes, possibilité de refuser une récompense, cartes bâtiment déjà présentes sur la toile et garantie de pouvoir peindre/reconnecter. La malchance ne devrait pas retirer le geste central du jeu.
- Pigment : le terme désigne actuellement la ressource ET un bonus passif de course. Proposition : garder « encre/pigment » pour la jauge et nommer les passifs « vernis » ou « techniques ».
- Victoire : jauge de tableau, objectif mesuré, destruction du Cœur et mort subite demandent une règle précise. Renommer le pourcentage actuel ne suffit pas à rendre le but plus lisible.
- Couleurs : distinguer propriété du territoire, couleur mécanique d’une carte et future couleur d’alliance. Ajouter des formes/motifs aux mélanges pour ne pas rendre la possession ambiguë.
- Progression : 5–7 combats de 3–5 minutes représentent 15–35 minutes hors récompenses. La sauvegarde de course et la reprise entre combats sont donc essentielles. Un classement local du défi quotidien ne constitue pas un classement mondial.
- Historique : le catalogue contient encore des descriptions de files, de spécialisations, de Trait temporaire et d’atelier en bâtiment issues du RTS. Ce sont des candidats à réinterpréter, pas des règles automatiquement cumulées avec les nouvelles.

**Propositions de conception, non validées**

1. Tester une petite arène, une IA et un jeu de cartes réduit avec une seule famille d’unités au début. L’apprentissage peut faire découvrir successivement tracer, déployer et orienter le flux, puis laisser jouer librement ; les anciennes scènes pédagogiques fournissent des situations à réutiliser.
2. Garantir l’accès au pinceau : option à tester d’un emplacement Trait toujours disponible et de trois cartes tournantes (quatre emplacements au total). C’est une variante proposée de la main de quatre cartes tirées, pas une modification déjà acceptée.
3. Donner une recharge minimale au Cœur, puis un bonus borné aux sources et au réseau. Une coupure doit être grave tout en laissant la possibilité d’économiser pour reconnecter ; éviter que territoire, revenu, déploiement et score amplifient tous sans limite la même avance.
4. Montrer une ligne d’envoi lisible et un front réactif : redirection du flux par glisser, arrêt expliqué, attaque par défaut des adversaires rencontrés, signal de coupure court et local. Éviter de réintroduire les postures derrière de nouveaux boutons.
5. Inclure dès V0.7 le minimum de sensations nécessaire à l’essai : trait qui se remplit sous le doigt, éclaboussure locale, son de placement/connexion, unités lisibles et victoire expressive. Garder la production musicale complète et la galerie pour la suite.
6. Construire ensuite les choix roguelite autour de comportements : unités laissant une traînée, relais offrant un bref effet à leur destruction, réseau plus résistant aux coupures. Montrer le compromis et le contre-jeu, et permettre de passer une récompense pour ne pas diluer un deck cohérent.
7. Préserver les couleurs de camp pour la propriété ; représenter les mélanges par un effet temporaire, une icône et un motif. Commencer avec un seul mélange réellement utile avant d’ouvrir plusieurs combinaisons.
8. Donner à la galerie une identité d’œuvre : fin de combat sans interface, bref rejeu de la coloration, titre et statistiques simples. L’image du tableau ne doit pas exposer par défaut un partage externe.

- Critère d’essai proposé : une action compréhensible dès les premières secondes, peinture et déplacement de caméra faciles à distinguer, première pression adverse lisible rapidement, possibilité de récupérer une coupure et envie d’essayer un autre choix après le combat. Ce sont des objectifs de conception, pas des résultats mesurés.
- Vérification de cette relecture : comparaison des versions de documentation et lecture ciblée du moteur actuel pour les valeurs initiales. Aucun nouveau test de gameplay ni essai physique réalisé pendant cette analyse.


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

### V0.6 — apprendre en jouant, avec une interface progressive (réalisé)

- La campagne devient le parcours conseillé pour découvrir le jeu. Chaque mission a une situation concrète, un objectif principal et un apport nouveau ; les acquis sont réutilisés pour éviter une succession d’exercices sans intérêt.
- Première séquence jouable, à ajuster après les retours :

| Niveau | Nouveauté principale | Objectif concret |
| --- | --- | --- |
| 1 — Première tache | Cœur, territoire et relais ; pas d’adversaire. | Atteindre une zone repérée sur une petite toile. |
| 2 — La source | Extracteur et revenu de pigment. | Relier puis exploiter une source clairement indiquée. |
| 3 — Premier contact | Recrutement d’un seul type de combattant, sélection et ordre de déplacement/attaque. | Reprendre un petit poste tenu par un adversaire limité. |
| 4 — Le lien | Connexion au Cœur, coupure et reconnexion. | Rétablir l’alimentation d’un secteur isolé puis le sécuriser. |
| 5 — L’avant-poste | Caserne avancée. | Installer une production près du front et tenir une source disputée. |

- Premières missions courtes, sans minuterie punitive. La cible initiale de 2–4 minutes n’est pas une durée mesurée : les parcours automatisés optimisés prennent environ 7–85 secondes, sans temps de lecture ni hésitation. Mesurer la découverte humaine avant d’ajuster le rythme ; ne pas ajouter une attente artificielle. Petites cartes au départ, puis zoom initial sur le Cœur dès le niveau 3 et bouton Voir pour rejoindre l’objectif.
- Réussir une mission ouvre la suivante et présente clairement la nouveauté obtenue. Pas de monnaie supplémentaire ni de répétition obligatoire pour débloquer la suite. Les objectifs bonus et distinctions restent facultatifs.
- Le contenu de chaque mission détermine les commandes, unités, bâtiments, pouvoirs et niveaux technologiques disponibles, y compris lors d’une nouvelle tentative. Sauvegarder séparément la progression de campagne et l’état de la mission en cours ; reprise en pause, sans écoulement du temps d’absence.
- Conserver le mode libre existant comme accès distinct, avec reprise des sauvegardes précédentes. Ne pas imposer de refaire un apprentissage pour retrouver une partie déjà commencée.

#### Lisibilité intégrée et validation humaine attendue

- Afficher seulement les commandes utiles au niveau en cours. Présenter les prochains déblocages dans l’écran de campagne, sans remplir le jeu d’icônes verrouillées. Ajouter une commande nouvelle au moment où elle devient utile, avec une explication courte au bon endroit.
- Un objectif principal visible, formulé en action concrète ; indiquer la prochaine action possible lorsqu’un débutant se retrouve bloqué. Privilégier des tâches réussies dans le jeu plutôt qu’un long texte à lire.
- Distinguer le terrain inconnu, le terrain exploré neutre et le terrain possédé. Garder des silhouettes contrastées pour les bâtiments et les unités, une sélection visible et un signal d’isolement qui ne dépend pas uniquement de la couleur.
- Au placement d’un bâtiment, montrer sa portée et sa liaison possible avant confirmation. Une action impossible doit expliquer simplement pourquoi : manque de pigment, absence de connexion ou mauvais emplacement.
- Lors de la sélection d’un relais, rendre lisible sa connexion au réseau ; ne pas superposer en permanence toutes les liaisons sur toute la carte. Limiter les alertes simultanées et garder le front visible sur petit écran.
- Critère de validation humaine : après une mission, le joueur peut expliquer son objectif, reconnaître ses unités, donner un ordre et comprendre pourquoi un bâtiment fonctionne ou s’arrête, sans devoir rouvrir une longue aide. Les tests techniques restent nécessaires mais ne suffisent pas à valider cette compréhension.

### Ancienne proposition V0.7 — enrichir la campagne (réorientée le 1er octobre)

- Remplacée par la nouvelle direction ci-dessus. Les bâtiments et situations listés restent des candidats de cartes et de combats.

- Niveaux suivants, plage indicative 6–12 : introduire successivement les défenses, le réservoir, le siège, les pouvoirs et les spécialisations. L’ordre précis doit éviter deux mécaniques complexes apprises en même temps.
- Varier les situations : défendre une source, rétablir une liaison, installer un avant-poste, percer une position ou contester un objectif temporaire. Réutiliser les mêmes règles pour donner des choix nouveaux.
- Les bâtiments du catalogue ci-dessous restent des candidats de déblocage. Caserne conseillée au niveau 5, réservoir et mortier dans des missions dédiées ensuite ; atelier, observatoire et portails après validation de ces bases.

### Plusieurs camps et alliances de couleurs (proposition, reportée après la nouvelle boucle)

- Progression envisagée dans les niveaux avancés : découvrir une carte à trois camps, jouer une mission avec allié clairement annoncé, puis choisir une alliance et évoluer vers quatre camps/deux contre deux. Limiter d’abord une alliance à deux camps pour garder la lecture des couleurs et des relations simple.
- L’alliance doit se traduire dans le jeu : pas d’attaque entre partenaires, vision partagée et réseaux capables de se prolonger lorsque leurs territoires se rejoignent. Chacun conserve ses unités, ses bâtiments, sa production et son pigment ; le joueur ne commande que ses propres forces.
- Proposition de réseau commun : une liaison passant par le territoire allié peut rejoindre un Cœur allié vivant. La domination additionne l’union des cases connectées de l’alliance, comptées une seule fois. Possibilité de construire sur le territoire allié connecté, avec propriété du bâtiment clairement indiquée.
- Victoire commune. Dans les missions de coopération, proposer une défaite quand le dernier Cœur de l’alliance est perdu ; expliciter les objectifs et exceptions avant la mission. La perte d’un seul Cœur ne doit pas afficher prématurément deux résultats contradictoires.
- **Couleur du sol :** l’ensemble des territoires des deux partenaires prend une même teinte issue de leur mélange. Exemple de direction artistique : bleu + rose donnent une teinte violette. Choisir un mélange lisible, harmonisé avec les couleurs ennemies ; ne pas compter uniquement sur une moyenne numérique qui pourrait donner une teinte peu distincte.
- **Identité des armées :** unités et bâtiments conservent leur couleur de camp ; ajouter un signe d’alliance et une sélection claire pour reconnaître ce que le joueur peut commander. Le score d’alliance et la minimap utilisent la teinte commune ; la légende montre les deux couleurs d’origine et leur mélange. La couleur choisie demeure cosmétique.
- Première diplomatie proposée : alliance stable pour la mission, règles d’acceptation explicites, demandes/propositions simples. Enseigner la coopération avec une mission scénarisée avant de proposer le choix d’un partenaire ; éviter une rupture inattendue pendant les niveaux d’apprentissage.
- Prévoir des cartes adaptées aux positions des trois/quatre camps et une IA qui poursuit ses objectifs, évalue ses adversaires visibles et soutient son partenaire. Ne pas simplement placer trois IA de duel qui attaquent toutes le joueur.
- Chantier moteur identifié : les règles actuelles supposent deux camps (`validTeam`, boucles par équipe, adversaire `3 - team`, visibilité IA unique et propriétaires 0/1/2 dans la sauvegarde). Généraliser les camps et leurs relations, calculer perception/mémoire par IA, puis versionner/migrer les sauvegardes en conservant les anciens duels.
- Validations indispensables à cette étape : absence de tirs/pouvoirs hostiles entre alliés, comptage unique du territoire, connexion via les deux Cœurs, victoire/défaite de coalition, IA avec vision limitée, lisibilité des paires de couleurs et reprise exacte des sauvegardes à plusieurs camps.

### Catalogue de nouveautés à débloquer progressivement

Catalogue issu du RTS et de la campagne V0.6 ; les candidats futurs seront adaptés aux cartes, aux flux et à la progression roguelite. Ils ne sont pas tous inclus dans V0.7.

#### Nouveaux bâtiments proposés

| Bâtiment | Rôle distinct | Choix et contre-jeu |
| --- | --- | --- |
| Caserne avancée | Ouvre une file de recrutement supplémentaire près du front ; le Cœur conserve le recrutement de départ. | Investir dans une base avancée ou dans l’armée existante. Prix des unités et plafond total conservés ; coupure du réseau suspend la production. |
| Réservoir d’encre | Accumule une autonomie limitée quand il est connecté ; maintient brièvement les bâtiments proches en fonctionnement après une coupure. | Protéger un secteur clé, avec une portée et une réserve bornées. Recharge seulement après reconnexion ; aucun revenu créé par le réservoir lui-même. Le territoire isolé ne compte toujours pas pour la domination. |
| Mortier de peinture | Bombarde lentement une zone désignée à longue portée, avec une éclaboussure visible et un délai permettant l’esquive. | Préparer un siège et protéger l’installation ; portée minimale et vulnérabilité au contact. Le bastion reste la défense automatique de proximité. |
| Portails jumelés | Transfèrent un groupe entre deux points de son réseau, avec une capacité limitée et un temps de recharge. | Investissement dans deux bâtiments ; les deux doivent rester connectés et la coupure d’un seul désactive le transfert. À évaluer sur les petites cartes pour ne pas rendre les déplacements sans intérêt. |
| Observatoire | Révèle brièvement les mouvements dans une zone choisie grâce à une impulsion de reconnaissance. | Dépenser pour l’information et anticiper un raid ; bâtiment fragile, intervalle entre impulsions et mêmes règles pour l’IA. Pas de suivi permanent hors vision. |

- Bâtiments prioritaires : caserne avancée, réservoir et mortier, introduits séparément dans la campagne. Ils apportent production, résistance aux coupures et siège, avec des synergies progressives. Les portails et l’observatoire restent des candidats suivants. L’Atelier de pigments est retiré : pas de second arbre de recherches.
- Exemple de combinaison : établir une caserne près du front, la soutenir avec un réservoir puis protéger un mortier ; l’investissement détourne du pigment des recrutements et expose une base coûteuse. Une attaque rapide ou une coupure prolongée doit permettre de la contrer.
- Préserver le démarrage progressif : recrutement initial au Cœur, déblocages graduels, coûts à tester et aucun nouveau type de monnaie. Menu de construction lisible au pouce, catégories simples et aperçu de portée/effet avant placement. Les nouvelles fonctions doivent être utilisables par l’IA et incluses dans la sauvegarde.

#### Actions et objectifs complémentaires

1. **Peindre pour agir.** Pinceau permanent hors de la main : tracer du territoire normal depuis son réseau pour reconnecter une branche ou préparer une avancée. Longueur bornée, terrain neutre visible et franchissable ; l’adversaire peut reprendre ou couper le passage. Mode de pinceau explicite avec aperçu pour ne pas confondre dessin et déplacement de caméra. Faire évoluer les deux pouvoirs existants progressivement : une vague qui disperse un groupe, une gomme ciblée qui fragilise une liaison. Effets visibles et possibilité de contre-jeu ; pas de destruction instantanée du Cœur.
2. **Une occasion à saisir sur la carte.** Fontaine d’encre temporaire, annoncée avant activation, capturée en tenant la zone sans adversaire. Une seule active ; apparition prévue et équitable entre les camps. Récompense tactique consommable, plafonnée, plutôt qu’une rente permanente qui accélère encore le camp dominant. Déplacer son armée vers la fontaine laisse une autre partie de son réseau exposée. L’IA doit pouvoir la contester avec les mêmes règles.
3. **Des évolutions de comportement.** Adapter ces anciens candidats aux futures cartes et aux vernis, sans réintroduire les spécialisations ou les améliorations de bâtiments retirées du prototype : éclaireur laissant une piste rapide pour les renforts ; briseur avec éclaboussure de zone mais cadence réduite ; relais pouvant maintenir brièvement une liaison à sa destruction pour permettre un repli. Choix limités et incompatibles entre eux, présentés à des moments comparables pour les deux camps. Exemples de conception à équilibrer, pas capacités promises.

- Prototype complémentaire proposé avant les précisions sur la campagne : Trait d’encre + une fontaine disputée + retours visuels/sonores de leurs effets. À insérer dans des missions après les bases et les premiers bâtiments, selon les essais ; ne pas interpréter ce catalogue comme un ensemble à livrer en une fois. Garder les couleurs de camp purement cosmétiques.
- Validation recherchée : un ordre ou pouvoir produit un effet compréhensible immédiatement ; une partie offre plusieurs décisions entre protéger son réseau et tenter une prise ; une perte locale reste récupérable ; le joueur peut raconter un coup réussi ou raté. Tester le confort au doigt et la réaction de l’IA, pas seulement la durée des simulations.
- La campagne et les premières missions passent en priorité. Personnalités d’IA, statistiques/historique visuel et musique d’ambiance restent des idées pour la suite. La progression ouvre des possibilités de jeu ; éviter l’accumulation de bonus permanents qui rend les anciennes oppositions triviales.

## Modifications réalisées

### V0.7 — 1er octobre 2026

- Nouveau mode « Prenez le pinceau » au menu. Moteur, IA, rendu et contrôles séparés du classique ; aucune migration des parties existantes.
- Application des dix précisions, retrait de l’Atelier de pigments du catalogue, terminologie vernis/chevalet corrigée dans la direction courante.
- Contrôles tactiles : tracé avec aperçu/confirmation, glisser une carte ou la choisir puis toucher une case, navigation/zoom, flux au glisser, pause de production au toucher, rappel par appui long ou bouton. Apprentissage propre en trois actions réelles ; retour au menu et reprise en pause sans temps d’absence.
- Modules ajoutés au cache hors ligne ; aide d’installation et mise à jour distinguent les sauvegardes classiques de la reprise en mémoire du prototype.
- Main fixe de quatre cartes avec prochaine carte visible, paquet cyclique de huit ; relais, caserne, extracteur, bastion et trois pouvoirs. Une seule famille de gouttes. Le relais colore immédiatement les cases neutres proches à la pose, sans extension passive ultérieure ; pinceau et unités pilotent ensuite l’avancée.
- Coût des unités payé à la sortie, plafond commun, pause hors réseau et protection du budget pendant la visée. Les unités d’une caserne détruite restent commandables depuis le Cœur. Limite des trois extracteurs productifs annoncée dans la description et l’aperçu.
- Barre de domination, compte à rebours, égalité finale et dernière minute accélérée. Écran de résultat et nouvelle partie ; couleurs des camps reprises du menu, formes distinctes et compteurs des groupes superposés.
- Corrections pendant les essais : aide et aperçu déplacés pour dégager le Cœur, cartes rendues plus lisibles, pause sur `pagehide`, résultat affiché aussi après un pouvoir décisif, annonce de dernière minute et texte de défaite corrigés. Confirmation tactile fiabilisée après glisser, avec annulation des gestes déplacés et protection contre les doubles achats. Calcul simultané du combat, déplacements et captures symétriques corrigent le biais d’ordre des unités.
- IA réglée sur un développement, une contestation centrale puis une offensive plus tardive ; réponse aux liaisons ennemies visibles lors d’une menace de domination. Aucun accès aux états ennemis cachés ni bonus de ressources.
- Dessins Canvas originaux et sons CC0 déjà présents réutilisés ; aucun nouvel asset externe ni dépendance réseau ajouté. Les courses, vernis, chevalet, mélanges, alliances et galerie restent dans les prochains jalons.

### Discussion du 1er octobre 2026

- Analyse du manque de plaisir, comparaison avec des jeux voisins et propositions d’hybridation.
- Dix questions de règles relevées par une relecture externe : réponses proposées par Claude puis validées pour le prototype par le Go de Martin.
- AGENTS.md aligné sur ces validations (durées, direction, simplifications, alliances reportées).
- Validations de Martin : roguelite de peinture mêlé à un jeu de cartes en temps réel, toutes les idées de rétention et d’ambiance, toutes les simplifications. Section « Nouvelle direction », vision et jalons réécrits en conséquence ; anciennes propositions V0.7/V0.8 réorientées ou reportées.
- Documentation uniquement : aucun changement de gameplay ni de fichier précaché.

### V0.6 — 30 septembre 2026

- Menu campagne prioritaire, cinq missions déverrouillées successivement et outils propres à chaque niveau. Un rejeu conserve ses restrictions ; les capacités non enseignées sont aussi bloquées dans le moteur. Le mode libre reste accessible avec tous ses outils.
- Objectifs concrets vérifiés dans la simulation : atteindre une zone connectée ; produire à la source ; recruter et reprendre un poste ; reconnecter/défendre un secteur ; installer une caserne avancée et tenir la source 20 secondes. Attendre sans agir ne valide aucune mission. Les missions restent jouables au-delà de la durée du mode libre.
- Opposition limitée au premier combat, puis vagues payées par l’économie adverse au niveau 5. Pas de lecture des forces cachées. Le scénario attaque la source annoncée ; il ne remplace pas l’IA du mode libre.
- Caserne à 100 pigments, disponible au niveau 5 et en libre : file de six places, ralliement indépendant, sélection du producteur, annulation et plafond commun de 36 unités formations incluses. Coupure : production suspendue. Destruction : formations annulées, remboursement de 50 % du recrutement commencé et de 100 % de ceux en attente ; aucune unité fantôme.
- Placement de campagne en deux étapes : aperçu au toucher puis Valider, sans dépense avant confirmation. Coût, portée et raison du refus visibles. Sélection d’un relais : chemin de connexion réel sur les cases du réseau. Fiches simplifiées, annulation accessible, panneau de placement sans superposition à l’ancien bandeau.
- Objectif/hint permanents et prochaine commande mise en évidence. Bouton Voir, zoom initial au Cœur pour les missions avec unités, et commandes inutiles masquées. Au niveau 3/4, formation et annulation sont intégrées au bouton Combattant : aucun sélecteur de producteur inutile. Au niveau 5, Tenir ici permet de défendre la source sans poursuite. Mode libre : quatrième construction ajoutée dans une grille adaptée au téléphone.
- Sauvegarde de mission séparée de la partie libre et des déblocages. Reprise en pause, avec producteur actif, caméra et sélection. Snapshot v3 et migrations exactes des versions 1/2 ; données inconnues conservées. Un échec d’enregistrement de victoire conserve le point de reprise et propose de réessayer. Protection des conflits entre fenêtres par emplacement.
- Correctif tactile : une fiche d’unité périmée pouvait intercepter le toucher après un changement de scène du tutoriel ; elle disparaît maintenant immédiatement lorsque la sélection change.
- Cache PWA incrémenté, nouveaux modules précachés. Graphismes géométriques natifs et sons existants conservés, sans dépendance réseau ni nouvel asset externe.

### Discussion après V0.5 — 30 septembre 2026

- Retour sur le manque de plaisir consigné ; priorité V0.6 proposée autour d’actions tactiques, d’un objectif temporaire et de choix de comportement.
- Ajout de la demande de nouveaux bâtiments : six concepts comparés, trois recommandés pour un premier lot, synergies et limites définies. Les pistes d’actions de peinture et d’objectif temporaire sont conservées pour la suite de la discussion.
- Nouveau retour intégré : difficulté de lecture et de compréhension malgré le tutoriel. Priorité déplacée vers une campagne et une interface progressive ; cinq premières missions décrites, suite des déblocages et alliances à trois/quatre camps proposées. Mélange du territoire distingué de l’identité des unités, et besoins moteur/sauvegarde identifiés.
- Lecture du moteur et de la feuille de route pour distinguer les fonctionnalités présentes des idées nouvelles. À ce stade de la discussion, seule la documentation avait été modifiée ; l’implémentation V0.6 a ensuite été autorisée par « Go ».

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

- V0.7 : aucun défaut bloquant restant dans les scénarios moteur, IA et navigateur exécutés. Le retour de Martin sur la compréhension et le plaisir reste attendu ; ce n’est pas une garantie d’absence de bugs sur tous les appareils.
- Aucun défaut bloquant détecté dans les scénarios moteur et navigateur V0.6 exécutés.
- Ergonomie signalée par Martin après V0.5 : première réponse livrée avec campagne, outils progressifs, aperçu et fiches clarifiées. Le problème ne sera considéré résolu qu’après son essai : les captures et parcours automatisés ne prouvent pas la compréhension sans aide.

## Limites et risques à suivre

- V0.7 est un combat d’essai séparé : sa pause/reprise reste en mémoire dans la page. Une fermeture, un rechargement ou une mise à jour perd ce combat ; les modes classiques gardent leurs sauvegardes. Une vraie sauvegarde de course appartient à V0.8, après validation.
- Le prototype utilise une seule arène fixe symétrique, un paquet fixe de huit cartes et une seule famille de gouttes. La graine ne change pas encore la disposition ni le comportement initial : plusieurs graines seules ne constituent pas une mesure de variété ou d’équilibrage.
- Quatre minutes est une limite maximale, pas une durée garantie : une destruction du Cœur ou une domination tenue peut conclure plus tôt. Une politique automatisée de peinture efficace gagne en environ 80 s ; sa place face au développement militaire et la facilité à couper ce réseau sont à éprouver avec Martin, sans ajouter de règle avant son retour. Les essais automatisés ne remplacent pas des parties humaines.
- Les détails suivants concernent le mode classique lorsqu’ils citent ses missions, escouades, spécialistes, cartes ou sauvegardes.
- Retour de Martin après V0.5 : plaisir de jeu encore insuffisant. Les validations techniques ne mesurent pas la qualité des décisions ni la satisfaction des combats ; la campagne V0.6 reste à éprouver en partie humaine.
- Les missions et les déblocages seuls ne résoudront pas une carte ou des commandes ambiguës : traiter la lisibilité en parallèle. Le mélange des couleurs d’alliance devra préserver l’identification du propriétaire des unités et bâtiments.
- Le moteur et le format de sauvegarde V0.6 restent limités à deux camps. Plusieurs IA et alliances sont planifiées. Les cinq missions et la caserne sont disponibles ; réservoir, mortier et autres nouveaux bâtiments ne le sont pas.
- La campagne est un premier chapitre court, avec opposition scénarisée. L’IA du mode libre conserve son recrutement au Cœur et ne construit pas encore de caserne ; lui apprendre à utiliser une production avancée est à prévoir avant un duel centré sur ce bâtiment.
- L’IA connaît la géométrie des cartes pour naviguer ; elle ne connaît plus les positions adverses cachées. Vision radiale sans occlusion par les obstacles, identique pour les deux camps.
- Trois dispositions fixes et symétriques ; aucune génération procédurale. Les reprises V0.4 et le tutoriel conservent l’ancienne géométrie.
- Le calcul de trajet cherche un chemin géométrique, sans optimiser son temps selon les terrains lisses. Le bonus de vitesse s’applique bien sur les cases traversées.
- Bâtiments traversables ; séparation souple des unités. Files de recrutement ajoutées en V0.3.
- Les bonus de formation sont fixés quand l’unité entre en file : les améliorations suivantes bénéficient aux nouveaux recrutements.
- Une sauvegarde libre, une sauvegarde de mission et une progression de campagne locales, sans synchronisation entre appareils. Effacer les données du navigateur efface les parties, les déblocages, la couleur et la préférence de carte. Une fermeture forcée peut perdre les dernières secondes depuis la dernière écriture réussie. Le tutoriel se recommence et ne se sauvegarde pas.
- Le tutoriel utilise des scènes pédagogiques contrôlées et des ressources garanties. Les scènes réseau figent la propagation passive pour rendre la coupure lisible.
- Zoom limité à 1–4× ; minimap repliée par défaut sur téléphone. Confort à confirmer sur appareils réels.
- Essais effectués en émulation Chromium, pas encore sur appareils Android/iPhone physiques.
- Audio : effets et jingles, pas encore de musique d’ambiance longue.
- Ancienne cible 10–15 min, remplacée le 1er octobre par des combats de 3 à 5 min. Mesures historiques : en V0.5, sans aucune action, défaite entre 6 min 09 et 7 min 32 en Détente et entre 3 min 01 et 3 min 10 en Stratégie (trois cartes × trois graines par mode). Une victoire territoriale peut précéder le seuil de 7 min des assauts du Cœur. Ces diagnostics ne prédisent pas la durée d’une partie jouée.

- L'équilibrage doit être confirmé par des parties humaines ; des simulations ne mesurent pas le plaisir.
- Vérifier la capacité à reprendre l'avantage après une coupure et limiter l'effet boule de neige.
- Garder les fronts lisibles malgré la saturation des couleurs et les unités groupées.
- Éviter la multiplication des systèmes avant d'avoir validé l'expansion et le combat.

## Idées à évaluer (non promises)

- Transformer les anciennes idées de spécialisations en choix de cartes ou de vernis, après validation du prototype ; ne pas ajouter une seconde progression en combat.
- Autres propriétés du papier et points d’observation, après validation des terrains V0.5.
- Adversaires à caractère, statistiques de fin de partie et rejeu de la coloration : validés le 1er octobre, intégrés à la nouvelle direction.
- Mode chronométré à points cumulés et mode domination.
- Palettes adaptées aux troubles de la vision des couleurs.

## Vérifications

### V0.7 — 1er octobre 2026

- 29 scénarios moteur : refus atomiques du pinceau/cartes, réseau et vision, coût à la sortie, attente sans prélèvement, plafond d’unités, pause/coupure, suspension du budget pendant la visée, commandes des groupes, rattachement au Cœur, pouvoirs, fin de partie, déterminisme. Combat physique miroir de 240 s et résultat indépendant de l’ordre des listes.
- Intégration navigateur en 390 × 844 et 360 × 640 : sauvegardes libre/campagne/progression inchangées, couleur réellement dessinée, menu et reprise en pause, absence de rattrapage en arrière-plan, aide d’installation, avertissement de perte avant mise à jour, lancement hors ligne et fichier local autonome.
- Régressions classiques : moteur, tutoriel, V0.3, snapshots/migrations, monde, missions et casernes ; navigateur session, campagne/session, palette, installation, caméra, tutoriel et cinq missions complètes aux deux formats portrait.
- Inspection visuelle et gestes tactiles réels en Chromium 360 × 640 : tracer deux cases, confirmer, poser une caserne et diriger son flux ; aucune erreur JavaScript. La toile occupe environ 62 % de l’écran hors panneaux temporaires. Les conseils et aperçus ont été déplacés pour ne plus masquer le Cœur de départ ; cartes agrandies, groupes superposés comptés.
- Parcours tactiles complets en 360 × 640 et 390 × 844 : peinture/confirmation, cartes au toucher et au glisser, production réelle, pause, flux et rappel, protection du budget, zoom/pincement et annulation sans achat, fin au chronomètre et rejeu. Sortir du bouton ou s’en éloigner puis revenir ne valide pas ; les événements de clic tardifs ne débitent pas deux fois.
- IA : 6 contrôles comportementaux passent, notamment refus de tout accès au monde brut, indépendance vis-à-vis des états ennemis cachés, gel du temps, fin de partie et réponse ciblée seulement sur des liaisons visibles.
- 12 simulations : deux essais inactifs déterministes, six politiques adverses avec actions/timings différents et quatre miroirs. Sans agir, défaite à 178,8 s, premiers dégâts au Cœur à 170,5 s. Peinture efficace : victoires du joueur à 78,1–80,8 s ; pression : fins à 159,1–168,7 s ; défense : fins à 157,5–204,2 s. Les miroirs inversent exactement les résultats à 173,4 s quand on inverse le premier acteur ; pas d’avantage intrinsèque nord/sud, mais l’initiative compte dans les zones contestées.
- Combat navigateur complet avec vraie IA, accéléré pour vérification, jusqu’à la défaite à 178,8 s : texte de résultat correct, rejeu et pause contrôlés visuellement.
- Aucun essai sur téléphone Android/iPhone physique ni validation du plaisir avec Martin pendant cette livraison.

### V0.6

- 12 scénarios missions et 8 casernes : objectifs réels, restrictions, récupération après erreurs, aucune victoire en restant inactif, plusieurs graines, files parallèles, ralliement, limite commune, pause/reprise après coupure et remboursement à la destruction.
- 18 scénarios snapshots : cinq missions, continuation déterministe, casernes et files, état après 720 s, migrations V0.4/V0.5 authentiques. Relecture des anciennes enveloppes sans écrasement ni modification de leur partie.
- Campagne navigateur en 390 × 844 et 360 × 640 : cinq victoires par actions tactiles et simulation accélérée sans forcer le résultat ; déblocages, rejeu limité aux outils du niveau, reprise, confirmation de placement. Victoire artificielle sans objectif refusée ; quota et progression inconnue protégés.
- Casernes et lisibilité : commandes de recrutement et annulation, choix du producteur, ralliement propre, isolation, destruction, limite commune, fiches et tracé de connexion vérifiés. Aperçu de placement sans mutation ni révélation d’un terrain caché ; confirmation et annulation tactiles. Captures portrait inspectées.
- Gestes de campagne : petite arène cadrée, glisser/pincer sans achat, transition à un doigt, case occupée refusée, achat unique après Valider et annulation sans dépense.
- Sessions : emplacements indépendants, sauvegarde d’arrière-plan, reprise exacte avec caméra/producteur, tutoriel sans écrasement, conflits entre fenêtres, quota et mauvaises données. Migrations navigateur des deux fixtures historiques.
- Régressions : moteur historique, V0.3, cartes/perception, tutoriel, équilibre des deux difficultés, Camp/escouades, alertes, couleurs et caméra. PWA vérifiée sous /colorquest/ : précache complet avec campagne, mise à jour différée, reprise exacte hors ligne et guide d’installation.
- Tests dans Chromium émulé ; aucun essai physique Android/iPhone ni test de compréhension avec Martin effectué pendant cette livraison. Ces validations ne mesurent pas encore le plaisir ou la durée de découverte.

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
