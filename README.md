# BâtiSwift — Pack de 36 icônes SVG

Pack autonome : aucun fichier du projet BâtiSwift n’est modifié.

## Contenu
- `icons/` — 36 fichiers SVG indépendants
- `preview.html` — aperçu local (double-clic, aucun serveur requis)
- `index.json` — inventaire (id, fichier, libellé, fonction, groupe)

## Style
Icônes « outline » : `viewBox="0 0 24 24"`, trait de 1,75, extrémités et jointures arrondies, fond transparent, `stroke="currentColor"`. La couleur se pilote en CSS.

Palette d’identité : aubergine foncé `#1A0F23` (fond), violet profond `#2F1A3A` (surfaces). Sur fond sombre, l’aperçu colore les traits avec un lavande clair (`#CDB9F5`), teinte tirée des références visuelles ; sur fond clair, les traits utilisent `#2F1A3A`.

## Utilisation
```html
<img src="icons/ic-search.svg" alt="">          <!-- noir par défaut -->
```
Pour hériter de `currentColor`, intégrer le SVG en ligne (ou via un composant/sprite) :
```css
.icon{ width:24px; height:24px; color:#2F1A3A; }
.dark .icon{ color:#CDB9F5; }
```
Note : un SVG chargé via `<img>` ou `background-image` ne reçoit pas `currentColor` ; utiliser l’intégration en ligne ou `mask-image`.

## Aperçu
Ouvrir `preview.html` dans un navigateur. Le bouton bascule fond clair/sombre, le curseur change la taille ; chaque tuile affiche aussi 16, 24 et 32 px.
