# Colorquest — assets et crédits

Recherche et vérification : 30 septembre 2026. Les fichiers ci-dessous proviennent des pages officielles de Kenney. Aucun fichier n'est chargé depuis un CDN pendant une partie.

## Assets inclus

### Kenney — Interface Sounds 1.0

- Auteur : **Kenney**, https://kenney.nl/
- Page officielle et licence : https://kenney.nl/assets/interface-sounds
- Archive téléchargée : https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip
- Licence : **Creative Commons Zero (CC0 1.0)**, https://creativecommons.org/publicdomain/zero/1.0/
- Copie de la licence fournie par l'auteur : `assets/audio/KENNEY-INTERFACE-LICENSE.txt`.
- Six fichiers OGG copiés sans modification depuis le dossier `Audio/` de l'archive :

| Fichier local | Usage envisagé |
| --- | --- |
| `assets/audio/click_001.ogg` | Boutons et menu |
| `assets/audio/select_001.ogg` | Sélection d'unités |
| `assets/audio/confirmation_001.ogg` | Construction et validation |
| `assets/audio/error_001.ogg` | Ordre impossible |
| `assets/audio/drop_001.ogg` | Ordre de déplacement ou dépôt de pigment |
| `assets/audio/glass_001.ogg` | Pouvoir et capture de source |

### Kenney — Music Jingles 1.0

- Auteur : **Kenney**, https://kenney.nl/
- Page officielle et licence : https://kenney.nl/assets/music-jingles
- Archive téléchargée : https://kenney.nl/media/pages/assets/music-jingles/f37e530b9e-1677590399/kenney_music-jingles.zip
- Licence : **Creative Commons Zero (CC0 1.0)**.
- Copie de la licence fournie par l'auteur : `assets/audio/KENNEY-JINGLES-LICENSE.txt`.
- Deux fichiers copiés sans modification depuis `Audio/Pizzicato jingles/` : `assets/audio/jingles_PIZZI00.ogg` et `assets/audio/jingles_PIZZI03.ogg`.
- Ces fichiers sont de courtes ponctuations musicales, pas une bande-son continue. Leur affectation précise aux résultats de partie reste à valider à l'écoute.

Les huit fichiers totalisent environ 66 Ko. Leurs tailles exactes et empreintes SHA-256 sont conservées dans `assets/audio/manifest.json`. Les fichiers ont été décodés/inspectés avec FFprobe pour vérifier leur format et leur durée. Présence dans le dépôt et intégration effective au moteur sont deux choses distinctes : les usages ci-dessus décrivent l'intention.

L'attribution n'est pas obligatoire sous CC0 ; crédit volontaire recommandé dans le menu : **« Sons : Kenney — CC0 »**. Confirmation officielle de l'usage commercial et de l'absence d'obligation d'attribution : https://kenney.nl/support

## Candidat graphique étudié, non inclus

**Kenney UI Pack 2.0** — boutons, panneaux et curseurs, 430 fichiers, CC0.

- Source officielle : https://kenney.nl/assets/ui-pack
- Archive : https://kenney.nl/media/pages/assets/ui-pack/f651646eab-1718203990/kenney_ui-pack.zip
- Aucun fichier de ce pack n'a été copié dans Colorquest.
- Avis artistique : conserver un menu HTML/CSS et des formes Canvas propres au jeu donnera une identité plus cohérente et des éléments nets à toutes les résolutions. Ce pack pourra servir si un habillage plus « jeu de plateau » est souhaité.

## Bande-son et direction artistique

Les jingles ne remplacent pas une musique d'ambiance. Une piste longue externe n'est pas incluse dans cette sélection. Pour le prototype, une ambiance originale générée par Web Audio permettrait une variation avec la tension de la partie, sans chargement ni dépendance. Une vraie composition musicale reste un jalon de finition à évaluer après les premiers essais.

Les unités, bâtiments et territoires peuvent être dessinés directement en Canvas : leurs silhouettes simples font partie de l'identité du jeu. Éviter d'importer un pack RTS figuratif uniquement pour ajouter des assets : cela nuirait à la lisibilité de la couleur et à la cohérence visuelle.

## Icône d’installation V0.3

`assets/icons/icon.svg` est un dessin vectoriel original réalisé pour Colorquest à partir des formes et couleurs du jeu. Les PNG 192 × 192, 512 × 512 et Apple 180 × 180 sont ses rendus. Aucun asset externe supplémentaire n’est utilisé pour cette icône.
