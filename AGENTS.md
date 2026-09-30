# Colorquest — règles de travail

- Jeu RTS HTML/CSS/JavaScript jouable en navigateur, interface française, contre IA.
- Préserver le lancement autonome par index.html et éviter les dépendances réseau à l'exécution.
- Direction : toile blanche, cyan contre corail par défaut, palettes contrastées au choix, minimalisme coloré, animations lisibles.
- Plateforme principale : téléphone en portrait. Concevoir commandes tactiles et interface pour cette cible avant le PC. Aucun geste essentiel ne doit dépendre du survol, du clic droit ou du clavier.
- Préférence validée : démarrage progressif, parties complètes visées de 10 à 15 minutes ; les premières missions de découverte peuvent être plus courtes.
- Direction demandée le 30/09 après V0.5 : campagne par niveaux avec déblocage progressif des mécaniques, bâtiments et unités. Le retour utilisateur confirme que le jeu reste difficile à lire et comprendre après le tutoriel : traiter l’interface et l’apprentissage ensemble, avant d’accumuler les fonctions.
- Niveaux avancés demandés : plusieurs IA et possibilité d’alliance ; le territoire de l’alliance prend une teinte issue du mélange des deux couleurs. Conserver une identification claire des objets que le joueur contrôle. Ces fonctions sont planifiées, pas encore livrées ; consulter la feuille de route pour les règles proposées.
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
- Format de sauvegarde courant : snapshot v3 dans l’enveloppe locale v1. Conserver les fixtures authentiques V0.4 et V0.5 et leurs tests de migration navigateur ; changer une préférence de carte ne doit jamais modifier la partie sauvegardée. Campagne et mode libre ont des slots indépendants ; la progression des niveaux est enregistrée séparément. Conserver le producteur sélectionné à la reprise.

- Campagne V0.6 : missions.js est la source des cinq scénarios, restrictions et objectifs. Les commandes verrouillées doivent être refusées aussi par le moteur. Ne débloquer le niveau suivant que sur une victoire dont l’objectif est vérifié. Les casernes ont chacune leur file/ralliement, suspendus hors réseau ; plafond de population commun. La construction en campagne exige aperçu puis confirmation.
