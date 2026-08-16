# L'éditeur de château

Mode d'emploi de `dist/editor.html`.

Le château du jeu s'écrit à la main dans `src/world/ronceval.ts` : 13 salles de TypeScript
déclaratif, au format que définit `src/world/rooms.ts`. L'éditeur fait la même chose à la
souris et produit un fichier `.json` que le jeu sait charger, **sans rien recompiler**. Le
format, lui, est celui que documente le [README](README.md) - l'éditeur ne l'invente pas,
il l'importe.

> Ce fichier explique **comment s'en servir**. Pour le format des données (`RoomDef`,
> `DoorDef`, les objets, les pièges…), voir le [README](README.md#une-salle-roomdef).

> [!CAUTION]
> **SPOILER ALERT.** L'éditeur **ouvre sur le château livré**, le donjon de Ronceval : son
> plan entier s'affiche d'emblée - les 13 salles, leurs niveaux, leurs passages - et un
> clic suffit à voir ce que chacune contient. Or, en jeu, la carte est un **objet à
> trouver**, et le reste se découvre sur place : c'est la première des deux règles que
> s'est fixées ce projet (voir le [README](README.md#pourquoi-ce-projet)).
>
> Si vous comptez y jouer, **jouez d'abord**. Pour bâtir votre propre château sans rien
> apprendre de celui-là, ouvrez l'éditeur et cliquez **« Nouveau »** tout de suite : vous
> repartez d'une salle vide, et Ronceval reste entier.

---

## Ouvrir l'éditeur

```bash
npm run build:editor    # puis double-clic sur dist/editor.html
npm run dev:editor      # ou en mode dev, si vous retouchez l'éditeur lui-même
```

`dist/editor.html` est un **fichier autonome** : JS et CSS inlinés, aucune requête réseau,
il s'ouvre en `file://`. Il n'est **pas** soumis à la contrainte de taille du jeu - le jeu
doit tenir dans les 128 ko d'un TO9, pas l'outil qui sert à le bâtir.

Au lancement, il ouvre le **château livré**. Trois portes d'entrée dans la barre du
haut :

| Bouton | Effet |
| --- | --- |
| **Nouveau** | Un château minimal mais jouable : une salle `entree` avec sa porte principale, et son oubliette. |
| **Château livré** | Recharge les 13 salles du donjon de Ronceval, pour les remanier. |
| **Ouvrir…** | Reprend un `.json` exporté précédemment. |

> Le château de *L'Aigle d'Or* (1984) **n'est pas fourni** : son plan est l'œuvre de
> Louis-Marie Rocques, pas la nôtre (voir [`NOTICE`](NOTICE)). C'est précisément à cela
> que sert cet éditeur : qui veut le rejouer le **rebâtit lui-même**, à partir de ses
> propres notes, et le charge dans le jeu par la **touche 3**.

Un château modifié et non exporté déclenche un avertissement du navigateur si vous fermez
l'onglet. Il n'y a **pas de sauvegarde automatique** : exportez.

---

## L'écran

```
┌────────────────────────────────────────────────────────────────────────┐
│  Nouveau · Château livré · Ouvrir… · Exporter .json          ⛔ 0 ⚠ 0  │
├──────────────────┬───────────────────────────┬─────────────────────────┤
│  PLAN            │  SALLE                    │  PROPRIÉTÉS             │
│                  │  (palette d'outils)       │                         │
│  vue de dessus   │  grille de dalles         │  élément sélectionné    │
│  du château      │  vue de dessus            │  puis la salle          │
│                  │                           │  puis torches & décors  │
├──────────────────┴───────────────────────────┴─────────────────────────┤
│  CONTRÔLES : erreurs et avertissements, cliquables                     │
└────────────────────────────────────────────────────────────────────────┘
```

- **Le plan** est celui de la touche `C` en jeu : la même déduction, les mêmes
  orientations, les mêmes étages. Ce que vous voyez ici est ce que le joueur verra.
  Différence assumée : l'éditeur **nomme** les salles, et laisse un anneau de cases vides
  tout autour pour pouvoir agrandir le château. Les flèches ▲▼ changent d'étage. Sous le
  plan, la ligne **« Hors plan »** donne accès aux salles qui n'y figurent pas (voir
  ci-dessous).
