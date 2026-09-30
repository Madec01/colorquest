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
