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
- [x] J2 — Interface : menu, commandes, lisibilité, tutoriel et sons.
- [x] J3 — Vérifications du moteur et du parcours navigateur ; livraison initiale sur main.
- [ ] J4 — Retour de Martin : rythme, plaisir de conquête, difficulté, lisibilité des coupures.
- [ ] J5 — Équilibrage sur plusieurs cartes ; personnalités IA, raccourcis et accessibilité approfondie.
- [ ] J6 — Progression et spécialisations, cartes supplémentaires et sauvegarde de partie.

## Modifications réalisées

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