- **La salle** est sa grille de dalles **vue de dessus**. Attention au repère : la
  **rangée 0 est en bas** (côté caméra), le mur du fond en haut.
- **L'inspecteur** montre d'abord l'élément sélectionné - c'est ce que vous venez de
  désigner, donc ce que vous voulez régler - puis la salle, ses torches et ses décors.
- **Le bandeau des contrôles** liste ce que le validateur trouve. Chaque ligne est
  **cliquable** et emmène sur la salle fautive.

`Ctrl/Cmd + Z` annule, `Ctrl/Cmd + Maj + Z` refait.

---

## Premier château, pas à pas

De quoi vérifier que la chaîne complète fonctionne, en cinq minutes.

1. **Nouveau.** Le plan n'affiche qu'une case, `entree` : c'est normal, les oubliettes ne
   figurent jamais sur un plan. Le bandeau signale déjà « château ingagnable : trophées
   absents ».
2. **Tirez un trait** de `entree` vers la case vide à sa droite. Une salle `s1` y naît,
   reliée par une arche. Elle est sélectionnée.
3. Outil **« Objet »**, puis cliquez trois dalles de `s1`. À chaque pose, l'inspecteur
   s'ouvre sur l'objet : réglez **Nature** sur `eagle`, `diamond`, `book`.
4. Posez un quatrième objet, nature **`leadEagle`** : sans l'aigle de plomb, l'Aigle d'Or
   reste imprenable, et le validateur vous le dira.
5. Le bandeau doit afficher **« Rien à signaler : le château est conforme. »**
6. **Exporter .json**.
7. Dans le jeu : écran de sélection, **3 – Charger un château**. Le nom apparaît sous la
   bourse. **1** pour entrer.

---

## Le plan : bâtir la structure

### Percer un passage

Le geste central : **tirez un trait d'une salle vers une case voisine**.

- Case **vide** → une salle neuve y naît, déjà reliée.
- Case **occupée** → les deux salles se relient.

L'éditeur écrit la **paire** de portes d'un seul coup, chaque `spawn` désignant la case de
l'autre. La règle « un spawn est toujours une porte » est donc vraie **par construction**,
jamais par vérification après coup. Le mur à percer se déduit de l'orientation que le plan
a donnée à la salle ; la position découle du format : colonne 8 pour un mur du fond,
rangée 0 pour un mur latéral.

Deux choses à savoir :

- Une salle **neuve** n'a pas encore d'orientation - n'importe quel mur conviendrait, et
  c'est la paire qu'on vient d'écrire qui la lui donne. L'éditeur lui perce son **mur du
  fond**, de sorte qu'elle regarde la salle d'où l'on vient.
- Si, dans la direction visée, une salle présente son **avant** (le côté caméra), le geste
  est **refusé** : le format n'y met pas de porte (« on n'arrive jamais par le bas »).
  Rejoignez-la par un autre mur, ou tournez-la.

Le passage est une **arche** par défaut. Sélectionnez la porte dans la vue salle pour
régler dans l'inspecteur : arche / porte / grille, serrure, escalier (`stairs`). Deux
raccourcis y attendent :

- **« Appliquer à la porte d'en face »** - recopie l'aspect sur la jumelle. C'est le cas
  courant : une grille est une grille des deux côtés.
- **« Sens unique »** - barre la porte de retour (`barred`) au lieu de la supprimer. Elle
  reste visible depuis la salle d'arrivée, mais ne s'ouvre pas.

Supprimer une porte la retire **des deux côtés** : laisser la jumelle en place ferait
pointer un `spawn` dans le vide.

### Tourner une salle

**« ↺ Tourner »** / **« Tourner ↻ »**, dans l'inspecteur de salle.

Il n'y a pourtant rien à faire pivoter : l'orientation d'une salle **n'est écrite nulle
part**, elle est déduite de l'appariement des portes. Le seul levier est **le mur qui porte
chaque porte** - et comme le plan conserve la direction d'un passage, faire avancer les
murs d'un cran fait reculer l'orientation d'autant. Le bouton fait exactement cela :
il déplace toutes les portes d'un quart de tour, recalcule leur case réglementaire et met
à jour le `spawn` de chaque jumelle. La salle garde sa place et ses voisines sur le plan ;
seul le point cardinal qu'elle regarde change.

