# L'Aigle d'Or - Remake

> **Hommage non officiel.** Projet indépendant, **sans lien avec Louis-Marie Rocques ni
> avec ses ayants droit**, qui restent seuls titulaires des droits sur *L'Aigle d'Or*.
> Rien du jeu de 1984 n'est redistribué ici - **ni code, ni ressource, ni texte, ni le
> plan de son château**. Voir [Mentions légales](#mentions-légales--licence) et
> [`NOTICE`](NOTICE).

Remake web (HTML5 Canvas + TypeScript) du jeu d'action-aventure culte **L'Aigle d'Or**
(Loriciel, 1984/1985), dans son esprit visuel d'origine : une **vue de face en
pseudo-3D**. Chaque salle est dessinée en **perspective à un point de fuite** (sol en
damier fuyant, murs latéraux et mur du fond en trapèzes), **sans plafond** - le haut de
l'écran reste sombre, comme à l'époque. Le héros, visible en 3ᵉ personne, **grandit ou
rétrécit selon sa profondeur**. Le sol est une **grille de cases** : déplacement
**case par case**.

![inventaire](/asset/jeu.png)

## Pourquoi ce projet

**L'Aigle d'Or** est le premier jeu vidéo auquel j'ai joué, découvert sur **MO5** puis sur **TO9**. Ce dépôt
est une tentative de **rétro-ingénierie** : non pas porter le jeu, mais le **reconstruire à
partir de l'idée**, à la main et à partir de zéro, pour comprendre comment on tenait un
château entier de 64 salles dans une machine de 1985.

Deux règles que je me suis fixées :

- **Garder l'esprit, donc la difficulté.** Pas de marqueur d'objectif, pas de
  sauvegarde : on prend des notes sur papier et on dessine son plan à la main, comme à
  l'époque. Les pièges ne s'annoncent pas plus qu'alors, l'or et le temps s'épuisent, et
  tout ce qui se ramasse n'est pas bon à prendre. Seule entorse assumée : la **carte**
  (voir *Le plan du château*), qui n'existait pas dans l'original - c'est un **objet à
  trouver**, pas un acquis, et elle ne dit rien de ce que les salles contiennent.
- **Garder la contrainte de taille.** Le jeu complet doit **tenir dans la RAM d'un TO9**,
  soit **128 ko** (le MO5, lui, n'en avait que 48). Tout est donc **vectoriel et
  procédural** : aucune image, aucun son, aucune police embarquée (le HUD emprunte le
  `monospace` du système) - les salles, les
  meubles, le squelette ou les flammes sont du code qui dessine. Le build actuel produit un
  `dist/index.html` **autonome de ~93 ko**, JS et CSS inlinés.

Cette seconde règle n'est pas un exercice de style : c'est elle qui dicte l'architecture.
Une salle est une poignée de données déclaratives (`RoomDef`), le rendu est un ensemble de
primitives réutilisées d'un décor à l'autre, et tout ce qui pourrait être un asset est
plutôt une fonction. Le reste de ce README documente précisément ce format, pour que
n'importe qui puisse construire son propre château.

## Lancer

```bash
npm install
npm run dev      # serveur de dev (Vite) - ouvre le navigateur
npm run build    # build dans dist/ (type-check inclus)

npm run dev:editor    # l'éditeur de château en dev
npm run build:editor  # build dans dist/editor.html
npm run build:all     # le jeu ET l'éditeur
```

Le build produit **un seul `dist/index.html` autonome** (JS/CSS inlinés) : il s'ouvre
**par double-clic** - ou `open dist/index.html` - **sans serveur web** (aucune erreur CORS
sur `file://`). Il se déploie aussi tel quel sur n'importe quel hébergeur statique.

`dist/editor.html` est le second fichier autonome, l'**éditeur de château** - son mode
d'emploi est dans **[EDITEUR.md](EDITEUR.md)**. Il ne partage rien avec le jeu à
l'exécution : c'est un autre build, à partir des mêmes données.

## Déroulé d'une partie

1. Écran titre → **Entrée**.
2. Écran de **sélection** : **1 – Entrer dans le château** (le **donjon de Ronceval**,
   13 salles) · **2 – Aller chez le marchand** · **3 – Charger un château** (un
   `.json` fabriqué dans l'**éditeur** ; on peut aussi le **glisser sur la fenêtre**).
   Le château actif est rappelé sous la bourse.
3. Au **marchand** (achats `1`–`4`, sortie `Q`/Échap) on dépense son or ; on revient à la sélection.
4. Dans le **château**, on cherche les **trois trophées** puis on ressort par la **porte
   principale** (mur du fond de l'entrée) : on **gagne** si on a les trois, sinon on
   retourne à la sélection.

On démarre avec **500 pièces d'or**. L'or et l'inventaire sont **conservés** entre le
marchand et le château (même partie). Un **score** (« Points ») compte chaque objet
ramassé selon un barème (voir *Score*) ; il s'affiche au HUD et sur les écrans de fin.

## Contrôles

| Touche | Action |
| --- | --- |
| Flèches (↑ fond, ↓ avant, ← gauche, → droite) | **Se tourner** (1ᵉʳ appui), puis **avancer** (maintenir = marche continue) |
| **S** | Saut **en longueur** (franchit 3 cases, atterrit 4 plus loin) dans la direction regardée. **Non raccourci** : sans 4 cases libres, il ne se fait pas |
| **D** | Saut **en hauteur** (sur place) - c'est aussi le geste qui agit sur ce qui se trouve **au-dessus de la tête** |
| **A** | S'**accroupir** et **le rester** (requis pour **prendre** au sol) |
| **Espace** | Se **relever** (annule l'accroupissement) |
| **O** | **Ouvrir** / franchir la porte sur la case (avec la bonne clé / le pied-de-biche **en main** si verrouillée) |
| **P** | **Prendre** l'objet sur la case : **accroupi** pour le sol, **debout** pour un piédestal (postures strictes) |
| **F** | **Frapper** (épée **en main**, et **de profil uniquement** - face à la scène ou au fond, un message le rappelle) |
| **G** | **Grimper** (sortir par le plafond) - salle à **sortie haute** + **corde** en inventaire ; la corde est **consommée** (animation : grappin lancé, montée, sortie par le plafond) |
| **B** | **Boire** la fiole en main : vie à 100 % et −1 fiole (impossible à vie pleine) ; les fioles se boivent **dans l'ordre où elles ont été acquises** |
| **L** | **Lire** : le Livre Sacré au sol (avant de le prendre), sinon les **parchemins ramassés** un à un |
| **C** | Déplier la **carte** du château (**carte** en inventaire) - flèches **↑/↓** : changer de niveau, **C**/Échap : refermer |
| **I** | Afficher l'**inventaire** |
| **T** | Basculer l'affichage : **mode MO5** (trait magenta sur fond noir) ⇄ mode couleur (voir *Le mode MO5*) |
| **Q** | Abandonner |
| **1**–**7** | Mettre l'objet correspondant **en main** · **0** : vider la main |
| Entrée | Démarrer / rejouer (ou ressortir d'une oubliette) |

> **Orientation à la 1984** : le héros ne se déplace que dans la direction qu'il
> **regarde**. Une flèche vers une autre direction le fait **pivoter sur place** ; un
> *tap* ne fait que tourner, un *maintien* tourne puis marche. Les **arches** se
> franchissent sans `O` : il suffit de **faire un pas dedans**.

> [!CAUTION]
> **SPOILER ALERT.** Ce qui précède est le manuel : comment lancer le jeu et à quoi
> servent les touches. **À partir d'ici, le README donne les solutions** - l'effet réel de
> chaque objet, ce qui trahit un piège, comment s'ouvrent les passages secrets. Et
> `src/world/ronceval.ts`, le château livré, est la **réponse complète** : ce que contient
> chaque salle, à sa place exacte.
>
> Or ce jeu est fait pour qu'on découvre tout cela **sur place**, note après note et plan
> dessiné à la main : c'est la première des deux règles que s'est fixées ce projet.
> **Si vous comptez y jouer, jouez d'abord.**

## Le mode MO5

La touche **T** bascule, à tout moment, entre le rendu habituel et un **mode MO5** :
décor au **trait magenta sur fond noir**, sol nu, pas d'appareil de pierre ni de
veinures - seuls le héros, les gardes, le feu et l'or restent des aplats colorés.

Ce n'est pas un thème : ce sont les **contraintes de la machine**. Le Thomson MO5
n'affichait que **16 couleurs**, câblées, et l'on y dessinait au trait faute de mémoire
pour des aplats - c'est de là que vient le magenta, pas d'un parti pris graphique. Le
mode se contente donc de rejouer ces deux règles sur les **mêmes primitives** que le
mode couleur : rien n'est redessiné, rien n'est décalqué.

Le réglage n'est **pas conservé** d'une session à l'autre - comme le reste, ici.

## Inventaire & objets

Objets **tenables en main** (touches **1–7**), affichés en bas (« EN MAIN ») et listés
par **I** avec le **nombre possédé** :

| Touche | Objet | Rôle |
| --- | --- | --- |
| 1 | Torche | éclaire une salle noire (voir *Torches*) - se consume |
| 2 | Crucifix | **renvoie les éclairs des fantômes** : tenu en main + `D` (saut) au bon moment |
| 3 | Pied de biche | ouvre les portes/grilles **verrouillées** - **s'use** et **casse après 30 à 40 usages** (retiré de l'inventaire) |
| 4 | Clef en fer | ouvre les portes/grilles **fermées à la clef en fer** |
| 5 | Clef en or | ouvre les **cheminées secrètes** (`O` sur le montant gauche avec la clef en main) |
| 6 | Fiole | **B** : restaure la vie à 100 % (−1) |
| 7 | Épée | **F** : frapper (ajout du moteur ; absent de l'original) |

Objets d'inventaire **non tenables en main** (visibles dans l'inventaire, 2ᵉ colonne) :
la **Corde** (posséder suffit pour **grimper** `G` - consommée à l'usage), l'**Aigle de
plomb** (**indispensable** pour prendre l'Aigle d'Or, voir *Échange des aigles*), la
**Bague** (voir *Pièges*) et la **Carte du château** (`C`, voir *Le plan du château*). Les **trophées** (Aigle d'Or, Diamant Bleu, Livre Sacré), les
**trésors** et les **bourses** (or **75–250 aléatoire**) se ramassent aussi (`A` + `P`).
L'**inventaire (`I`)** s'affiche sur **2 colonnes** (en main / non équipables).

Au sol, on trouve aussi des **dangers** : la **Bague à l'émeraude** (à ne pas prendre - son
effet est caché) et la **potion empoisonnée** (rouge à bouchon vert). Les **parchemins** se
**ramassent** (A+P) et leurs textes, listés dans l'inventaire, se **lisent** (`L`) un à un.

![inventaire](/asset/inventaire.png)

## Mécaniques

- **Score** : chaque objet ramassé rapporte des **points** (barème `SCORE` dans
  `src/items.ts`) : clef en fer  **70**, bourse **30**, fiole **30**,
  fiole empoisonnée **5**, bague **10**, clef en or **200**, aigle de plomb **100**,
  parchemin **100**, crucifix **200**, Diamant Bleu **500**, Livre Sacré **1000**,
  Aigle d'Or **5000**. Le score s'affiche au HUD et en fin de partie (victoire ou défaite).
  Le **Diamant** rapporte aussi **+500 pièces d'or** et l'**Aigle d'Or +5000**.
- **Échange des aigles** : l'**Aigle d'Or est incrusté** dans son piédestal - sans
  l'**aigle de plomb** en inventaire, `P` affiche « **L'aigle est incrusté** ». Avec lui,
  l'échange se fait : l'aigle de plomb **prend la place** de l'Aigle d'Or sur le piédestal
  (et y reste incrusté à son tour, définitivement).
- **Torches & obscurité** : une salle s'éclaire via ses **torches murales**. Une salle
  **sans torche** est éclairée d'office ; une salle dont **aucune torche n'est allumée**
  est **noire** (on ne voit rien).
  - La torche **prise en main** est **éteinte** par défaut (brandie au-dessus de la tête).
  - **Sous une torche murale allumée**, `D` (saut en hauteur) avec une torche en main
    **éteinte** ⇒ elle **s'allume** : dans le noir, on voit alors un **halo** autour de soi.
  - **Sous une torche murale éteinte**, `D` avec une torche en main **allumée** ⇒ on
    **allume la salle** (définitivement).
  - Une torche allumée **se consume** (~30 s) puis disparaît : en racheter / économiser.
- **Hémorragie** : un coup de garde - **ou boire une fiole empoisonnée** - déclenche
  une **perte de vie continue**, stoppée seulement en **buvant une fiole** saine (qui
  remet à 100 %). La potion empoisonnée est **ramassée comme une fiole ordinaire**
  (rien ne la trahit) : le poison agit **quand on la boit** - les fioles se boivent
  **dans l'ordre où elles ont été acquises**.
  Un éclair de fantôme cause **−11 % de vie sèchement**, sans hémorragie.
- **Usure du temps** : les minutes qui s'égrènent coûtent **1 % de forces toutes les
  45 s** de jeu (`TIME_DRAIN_INTERVAL`) - seule la fiole redonne force et ardeur. Le
  pourcentage de forces s'affiche en blanc au centre de la barre du HUD.
- **Chauves-souris** : patrouillent au plafond dans les couloirs. Dès que le héros passe
  dessous, elles plongent et blessent (dégâts + hémorragie). **S'accroupir** (`A`) avant
  qu'elles plongent : elles ne piquent pas. Elles **craignent le feu** : un saut `D` avec
  la **torche allumée en main** au moment où elles passent au-dessus les **enflamme**
  (mortes, elles disparaissent).
- **Fantômes** : fixes, en lévitation, lancent des **éclairs rouges** à hauteur de tête.
  - **S'accroupir** (`A`) : l'éclair passe par-dessus (le fantôme en relance un autre peu après).
  - Touché debout : **−11 % de vie** (sans hémorragie). Le fantôme relance immédiatement.
  - **Crucifix en main** (`2`) + **saut** (`D`) au moment où l'éclair arrive : l'éclair est
    **renvoyé** (devient jaune) et **tue le fantôme** quand il lui revient dessus - seul
    moyen de s'en débarrasser.
  - Le fantôme **bloque le passage** : on ne peut pas marcher sur sa case.
- **Pièges au sol** : certaines dalles sont piégées, **marquées** (taches discrètes) ou **invisibles**.
  Marcher dessus ⇒ chute en **oubliette**. On **saute** par-dessus (`S`) ; on ressort
  d'une oubliette par le plafond **à la corde** (`G`), **à droite du trou** - la corde
  est **consommée**. Une fois révélée, la dalle reste un **trou béant** (rendu 3D, tranche
  de la dalle visible) - visible **même avec la bague**, et on peut y retomber.
- **Grimper à la corde** (`G`) : le héros **lance un grappin** à la verticale qui déroule
  une corde marron, puis **se hisse** ; sa **sortie par le plafond** valide le changement
  de salle. La **corde est consommée** à chaque grimpe (en racheter au marchand).
- **Flèches-pièges** : certains objets (Aigle d'Or, Diamant Bleu) sont **piégés au
  ramassage**. Dès que l'on prend l'objet (`P`), une flèche jaillit du mur latéral et
  traverse la salle un peu plus vite que l'éclair d'un fantôme, à la même hauteur. **S'accroupir**
  (`A`) immédiatement après la prise : la flèche passe au-dessus. Rester debout :
  **mort instantanée**. Un petit **trou discret** dans le mur (pierre légèrement plus sombre)
  indique le côté d'où la flèche partira - à repérer avant de toucher l'objet.
- **Bague (piège)** : la **ramasser masque tous les indices de pièges** - marques des
  dalles piégées, trous de flèche dans les murs, points d'alerte des herses - son
  effet n'est **pas annoncé**, à découvrir. Mieux vaut ne pas la prendre.
- **Parchemins & livre** : les **parchemins** (en allemand) se **ramassent** (A+P) puis se
  **lisent** (`L`) **un à un** - ils sont aussi listés **à la suite** dans l'inventaire (`I`).
  Le **Livre Sacré**, lui, se lit (`L`) **sur sa case avant** de le ramasser. Indices de la légende.
- **Coffres** : conteneurs occupant **3 cases**, dessinés **en perspective** (caisse en
  planches veinées, couvercle bombé en lattes - relevé, on voit son dessous), ouverts au
  **pied de biche** (en main + `O`) **depuis leur case centrale**. Un coffre peut renfermer une **fiole**, une **bourse**,
  un **parchemin**, une **épée**, une **corde**…, être **vide**, ou être **piégé** (l'ouvrir
  fait **chuter en oubliette**). À l'ouverture, le contenu **apparaît au sol** sur la case :
  on le **ramasse** (A+P) ou on le **lit** (`L`) comme un objet de sol.
- **Portes** : quatre rendus - **arche** (passage noir, un pas suffit), **porte en bois**
  (4 planches verticales veinées, gonds, poignée), **grille d'acier** (5 barreaux à points
  d'ancrage + 2 traverses pleine largeur), et la **porte principale** (planches, clous
  dorés, liseré doré). Toutes partagent un **encadrement en pierres apparentes** repris de
  l'arche d'origine : 6 pierres par montant, 3 voussoirs de chaque côté et une clé de
  voûte claire, légèrement piquetés. Sur les ouvertures **latérales**, le **pavage du sol
  se prolonge sous le seuil** (perspective : le noir/fond s'arrête à l'horizontale du
  montant du fond) ; au **mur du fond**, pas de trait au sol. Une
  porte/grille peut être **libre** (`O`), **fermée à la clef en fer**, ou **au pied de
  biche** (objet requis **en main**). Main vide ⇒ « **La porte est verrouillée** » ; mauvais
  objet en main ⇒ « **La porte est fermée** » (aucun indice). Une porte **au pied de biche
  résiste 1 à 2 fois** (« La porte résiste… ») avant de céder ; chaque coup **use le pied
  de biche**, qui **casse après 30 à 40 usages** (« CRAC ! ») et quitte l'inventaire -
  les coups sur portes **et** ouvertures de coffres comptent. Les portes du **mur du fond**
  sont dessinées sur **3 cases** (perspective) mais se franchissent **au centre**. Une porte
  `barred: true` est dessinée normalement mais infranchissable depuis ce côté - sert à
  **matérialiser l'arrivée** d'un passage à sens unique (cheminée, etc.).
- **Herses** : poser le pied sur la **case déclencheuse** fait tomber une grille
  (définitive) qui **bloque le passage** - et passe **devant** le héros enfermé derrière.
  Rendu ajouré : traverse haute, **5 barreaux terminés en pointes** plantées au sol, 2
  traverses. Les herses **latérales** couvrent toute la profondeur par défaut, ou
  seulement `herseRows` rangées. Si `marked: true`, **5 points d'alerte** discrets sont
  posés **à l'aplomb exact** de la ligne de chute - chaque pointe se plante sur son point.
- **Arrivée sur une porte** : on apparaît toujours **devant la porte d'arrivée** (dos à
  elle). Les **portes latérales** sont **toujours sur le front de scène** (rangée avant) ;
  l'**entrée principale** est sur le **mur du fond**.
- **Navigation tournante** : les salles ne forment pas une grille cohérente (boucle de
  tours où l'on tourne en sortant « toujours à droite »). Sans carte, dessinez-la à la main.

## But du jeu

Réunir les **trois trophées** - **Aigle d'Or** (puissance), **Diamant Bleu** (richesse),
**Livre Sacré** (sagesse) - puis revenir à la **porte principale** de l'entrée (mur du
fond) : on **gagne** avec les trois, sinon on **revient à la sélection**.

Le château livré est le **donjon de Ronceval** (`src/world/ronceval.ts`) : 13 salles sur
quatre niveaux, écrites pour ce dépôt. Les salles ne forment pas une grille évidente :
sans carte, dessinez-la à la main - comme à l'époque.

> **Et le château de 1984 ?** Il n'est pas ici, et ne le sera pas : l'agencement de ses
> salles, la position de ses pièges et de ses objets sont l'œuvre de Louis-Marie Rocques.
> Le jeu sait charger n'importe quel château depuis un `.json` (**touche 3**) : qui veut
> rejouer celui d'origine le **reconstruit lui-même** dans l'éditeur, à partir de ses
> propres notes. Le moteur, lui, est complet.

---

# Construire son château

> [!CAUTION]
> **SPOILER ALERT** - on entre ici par la porte de service : tout ce qu'une salle peut
> cacher - pièges, passages secrets, objets - y est décrit comme une donnée à écrire. Les
> exemples sont inventés pour la documentation, mais `src/world/ronceval.ts`, le fichier à
> copier pour écrire le sien, est le château livré **au complet**.

Tout le château est **déclaratif** : on édite des **données**, jamais le rendu. Deux
fichiers :

- **`src/world/rooms.ts`** - le **format** : ce qu'une salle peut être (`RoomDef`), et rien d'autre.
- **`src/world/ronceval.ts`** - le **château livré** (`RONCEVAL_ROOMS`), son point de
  départ et sa salle oubliette. C'est le fichier à copier pour écrire le sien.
- **`src/config.ts`** - réglages globaux : articles du marchand (`SHOP`), or de départ,
  vie, hémorragie, durée de torche, etc.

## Une salle (`RoomDef`)

**Salle par défaut : 16×3, une torche allumée de chaque côté, sans objets ni gardes.**
On n'écrit dans chaque salle que ce qui s'en écarte :

```ts
RONCEVAL_ROOMS = {
  maSalle: {
    id: "maSalle",            // clé unique (= la clé de l'objet RONCEVAL_ROOMS)
    name: "Ma salle",         // libellé interne ; affiché dans le HUD seulement si DEBUG_ROOM_NAME
    // -- Dimensions, AU CHOIX : --
    rows: 2,                  // salle rectangulaire (défaut 16×3 si omis)
    // layout: [...],         // OU forme libre (voir plus bas) - prioritaire
    round: false,              // optionnel : tour cylindrique (voir plus bas)
    doors:  [ /* DoorDef */ ],
    items:  [ /* ItemDef */ ],      // optionnel (défaut : aucun)
    guards: [ /* GuardDef */ ],     // optionnel (défaut : aucun)
    torches: [ /* TorchDef */ ],    // optionnel - défaut : 2 torches allumées ; [] = salle sombre
    traps:   [ /* TrapDef */ ],     // optionnel
    decors:  [ /* DecorDef */ ],    // optionnel : décors muraux (voir plus bas)
    furnitures: [ /* FurnitureDef */ ], // optionnel : meubles-obstacles (voir plus bas)
    oubliette: false,            // optionnel : salle-oubliette (chute)
    ceilingExit: false,          // optionnel : sortie par le plafond (à la corde)
  },
}
```

**Repère de la grille** : `col` de **0 (gauche) à cols−1 (droite)**, `row` de **0 (avant,
près de la caméra) à rows−1 (fond)**. Gabarit d'époque : **16 de large, 2–3 de profondeur**.

### Formes libres (`layout`)

Au lieu de `cols`/`rows`, un `layout` dessine la salle : un tableau de chaînes, **une par
rangée de l'AVANT (row 0) vers le FOND**, `.` = sol praticable, `#` = vide. Il fixe aussi
les dimensions (largeur = longueur des chaînes). Les **murs sont posés automatiquement**
le long des bords vides.

```ts
layout: [
  "................", // row 0 (avant) : barre large
  "................", // row 1
  "#######...######", // row 2 (fond) : pilier central (cols 7-9)  → forme en T
],
```

### Salles rondes (`round: true`)

Ajouter `round: true` rend la salle **cylindrique** : sol et mur du fond suivent un arc
parabolique au lieu d'être plats. Le `layout` en escalier renforce l'illusion de courbure.
Le rendu trace deux polygones :

- **Sol** : un seul polygone du premier plan jusqu'à l'arc (couleur dalles).
- **Mur** : un seul polygone de l'arc jusqu'au plafond (couleur mur du fond).

Pas de murs latéraux, pas de voûtes stepped. Exemple :

```ts
ringA: {
  id: "ringA", name: "Tour Nord", round: true,
  layout: [
    "................", // row 0 : pleine largeur
    "#..............#", // row 1 : coins coupés (1 case chaque côté)
    "#####......#####", // row 2 : murs profonds (5 cases chaque côté)
  ],
  // doors, items, chests...
}
```

## Les portes (`DoorDef`)

```ts
{ col, row, side, target, spawn, lock?, stairs?, exit?, arch?, grille?, barred? }
```

| Champ | Valeurs | Rôle |
| --- | --- | --- |
| `col`,`row` | case | où se trouve la porte |
| `side` | `"front"` \| `"back"` \| `"left"` \| `"right"` | mur portant la porte (`front` = mur du fond ; `back` = côté caméra) |
| `target` | `RoomId` ou `"__exit__"` | salle de destination (`__exit__` = sortie/sélection) |
| `spawn` | `{col,row}` | case d'arrivée **dans la salle cible** (voir règles) |
| `lock?` | `"ironKey"` \| `"crowbar"` | objet requis **en main** pour ouvrir (`O`) |
| `stairs?` | `"up"` \| `"down"` | **escalier** : la porte mène à l'**étage** au-dessus / au-dessous (étages de tours). **Aucun effet sur le jeu** - uniquement sur la **carte**, qui pose alors la salle à l'aplomb, un niveau plus haut ou plus bas. Marquer **un seul côté** suffit : la porte d'en face en déduit son sens |
| `exit?` | `true` | **porte principale** : victoire si 3 trophées, sinon retour sélection |
| `arch?` | `true` | **arche** : pas de porte, on passe en **faisant un pas dedans** (sans `O`) |
| `grille?` | `true` | rendu **grille d'acier** (sinon **porte en bois**) |
| `barred?` | `true` | **barrée de ce côté** : dessinée normalement, infranchissable - passage à sens unique |

**Règles immuables à respecter** (sinon la carte n'est plus « dessinable à la main ») :

1. **Spawn = une porte (ou une porte barrée).** La case `spawn` doit correspondre à une
   **porte de la salle cible**. Pour un passage **réversible**, faites des **paires** (A→B et
   B→A). Pour un passage **à sens unique**, placez une porte ou grille `barred: true` à
   la position de spawn : elle est visible depuis la salle d'arrivée mais ne s'ouvre pas.
2. **Portes latérales (`left`/`right`) toujours en `row 0`** (front de scène).
3. **Porte du mur du fond (`front`) en `col 8`** (« 2 sauts du mur de gauche »). Elle est
   dessinée sur 3 cases mais ne se franchit qu'au centre. Constante `BACK_DOOR_COL`.
4. **On n'arrive jamais par le bas** : évitez les arrivées sur une porte `back` (réservée
   à un usage futur).
5. **Marquez les étages** (`stairs`) : une porte qui monte dans une **tour** n'est pas un
   voisin de palier. Dans Ronceval, `tour-basse` est le premier étage au-dessus de la
   `crypte`. Sans ce marquage, elle se pose sur le palier et bouscule ses voisines ;
   avec, le rez-de-chaussée reste une grille propre.

## Les objets (`ItemDef`)

```ts
{ id, kind, col, row, amount?, text?, pedestal?, arrowTrap?, closesHole? }
```

`id` unique. `amount` sert aux **bourses** (sinon or aléatoire 75–250). `text` est
l'inscription des **parchemins** / du **livre** (lue avec `L`). `pedestal: true` place
l'objet sur un piédestal (ramassable **debout uniquement**). `arrowTrap: { side: "left" | "right" }`
active le **piège à flèche** : au ramassage, une flèche jaillit du mur désigné (voir
*Flèches-pièges* dans Mécaniques). `closesHole: true` : le ramassage **referme le trou
au sol** de la salle (« Le trou se referme ! ») - plus de descente possible ensuite.
La posture est **stricte** : **accroupi + P** pour les objets au sol, **debout + P** pour
les piédestaux - accroupi devant un piédestal, rien ne se passe.
Valeurs de `kind` :

| `kind` | Effet |
| --- | --- |
| `torch` | +1 torche (objet 1) |
| `crucifix` | +1 crucifix (objet 2) |
| `crowbar` | +1 pied de biche (objet 3) |
| `ironKey` | +1 clef en fer (objet 4) |
| `goldKey` | +1 clef en or (objet 5) |
| `vial` | +1 fiole (objet 6) |
| `sword` | +1 épée (objet 7) |
| `rope` | +1 corde (inventaire, pour grimper - consommée à l'usage) |
| `leadEagle` | +1 aigle de plomb - **requis pour prendre l'Aigle d'Or** (échange sur le piédestal) |
| `ring` | **bague-piège** : masque les pièges (effet non annoncé) |
| `treasure` | +1 trésor |
| `purse` | + or (`amount`, ou aléatoire 75–250) |
| `poison` | rejoint l'inventaire **comme une fiole normale** ; la **boire** = dégâts + hémorragie |
| `parchment` | **ramassé** (A+P) ; son `text` rejoint l'inventaire, lu ensuite avec `L` |
| `eagle` | trophée **Aigle d'Or** (+5000 or) - incrusté : exige l'**aigle de plomb** en inventaire |
| `diamond` | trophée **Diamant Bleu** (+500 or) |
| `book` | trophée **Livre Sacré** (aussi **lisible** via `text` avant la prise) |

> Les **3 trophées** (`eagle` + `diamond` + `book`) sont la **condition de victoire**.

## Les coffres (`ChestDef`)

```ts
{ id, col, row, lock?, trap?, content? }
```

Un coffre occupe **3 cases** (centré sur `col`, comme une porte de fond) et s'ouvre (`O`)
**depuis sa case centrale**. À l'ouverture, son `content` **apparaît au sol** sur la case :
on le **ramasse** (A+P) ou on le **lit** (`L`) ensuite, exactement comme un objet de sol.

| Champ | Valeurs | Rôle |
| --- | --- | --- |
| `col`,`row` | case | **centre** du coffre (il déborde sur `col−1` et `col+1`) |
| `lock?` | `"ironKey"` \| `"crowbar"` | objet requis **en main** pour ouvrir (`O`) ; sinon ouverture libre |
| `trap?` | `true` | **coffre piégé** : l'ouvrir fait **chuter en oubliette** (sortie à la corde) |
| `content?` | `{ kind, amount?, text? }` | butin révélé (même `kind` que `ItemDef`) ; **absent ⇒ coffre vide** |

> Ne placez pas un coffre en `col 0` (ses 3 cases sortiraient de la salle). Comme tout
> coffre verrouillé exige son objet **en main**, prévoyez de quoi l'obtenir (au sol ou en
> boutique).

## Les cheminées (`FireplaceDef`)

```ts
{ id, col, row, secret?, target?, spawn? }
```

Une cheminée occupe **3 cases** sur le **mur du fond** (centrée sur `col`, déborde sur
`col−1` et `col+1`). Elle se déclare dans `fireplaces?: FireplaceDef[]` de la salle.

| Champ | Valeurs | Rôle |
| --- | --- | --- |
| `col`,`row` | case | **centre** de la cheminée (mur du fond, `side: "front"` implicite) |
| `secret?` | `true` | **passage secret** : montant gauche = cercle plein (même couleur, indice discret) |
| `target?` | `RoomId` | salle de destination (requis si `secret: true`) |
| `spawn?` | `{col,row}` | case d'arrivée dans la salle cible |

**Visuel** : 2 colonnes (`h 0→0.40`), foyer central noir (`h 0→0.34`), linteau (`h 0.34→0.40`).
Chaque colonne porte **1 cercle** - vide (anneau) sur les deux colonnes d'une cheminée
décorative ; **cercle plein** sur le montant gauche d'un passage secret (même couleur que les
anneaux - indice discret, à découvrir).

**Interaction** (entièrement **silencieuse**) :
- `O` **sur le montant gauche** (`col−1`) avec la **clef en or en main** → ouvre le passage
  (contour lumineux dans le foyer). Aucun message si la clef est absente ou si le passage
  est déjà ouvert.
- **Accroupi** (`A`) sur la **case centrale** (`col`) + **↑** → traversée vers `target` /
  `spawn`. Aucun message si la cheminée n'est pas encore ouverte.

Les cheminées secrètes fonctionnent **par paires** : chaque extrémité est une `FireplaceDef`
avec `secret: true`. Pour un retour par une **porte** plutôt qu'une autre cheminée, placez
une porte/grille `barred: true` à la position de spawn (visible, infranchissable depuis ce
côté).

```ts
// Exemple : aller en salle scellée par la cheminée, retour par la grille (barrée de vault)
vault: {
  doors: [{ col: 15, row: 0, side: "right", target: "sealed",
             spawn: { col: 8, row: 1 }, grille: true, barred: true }],
  fireplaces: [
    { id: "fp-vault", col: 4, row: 1, secret: true, target: "sealed", spawn: { col: 4, row: 1 } },
  ],
},
sealed: {
  doors: [{ col: 8, row: 1, side: "front", target: "vault", spawn: { col: 15, row: 0 }, grille: true }],
  fireplaces: [
    { id: "fp-sealed", col: 4, row: 1, secret: true, target: "vault", spawn: { col: 4, row: 1 } },
  ],
},
```

## Les décors muraux (`DecorDef`)

Purement visuels, déclarés dans `decors?: DecorDef[]` :

```ts
{ kind, col?, row?, side? }
```

| `kind` | Rendu | Largeur |
| --- | --- | --- |
| `boulet` | boulet et sa chaîne pendus au mur | 1 case |
| `aigleNoir` | écusson clair frappé d'un aigle noir | 2 cases |
| `ecusson` | écusson armorié (chef hachuré, bande, meuble) | 2 cases |
| `portrait` | portrait de famille encadré | 2 cases |
| `croix` | cadre sombre à croix dorée | 3 cases |
| `colonnes` | deux grosses colonnes cannelées aux angles du fond | - |
| `piliers` | six piliers fins régulièrement espacés sur le fond | - |
| `toile` | toile d'araignée dans l'angle du plafond (`side`) - ignorée si une torche occupe l'angle | - |

`col` est la **colonne du mur porteur** ; la **profondeur du mur est déduite du layout**
(face d'une aile en T, sinon mur du fond) - pas de `row` à fournir. `row` ne sert que
pour un décor sur **mur latéral** (`side: "left"/"right"`).

## Les meubles (`FurnitureDef`)

Obstacles au sol du jeu d'origine, déclarés dans `furnitures?: FurnitureDef[]` :
**infranchissables à pied** (comme les squelettes), mais le **saut (`S`) les enjambe** ;
on ne peut pas non plus **atterrir** dessus.

```ts
{ kind, col, row }   // col = dalle de GAUCHE ; le meuble occupe col .. col+largeur-1
```

| `kind` | Rendu | Largeur |
| --- | --- | --- |
| `porteManteau` | fût sur socle cylindrique, pointe et crochets recourbés | 1 dalle |
| `chaise` | chaise à haut dossier, assise en planches | 2 dalles |
| `statue` | silhouette drapée sur socle à deux marches | 2 dalles |
| `table` | grande table, plateau en planches veinées, un pied à chaque angle | 3 dalles |

## Gardes, chauves-souris, fantômes, torches, pièges

```ts
// GuardDef : patrouille en aller-retour le long d'une rangée
{ row, colMin, colMax, col?, speed? }   // col = colonne de départ ; speed en cases/s

// BatDef : chauve-souris au plafond dans un couloir (row unique)
{ row, col?, speed? }                   // col = colonne de départ (défaut centre) ; speed en unités-monde/s (défaut 1.0)

// GhostDef : fantôme fixe, lance des éclairs horizontaux
{ col, row, side: "left" | "right" }    // side = côté où il se tient, direction du tir opposée

// TorchDef : torche murale (bas-gauche / bas-droite)
{ side: "left" | "right", lit?: true }  // lit:false => salle noire à éclairer
// Défaut (champ torches absent) : une torche allumée de chaque côté ; torches: [] = salle sombre

// TrapDef : dalle piégée (chute en oubliette)
{ col, row, marked?: true }             // marked => taches visibles au sol

// HerseDef : grille qui tombe quand on marche sur la case déclencheuse
{ triggerCol, triggerRow, herseCol, herseRow, herseSide, marked?, herseRows? }
// herseSide : côté du mur bloqué ; marked => 5 points d'alerte sur la ligne de chute ;
// herseRows : herse latérale bornée à N rangées (défaut : toute la profondeur)
```

Un garde blesse au **contact** (hémorragie) ; on le neutralise à l'**épée** (`F`),
**de profil et sur sa rangée uniquement** (portée `ATTACK_COLS`, en colonnes). Les gardes
sont des **chevaliers en armure grise** (la figurine du héros, palette grise, épée au
poing, marche calée sur les cases) ; un garde mort laisse un **squelette couché** à
l'endroit exact de sa chute (purement visuel, on marche dessus).
Une chauve-souris plonge si le héros passe dessous debout ; s'accroupir (`A`) l'évite ;
un saut avec la torche allumée en main l'enflamme (définitif).
Un fantôme lance des éclairs en boucle ; crucifix en main + saut (`D`) au bon moment le renvoie et le détruit.

Pour les **flèches-pièges**, ajouter `arrowTrap: { side: "left" | "right" }` à n'importe
quel `ItemDef` - la flèche partira du mur indiqué au moment où le joueur ramasse l'objet.

## Sorties par le plafond & oubliettes

- `ceilingExit: true` sur une salle ⇒ on peut en **sortir par le plafond** (`G`) si on a
  une **corde**.
- `oubliette: true` ⇒ salle spéciale où l'on **tombe** en marchant sur un piège ; on
  en ressort à la corde, **à droite du trou**. La salle-oubliette est désignée par
  `OUBLIETTE_ROOM` dans `rooms.ts` ; celle de Ronceval est un **16×2**. Elle est
  **écartée du plan** (touche `C`) : aucune porte n'y mène, elle n'y renseignerait sur
  rien.

## Le plan du château (`C`)

Ajout **hors jeu d'origine**. La **carte** est un objet (`kind: "map"`) qui se ramasse
comme les autres (`A` + `P`) ; une fois en inventaire, **C** la déplie - le jeu se met en
pause, comme pour l'inventaire.

Rien n'est saisi à la main : **le plan est entièrement déduit des `RoomDef`**
(`src/world/mapLayout.ts`), donc il vaut pour **n'importe quel château**, pas seulement
celui qui est livré.

- **L'orientation de chaque salle.** C'est la clé du plan. Une salle est toujours dessinée
  **de face**, mais rien ne dit qu'elles regardent toutes le même point cardinal : le
  « mur du fond » des **cuisines** donne sur le **corps de garde**, qui est pourtant leur
  voisin du **sud** sur le plan - les cuisines sont simplement vues **en regardant vers le
  sud**. On retrouve donc l'orientation de chaque salle (un **quart de tour** parmi quatre)
  en recollant les passages **deux à deux** : une porte et la **porte d'en face** (celle qui
  attend le héros sur sa case d'arrivée - la même que cherche `Game.doTransition`) doivent
  se tourner le dos. La **salle d'entrée** sert de référence : elle regarde le **nord**, sa
  porte principale donnant sur l'extérieur, en haut du plan. De proche en proche, tout le
  château s'oriente **sans contradiction possible**.
- **Les positions.** Une salle = une case. La direction d'une porte **sur le plan**, c'est
  son mur (fond / gauche / droite) **tourné de l'orientation de sa salle**. Le plan se
  remplit de proche en proche depuis l'entrée, et l'on **retrouve exactement la grille
  qu'on aurait dessinée à la main**. Le remplissage va du
  plus certain au plus arbitraire : passages à **double sens** d'abord, salles les plus
  **contraintes** d'abord (une salle à porte unique ne prend jamais la place d'une salle
  tenue par ses deux bouts), puis les sens uniques, puis les déplacements. Si deux salles
  se disputent malgré tout une case, la seconde se pose sur la **case libre la plus
  proche** et sa porte devient un **trait de liaison** : rien n'est perdu, le plan reste
  vrai. Une fois les **étages de tours** déclarés (`stairs`, voir plus bas), Ronceval n'en
  compte **aucun** : ses quatre niveaux se superposent au cordeau.
- **Les niveaux.** On part de la salle d'entrée (niveau 0). Les **portes** et les
  **cheminées secrètes** gardent le niveau ; un **trou au sol** (`holeTile`) descend d'un
  niveau, une **dale étoile** (`climbTile`) monte d'un niveau, et une porte marquée
  **`stairs`** (un escalier - les **étages de tours**) monte ou descend d'un niveau. Les
  intitulés suivent : *rez-de-chaussée*, *1er étage*, *sous-sol*, *2e sous-sol*…
- **Les oubliettes sont écartées du plan** (`oubliette: true`) : on y tombe de n'importe
  où, aucune porte n'y mène, elles n'ont donc pas de place sur un plan et n'y
  renseigneraient sur rien. Consultée depuis une oubliette, la carte le dit simplement.
- **Les niveaux restent superposés** : une salle atteinte par un trou ou une grimpe se pose
  **à l'aplomb** de sa source, et la grille est commune à tous les niveaux - les
  catacombes s'affichent bien sous la salle par laquelle on y tombe.

Le plan montre la **structure**, jamais le contenu : ouvertures (**arche**, **porte**,
**grille**, et la **sortie du château** en trait plus épais), **trou de descente**
(disque), **escalier** (marches,
dessinées **à côté de leur porte** : on voit laquelle monte), **cheminée** (âtre), et la
salle où l'on se trouve (**cadre rouge** et point au centre). Aucune salle n'est nommée ni
numérotée, pas même celle où l'on est : c'est un plan, pas une liste.

Et il **ne trahit pas les secrets** : il ne dit pas non plus si une porte est
**verrouillée** - arche, porte ou grille, la serrure se découvre sur place. Les cheminées
sont **toutes** dessinées pareil,
qu'elles soient décoratives ou à passage secret - au joueur de trouver lesquelles. Les **dales étoile** (grimpe à la corde) n'y
figurent pas du tout : elles se voient **au sol, dans la salle**, une fois qu'on y est. Les
**salles noires** - celles qui n'ont **aucune torche allumée au départ** - sont
**grisées**, comme le « Salle dans le noir » du plan d'époque ; elles peuvent toujours
s'éclairer en cours de partie (torche allumée en main, `D` sous une torche murale), la
carte donnant l'état de départ. Ni objets, ni pièges, ni gardes : le plan ne joue pas à la
place du joueur.

`MAP_REVEAL_ALL` (`config.ts`) vaut `false` : la carte ne révèle que les salles **déjà
parcourues**, et se complète en explorant. Passé à `true`, elle montre **tout** le château
d'emblée - les salles parcourues sont relevées dans `World.visited` dans les deux cas, la
bascule suffit.

## Réglages globaux

- `ronceval.ts` : le château est dans `RONCEVAL_ROOMS`, avec `RONCEVAL_START_ROOM` (salle
  de départ) et `RONCEVAL_START_SPAWN` (`{col,row}` de départ). `OUBLIETTE_ROOM` (la
  salle où l'on tombe) est dans `rooms.ts`, avec le reste du format.
- `items.ts` : `SCORE` (barème de points par objet ramassé), noms, articles du marchand.
- `config.ts` : or de départ (`Player.gold = 500`), `MAX_HEALTH`, `BLEED_RATE`
  (hémorragie), `TIME_DRAIN_INTERVAL` (usure du temps, 45 s), `GHOST_DAMAGE`
  (éclair, 11), `TORCH_DURATION` (durée d'une torche),
  `CLIMB_THROW_TIME` / `CLIMB_UP_TIME` (animation de grimpe), `LEAP_STEPS` (portée du
  saut), `BACK_DOOR_COL`, couleurs.

```ts
// items.ts - articles du marchand
export const SHOP = [
  { item: "vial",   price: 250 },
  { item: "torch",  price: 170 },
  { item: "rope",   price: 110 },
  { item: "crowbar", price: 250 },
];
```

## Exemple minimal : un château de 2 salles

```ts
export const MON_START_ROOM = "entree";
export const MON_START_SPAWN = { col: 8, row: 1 };

export const MES_SALLES = {
  entree: {
    id: "entree", name: "Entree",     // 16×3 et 2 torches allumées par défaut
    doors: [
      // Porte principale (sortie) sur le mur du fond, col 8 :
      { col: 8, row: 2, side: "front", target: "__exit__", spawn: { col: 8, row: 0 }, exit: true },
      // Vers la salle au trésor : arche latérale, en row 0 :
      { col: 0, row: 0, side: "left", target: "tresor", spawn: { col: 15, row: 0 }, arch: true },
    ],
    items: [{ id: "epee", kind: "sword", col: 4, row: 0 }],
  },
  tresor: {
    id: "tresor", name: "Tresor", rows: 2,
    torches: [{ side: "left", lit: true }],  // une seule torche, à gauche
    doors: [
      // Retour vers l'entrée : arche latérale en row 0, spawn sur l'arche d'entrée :
      { col: 15, row: 0, side: "right", target: "entree", spawn: { col: 0, row: 0 }, arch: true },
    ],
    items: [
      { id: "aigle", kind: "eagle", col: 8, row: 0 },
      { id: "dia", kind: "diamond", col: 11, row: 0 },
      { id: "livre", kind: "book", col: 5, row: 0 },
    ],
    guards: [{ row: 0, colMin: 2, colMax: 13, speed: 2.5 }],
  },
};
```

On y entre, on prend l'épée, on passe l'**arche** vers le trésor, on ramasse les **trois
trophées** (en esquivant le garde), on revient et on franchit la **porte principale** :
victoire.

## L'éditeur de château

Tout ce qui précède s'écrit à la main dans `ronceval.ts`. L'**éditeur** fait la même chose
à la souris, et produit un `.json` que le jeu sait charger - sans rien recompiler.

```bash
npm run build:editor   # puis double-clic sur dist/editor.html
```

C'est un **second fichier autonome**, construit par sa propre config Vite
(`vite.editor.config.ts`). Il est **hors de la contrainte de taille** du jeu : le jeu doit
tenir dans les 128 ko d'un TO9, pas l'outil qui sert à le bâtir. En revanche il **importe
les mêmes modules** (`world/rooms.ts`, `world/mapLayout.ts`, `world/loadCastle.ts`), si
bien qu'il ne peut pas diverger du format. La dépendance ne va que dans ce sens :
`src/editor/` n'est jamais importé par le jeu, donc n'entre jamais dans son bundle.

On y bâtit le plan en **tirant un trait d'une salle à l'autre** - l'éditeur écrit alors la
paire de portes et leurs `spawn` réciproques, si bien que les règles ci-dessus sont vraies
**par construction**. Un **validateur** vérifie le reste en continu ; le château livré
n'y produit ni erreur ni avertissement.

Le fichier produit contient les `RoomDef` **verbatim**, moins l'`id` (la clé fait foi), et
les valeurs par défaut élaguées. On le charge par l'écran de sélection, **3 – Charger un
château**, ou en le **glissant sur la fenêtre**.

> **Mode d'emploi complet : [EDITEUR.md](EDITEUR.md)** - les trois vues, les gestes, les
> gabarits de salle, la rotation, le validateur, le format du fichier.

## Architecture (pour aller plus loin)

Le monde est un **plan-sol** : chaque entité a `x ∈ [-1,1]` (gauche→droite) et
`z ∈ [0,1]` (proche→loin), projeté en perspective à l'affichage.

- `src/render/perspective.ts` - **cœur** : projection à un point de fuite. Chaque rangée
  fait **50 px d'époque constants** : la grille est **identique d'une salle à l'autre**
  (aucun « saut » des dalles en passant une porte), et le mur du fond d'une salle de
  3 rangées tombe quasiment à l'échelle d'époque (0,615 contre 0,6).
- `src/render/Scene.ts` - dessin des salles (sol en damier, murs, portes, torches) et des
  entités triées par profondeur.
- `src/engine/` - boucle à pas fixe, Renderer Canvas, entrées (clavier AZERTY/QWERTY géré).
- `src/entities/` - Player, Guard, Bat, Ghost, ArrowTrap, Door, Item.
- `src/world/` - `rooms.ts` (le format), `ronceval.ts` (le château livré), `Room.ts`
  (runtime + praticabilité), `grid.ts`, `mapLayout.ts` (déduction du plan : niveaux +
  position de chaque salle en grille), `loadCastle.ts` (lecture d'un château `.json`).
- `src/systems/` - déplacement (`physics.ts`), combat, interaction (`interaction.ts`).
- `src/ui/` - HUD et écrans (titre / sélection / marchand / inventaire / victoire / game
  over) ; `MapScreen.ts` dessine le plan (`C`).
- `src/items.ts` - noms des objets, ordre des touches 1–7, articles du marchand.
- `src/editor/` - l'**éditeur de château** ([EDITEUR.md](EDITEUR.md)), build à part
  (`dist/editor.html`). Il importe `src/world/` ; **rien du jeu n'importe `src/editor/`**,
  c'est ce qui garantit qu'il n'entre jamais dans le bundle du jeu ni dans sa contrainte
  de taille.

Voir aussi **[`ALIGNEMENT.md`](ALIGNEMENT.md)** pour les écarts restants avec la version
d'origine, et **[`EDITEUR.md`](EDITEUR.md)** pour le mode d'emploi de l'éditeur.

---

# Mentions légales & licence

## Avertissement (disclaimer)

**L'Aigle d'Or** est une œuvre originale de **Louis-Marie Rocques**, publiée par **Loriciels**
(1984/1985). Le jeu d'origine - son nom, son univers, son scénario et l'ensemble de ses
éléments - **reste la propriété exclusive de son auteur et de ses ayants droit**. Ce projet
n'est **ni affilié, ni approuvé, ni soutenu** par eux.

**« Abandonware » n'existe pas en droit** : ni la disparition de l'éditeur, ni l'arrêt de la
commercialisation, ni l'âge du jeu ne le font tomber dans le domaine public. Cet hommage
existe donc **par tolérance**, pas par droit acquis.

Ce dépôt est un **hommage** à l'un des tout premiers jeux d'aventure en **« 3D »** de l'histoire
du jeu vidéo. Il s'agit d'une **reconstruction fondée sur l'idée et sur les mécaniques** du
jeu - lesquelles ne sont **pas protégeables** - entièrement **réécrite à partir de zéro**.

**Ce qui est dans ce dépôt :**

- Un **moteur**, un **format de château** et un **éditeur** écrits intégralement pour ce
  projet. Aucun code, graphisme, son ou donnée n'a été **extrait du produit d'origine** ;
  tout le rendu est **vectoriel et procédural**.
- Un **château original**, le *donjon de Ronceval* ([`src/world/ronceval.ts`](src/world/ronceval.ts)),
  écrit pour ce dépôt. Il n'emprunte **rien** au plan de 1984.
- Des **textes d'écran** (titre, victoire, écrits trouvés en jeu) rédigés pour ce projet.
  **Aucune phrase** du jeu d'origine n'y est reprise.
- Le **mode MO5** (touche `T`, voir plus haut) restitue les **contraintes matérielles
  du Thomson MO5** - sa palette câblée de 16 couleurs et le dessin au trait qu'imposait
  sa mémoire - appliquées aux **primitives de ce dépôt**. Il ne reproduit aucun écran du
  jeu d'origine.

**Ce qui n'est pas dans ce dépôt :**

- **Le plan du château de L'Aigle d'Or.** L'agencement de ses salles, la position de ses
  pièges et de ses objets sont l'**œuvre de Louis-Marie Rocques**, et non la nôtre : ils ne
  sont distribués ici **sous aucune forme**. Le jeu sait charger un château depuis un
  fichier JSON (**touche 3**) ; qui veut rejouer celui de 1984 le **reconstruit lui-même**
  dans l'éditeur.
- **Aucune capture d'écran**, aucun document ni aucune ressource issus du jeu d'origine.

**Aucune commercialisation** de ce projet ou de ses dérivés n'est autorisée : il est diffusé
**gratuitement**, à but **non lucratif**, **éducatif et patrimonial**.

> **Retrait.** Si vous êtes l'auteur ou un ayant droit et souhaitez une modification ou le
> retrait de tout ou partie de ce projet, **ouvrez une issue** sur ce dépôt : il sera
> **donné suite immédiatement**, sans discussion et sans condition.

## Licence

Le **code de ce dépôt** (hors éléments couverts par les droits de tiers ci-dessus) est publié
sous **PolyForm Noncommercial License 1.0.0** - voir le fichier [`LICENSE`](LICENSE).

Cette licence autorise l'usage, l'étude, la modification et le partage du code **à la seule
condition qu'ils restent à des fins non commerciales**. Toute utilisation commerciale est
**interdite**. Voir aussi le fichier [`NOTICE`](NOTICE).

Elle **ne porte que sur notre propre travail** : elle ne confère aucun droit sur *L'Aigle
d'Or*, sur son titre, ni sur quoi que ce soit qui appartienne à son auteur ou à ses ayants
droit - **on ne concède pas ce qu'on ne détient pas**.
