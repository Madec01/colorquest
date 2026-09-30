# Colorquest — règles de travail

- Jeu RTS HTML/CSS/JavaScript jouable en navigateur, interface française, contre IA.
- Préserver le lancement autonome par index.html et éviter les dépendances réseau à l'exécution.
- Direction : toile blanche, cyan contre corail par défaut, palettes contrastées au choix, minimalisme coloré, animations lisibles.
- Plateforme principale : téléphone en portrait. Concevoir commandes tactiles et interface pour cette cible avant le PC. Aucun geste essentiel ne doit dépendre du survol, du clic droit ou du clavier.
- Préférence validée : démarrage progressif, parties de 10 à 15 minutes.
- À chaque session, lire et mettre à jour FEUILLE_DE_ROUTE.md : jalons, modifications, bugs non corrigés, idées et validations réellement effectuées.
- Garder un regard critique : signaler les compromis et ne pas présenter une fonction prévue comme réalisée.
- Toute ressource externe intégrée doit avoir sa source et sa licence documentées dans ASSETS.md ; conserver la licence distribuée.
- Tester les règles du moteur et le parcours navigateur après une modification importante.
- L'utilisateur autorise le recours à des agents pour les tâches indépendantes.
- Informer l'utilisateur des jalons terminés pendant le travail et donner le commit livré à la fin. Ne pas promettre de notifications externes sans mécanisme configuré.

- PWA : chaque livraison modifiant un fichier précaché doit changer RELEASE dans sw.js. Ajouter tout nouvel asset/module au précache. Ne pas imposer de rechargement pendant une partie.

- Sauvegardes : tout changement d’état moteur persistant ou de statistiques doit être examiné avec snapshots.js. Ajouter les nouveaux champs au schéma et prévoir migration/version si nécessaire ; conserver le test de continuation déterministe et les parcours reprise/tutoriel. Ne jamais simuler le temps d’absence à la reprise.
- Cartes V0.5 : maps.js est la source commune au moteur et aux aperçus. Conserver la symétrie et l’accessibilité des objectifs ; tester les trois cartes. La carte `legacy` est réservée au tutoriel et aux sauvegardes migrées, dont il faut conserver la géométrie.
- Perception : les décisions de l’IA ne doivent pas lire les unités, bâtiments ou propriétaires cachés. La géométrie est connue, les positions de bâtiments observées peuvent rester en mémoire. Conserver les tests d’indépendance vis-à-vis des états ennemis cachés.
- Format de sauvegarde courant : snapshot v2 dans l’enveloppe locale v1. Conserver la fixture authentique V0.4 et son test de migration navigateur ; changer une préférence de carte ne doit jamais modifier la partie sauvegardée.