Le **contenu ne bouge pas** : objets, gardes, meubles, pièges, torches et décors sont dans
le repère de la salle, qui est toujours dessinée de face en jeu.

Deux limites, qui viennent du format et non de l'outil :

- Le mur **avant** ne portant jamais de porte, une salle ne peut prendre que **trois** des
  quatre orientations. La rotation qui y enverrait une porte est refusée, en le disant.
- Une salle dont les portes occupent déjà `front`, `left` et `right` est **entièrement
  contrainte** : elle ne tourne plus du tout - c'est le cas de toute salle à trois portes.

La **salle d'entrée** est le cas particulier : c'est elle qui sert de référence au plan
(elle regarde le nord par définition). La tourner ne la fait donc pas pivoter - cela
réoriente tout le château autour d'elle. L'inspecteur le rappelle sous les boutons.

### Les salles hors plan

Les **oubliettes** ne figurent pas sur le plan, et c'est délibéré : on y tombe de n'importe
où, aucune porte n'y mène, elles n'auraient donc pas de place sur un plan et n'y
renseigneraient sur rien. Le jeu fait de même sous la touche `C`.

Comme le plan est le moyen normal de choisir une salle, elles seraient autrement
inatteignables : la ligne **« Hors plan »**, sous le plan, les liste et permet de les
sélectionner. Elles s'aménagent ensuite comme n'importe quelle salle - forme, sol,
squelettes, torches, sortie par le plafond.

La liste se remplit toute seule : elle contient les salles du château que le plan ne place
pas. Décochez « Oubliette » et la salle rejoint le plan ; cochez-la et elle rejoint la
liste.

### Les étages

Rien à régler directement : les niveaux se **déduisent** eux aussi.

| Ce qui fait changer de niveau | Effet |
| --- | --- |
| Porte marquée `stairs` (escalier) | ±1 niveau, la salle se pose à l'aplomb |
| `holeTile` (trou au sol) | descend d'un niveau |
| `climbTile` (dalle étoile) | monte d'un niveau |
| Porte ordinaire, cheminée secrète | même niveau |

**Marquez les escaliers**, sinon un étage de tour se pose sur le palier et bouscule ses
voisines. Le symptôme se voit tout de suite : deux salles se disputent une case, et le
validateur le signale. Il suffit de cocher `stairs` d'**un seul côté** - la porte d'en face
en déduit son sens.

---

## La salle : la meubler

Sélectionnez une salle sur le plan, puis travaillez au centre.

### La forme

Le menu **« Forme »** propose les quatre plans de sol du format :

| Gabarit | Usage |
| --- | --- |
| Rectangle - 3 rangées | la salle ordinaire, celle du gabarit par défaut |
| Rectangle - 2 rangées | salle basse : crypte, cave, puits |
| Couloir - 1 rangée | passage, à traverser sans s'attarder |
| **Salle en T** | souterrain qui se resserre sur la porte du fond |

Une seule est vraiment une forme libre : le T. Poser un gabarit réécrit le plan de sol d'un
coup, **conserve la largeur**, replace les portes et prévient leurs jumelles. Le fût du T
reste centré sur la **colonne 8** - celle de la porte du fond, qu'il murerait autrement ;
c'est aussi pourquoi un T demande au moins 11 colonnes.

**« Salle ronde »** n'est pas dans ce menu : ce n'est pas un plan de sol mais un mode de
rendu (le sol et le mur du fond suivent un arc), qui se coche à part et se combine avec
n'importe quelle forme. Les deux étages de la tour de Ronceval sont des rectangles 16×3
cochés « Salle ronde ».

Changer les **dimensions** replace les portes sur leur case réglementaire - la colonne du
mur droit vient de bouger, la rangée du mur du fond aussi - et met à jour le `spawn` de
chaque jumelle. Sans quoi agrandir une salle casserait tous ses passages d'un coup. Une
salle portant une porte de fond ne descend pas sous 9 colonnes.

### Le sol

L'outil **« Sol »** creuse ou rebouche une dalle. Tant que la salle reste un rectangle
plein, aucun `layout` n'est écrit - le format veut qu'on n'énonce que ce qui s'écarte du
défaut, et un `layout` de « que du sol » serait du bruit.

Une salle creusée à la main s'affiche **« — creusée à la main — »** dans le menu Forme.
C'est parfaitement valable ; simplement, sa profondeur et sa largeur ne se règlent plus par
un champ (c'est son `layout` qui commande). **Reposer un gabarit la ramène à une forme
entière** : c'est la sortie de secours.

### Poser des éléments

Un outil est actif à la fois ; un clic pose son élément sur la dalle.

| Outil | Ce qu'il pose |
| --- | --- |
| **Sélection** | ne pose rien : choisit l'élément sous le curseur |
| **Sol** | creuse / rebouche |
| **Objet** | un `ItemDef` (nature à régler dans l'inspecteur) |
| **Garde** | une patrouille, dont la course est tracée sur la grille |
| **Coffre** | 3 dalles, centrées |
| **Dalle piégée** | chute en oubliette |
| **Herse** | **deux clics** : la case déclencheuse, puis la case de chute |
| **Meuble** | 1 à 3 dalles selon la nature |
| **Squelette** | 3 dalles, centrées |
| **Cheminée** | 3 dalles, sur le mur du fond |
| **Chauve-souris**, **Fantôme** | leur rangée |
| **Dalle étoile**, **Trou** | passage vertical, destination à régler ensuite |

Les éléments **larges** montrent leur vraie emprise et **refusent de déborder** de la
salle. L'éditeur ne vous empêche pas d'en superposer deux sur une dalle : il le signale, et
c'est le validateur qui vous le rappelle.

Les **portes** ne se posent pas ici - elles ont besoin d'une destination, donc elles se
créent depuis le plan. Depuis la salle, on les sélectionne, on les règle, on les supprime.

### Torches et décors

Ils sont au **mur**, pas sur la grille : ils vivent en bas de l'inspecteur.

Les **deux torches allumées par défaut n'existent pas dans la donnée** - la salle omet
simplement le champ. L'inspecteur les affiche pour mémoire, avec la mention « défaut :
deux torches allumées », et les inscrit dans la donnée dès que vous y touchez. Deux
raccourcis : **« salle noire »** (aucune torche allumée au départ) et **« défaut »**
(revenir aux deux torches implicites).

Une salle noire apparaît **grisée** sur le plan, comme le « Salle dans le noir » du plan
d'époque.

### Passages verticaux et cheminées

**Dalle étoile** (on monte à la corde) et **Trou** (on tombe) se posent sur une dalle, puis
demandent une destination et une case d'arrivée dans l'inspecteur. Tant qu'elles n'en ont
pas, le validateur les signale en erreur.

Faites-les **par paires** : un trou répond à une dalle étoile dans la salle d'en face, et
inversement. Le validateur avertit si le trajet ne se fait que dans un sens.

> Ne faites pas arriver **sur** la contrepartie : on retomberait aussitôt dans le trou
> qu'on vient de remonter. Le château d'origine fait toujours arriver **à côté**, et le
> validateur vérifie l'existence de la contrepartie, pas sa case.

Une **cheminée** `secret: true` ouvre un passage caché (clef en or en main, `O` sur le
montant gauche). Là aussi, par paires - ou avec une porte barrée pour le retour.

---

## Le validateur

Il tourne en continu. Le compteur de la barre du haut donne l'état : **⛔ erreurs** et
**⚠ avertissements**.

**Les erreurs** : le château est cassé - il planterait, ou son plan cesserait d'être
« dessinable à la main ».

- porte latérale hors de la rangée 0, porte de fond hors de la colonne 8 ;
- `spawn` qui ne tombe pas sur une porte de la salle cible ;
- arrivée par une porte `back` ;
- destination inexistante ;
- élément posé hors de la salle, sur une case vide, ou débordant ;
- `layout` aux rangées de longueurs inégales ;
- dalle étoile ou trou sans destination ; cheminée secrète sans destination ;
- identifiant interne en désaccord avec la clé ; salle de départ inexistante ;
- pièges présents alors que la salle-oubliette manque.

**Les avertissements** : le château tourne, mais quelque chose ressemble à une étourderie.
L'auteur reste juge.

- salle injoignable depuis le départ ;
- passage à sens unique non assumé (la porte d'en face mène ailleurs, sans être barrée) ;
- trajet vertical ou cheminée sans retour ;
- château ingagnable : un des trois trophées manque, ou aucune porte de sortie ;
- Aigle d'Or sans aigle de plomb ; serrure sans sa clef ;
- salle sans nom ; deux éléments sur la même dalle.

Chaque ligne est **cliquable** et sélectionne la salle et l'élément en cause.

À l'export, s'il reste des erreurs, l'éditeur demande confirmation avant de partir.

> Le **château livré ne produit ni erreur ni avertissement**. C'est l'étalon du
> validateur - la preuve que ces règles ne sont pas inventées après coup.

---

## Exporter et jouer

**« Exporter .json »** télécharge le fichier. Puis, dans le jeu : écran de **sélection**,
**3 – Charger un château** - ou **glissez le fichier sur la fenêtre**.

Le nom du château s'affiche sous la bourse. L'or et l'inventaire sont conservés. En pleine
partie le dépôt est refusé : on ne change pas le château sous les pieds du joueur.

Un fichier illisible est signalé et **ne casse pas la partie en cours**.

---

## Le format `.json`

```json
{
  "format": "aigledor-castle",
  "version": 1,
  "name": "mon-donjon",
  "startRoom": "entree",
  "startSpawn": { "col": 8, "row": 0 },
  "oubliette": "oubliette",
  "rooms": {
    "entree": {
      "name": "Entrée",
      "doors": [
        { "col": 8, "row": 2, "side": "front", "target": "__exit__",
          "spawn": { "col": 8, "row": 0 }, "exit": true }
      ]
    }
  }
}
```

Les objets salle sont les `RoomDef` du [README](README.md#une-salle-roomdef) **verbatim,
moins l'`id`** : la clé fait foi, le jeu le réinjecte. L'écrire à la main est donc
parfaitement possible.

L'export **élague ce qui vaut déjà par défaut** : une salle 16×3 n'écrit pas ses
dimensions, un booléen faux ne s'écrit pas du tout. Même usage que `rooms.ts`, donc un
fichier relisible et comparable d'une version à l'autre. Deux listes vides sont conservées
parce qu'elles **disent** quelque chose : `torches: []` (salle noire) et `doors: []`
(l'oubliette, où l'on tombe et dont aucune porte ne sort).

---

## Aide-mémoire

| Geste | Effet |
| --- | --- |
| Clic sur le plan | choisir une salle |
| **Glisser** d'une salle vers une case voisine | percer un passage (case vide = salle neuve) |
| ▲ ▼ | changer d'étage |
| Ligne « Hors plan » | atteindre une oubliette |
| Clic dans la grille de salle | poser (ou choisir, avec l'outil Sélection) |
| Deux clics, outil Herse | déclencheur, puis case de chute |
| `Ctrl/Cmd + Z` | annuler |
| `Ctrl/Cmd + Maj + Z` | refaire |
| Clic sur une ligne des contrôles | aller à la salle fautive |

---

## Limites connues

- **Pas d'aperçu en perspective.** L'éditeur montre les salles de dessus ; pour les voir
  comme le joueur, il faut exporter et charger dans le jeu.
- Les **objets, gardes et pièges** ne figurent pas sur le plan : c'est un plan, pas une
  liste. L'éditeur suit ici le parti pris du jeu.

---

## Comment c'est fait

`src/editor/`, construit par `vite.editor.config.ts` en un fichier autonome. Il importe
`src/world/rooms.ts`, `src/world/mapLayout.ts` et `src/world/loadCastle.ts` : le format et
la déduction du plan ne sont **pas dupliqués**, donc ne peuvent pas diverger.

La dépendance ne va que dans ce sens - **rien du jeu n'importe `src/editor/`** - ce qui
garantit que l'éditeur n'entre jamais dans le bundle du jeu ni dans sa contrainte de
taille. Côté jeu, tout le chemin d'import tient dans `src/world/loadCastle.ts` et pèse
**~1,6 ko**.

| Module | Rôle |
| --- | --- |
| `store.ts` | le château en cours, la sélection, l'annulation |
| `planView.ts` | le plan, et le tracé des passages |
| `roomView.ts` | la grille de dalles et la palette |
| `inspector.ts` | les formulaires |
| `fields.ts` | description déclarative des champs du format |
| `doors.ts` | appariement des portes, rotation, gabarits, dimensions |
| `validate.ts` | le validateur (fonction pure) |
| `io.ts` | lecture et écriture du `.json` |
