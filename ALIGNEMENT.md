# Alignement avec l'original

Comparaison entre notre refonte et **L'Aigle d'Or** (version Thomson, Loriciel 1985),
d'après la *Solution de la version Thomson* (carte annotée par Loewen, 2003), l'article
Grospixels (grospixels.com/site/Aigledor1.php) et des tests sur le jeu original.

> Ce document **décrit** le jeu de 1984 pour situer nos écarts : c'est un carnet
> d'observation, pas une redistribution. Il ne contient ni son code, ni ses ressources, ni
> le plan de son château - lequel n'est pas dans ce dépôt (voir [`NOTICE`](NOTICE)). Les
> fichiers `asset_legacy/` qu'il cite sont notre documentation de travail **privée**, non
> versionnée et non diffusée.

Légende : ✅ conforme · ⚠️ divergence (volontaire ou à trancher) · ❌ pas encore fait.

## ✅ Aligné / conforme

- **Commandes** : `A` s'accroupir (et le rester), **Espace** se relever, `B` boire,
  `S` saut en longueur, `D` saut en hauteur, `O` ouvrir, `P` prendre, `L` **lire**
  (parchemins + livre), `G` grimper, `I` inventaire, `Q` abandon.
- **Objet en main 0–6** : Vide / Torche / Crucifix / Pied de biche / **Clef en fer** /
  Clef en or / Fiole (on ajoute `7` Épée, hors original).
- **Ramasser accroupi** (A puis P) pour les objets au sol. **Ramasser debout** (P seul)
  pour les objets posés sur un **piédestal** (aigle d'or, diamant bleu, crucifix) : le
  piédestal reste en place après la prise. La posture est **stricte** : accroupi, on ne
  peut PAS prendre un objet sur piédestal (et debout, pas un objet au sol).
- **Porte centrale à 2 sauts** du mur de gauche (colonne 8).
- **Torche qui se consume** (≈30 s) puis disparaît → racheter.
- **Fiole** : restaure les forces **et stoppe l'hémorragie**.
- **Hémorragie** : perte de vie continue après un coup, jusqu'à boire une fiole.
- **Salles dans l'obscurité** : message **« Il fait noir ici »** affiché à l'écran ;
  disparaît dès qu'une torche en main est allumée (halo autour du héros). Deux types :
  salle avec torche(s) murale(s) éteinte(s) (éclairable par le joueur au saut `D`) vs
  salle sans torche au mur (obscurité permanente, torche en main seulement).
- **Oubliette** : le joueur se déplace librement, **aucune information** affichée, il
  doit trouver seul la sortie (`G` + corde = remonte à côté du trou). Drain lent :
  **−1% de forces toutes les 5 s**.
- **Boutique** : achat torche / pied de biche / corde / fiole ; conseil « torche + pied
  de biche avant d'entrer, cordes ensuite ».
- **Trois trophées = victoire** : Aigle d'Or (puissance), Diamant Bleu (richesse),
  Livre Sacré (sagesse).
- **Bourse** d'or ramassable, **montant aléatoire 75–250** (l'original monte « jusqu'à 250 or »).
- **Score (« Points »)** : chaque objet ramassé rapporte des points (barème `SCORE` de
  `items.ts`) : clef en fer 70, bourse 30, fiole 30, poison 5,
  bague 10, clef en or 200, aigle de plomb 100, parchemin 100, crucifix 200, Diamant 500,
  Livre 1000, Aigle d'Or 5000. Affiché au HUD (« Score ») et sur les écrans de fin.
- **Gains d'or des trophées** : **Diamant = +500 or**, **Aigle d'Or = +5000 or** au ramassage.
- **Pied de biche qui casse** : chaque usage (coup sur porte, ouverture de coffre) l'use ;
  il **casse après 30 à 40 usages** (tirage aléatoire) et est **retiré de l'inventaire**.
- **Corde consommée** à chaque grimpe (`G`), avec l'**animation d'origine** : grappin lancé
  à la verticale qui déroule une corde marron, montée du héros, et **sortie par le plafond**
  qui valide le changement de salle. Vaut aussi pour la remontée d'oubliette.
- **Éclair de fantôme : −11 % de forces**, sans hémorragie.
- **Usure du temps** : « les minutes qui s'égrènent » coûtent **1 % de forces toutes les
  45 s** (mesuré sur l'original). Seule la fiole de jouvence « redonne force et ardeur ».
- **Chauves-souris et le feu** : « la chauve-souris n'aime pas la lumière », un saut en
  hauteur avec la **torche allumée** en main **l'enflamme** (elle meurt et disparaît).
- **Pourcentage de forces** affiché dans la barre du HUD (« Forces: 86 % » à l'original).
- Serrures **clef de fer** et **pied de biche** ; une porte **au pied de biche résiste
  1 à 2 fois** (« La porte résiste… ») avant de céder. Messages : main vide ⇒ « verrouillée »,
  mauvais objet ⇒ « fermée » (sans indice).
- **Parchemins** : **ramassés** (A+P), leurs **indices en allemand** rejoignent l'inventaire
  et se **lisent** (`L`) un à un (à la suite). Le **Livre Sacré** se lit **avant** de le ramasser.
- **Bague à l'émeraude** (objet-piège) : la **ramasser masque tous les indices de pièges**
  : dalles piégées, trous de flèche au mur, points d'alerte des herses (effet non
  annoncé) ; visible dans l'inventaire (non équipable).
- **Potion empoisonnée** (fiole rouge, bouchon vert) : **aucun effet au ramassage** - elle
  rejoint l'inventaire **comme une fiole ordinaire** (même message, rien ne la trahit).
  Le poison agit **quand on la boit** (dégâts + hémorragie au lieu du soin) ; les fioles
  se boivent **dans l'ordre où elles ont été acquises** (achat ou ramassage).
- **Aigle de plomb** : pas un simple leurre, il est **indispensable pour prendre l'Aigle d'Or**.
  Sans lui : « **L'aigle est incrusté** ». Avec lui : l'échange se fait et l'aigle de plomb
  **prend la place de l'Aigle d'Or sur le piédestal** (incrusté à son tour).
- **Coffres** (3 cases, ouverts au pied de biche depuis le centre) : peuvent contenir fiole,
  bourse, parchemin, épée, corde…, être **vides**, ou **piégés** (ouverture ⇒ oubliette). Le
  contenu **apparaît au sol** à l'ouverture (ramassé A+P ou lu `L`).
- **Inventaire sur 2 colonnes** : en main (1–7) / non équipables (corde, aigle, bague).
- **Aigle d'Or et aigle de plomb dessinés** (aigle héraldique, plus de simple flèche).
- **Perspective proche de l'époque** : rangées de **50 px constants** - le mur du fond
  d'une salle de 3 rangées tombe à 0,615 du front (0,6 à l'original) ; voir la
  divergence « grille stable » plus bas.
- **Pas de plafond affiché** + point de fuite remonté (haut de l'écran sombre).
- **Entrée sur le mur du fond** ; **portes du mur du fond dessinées sur 3 cases** (passage
  au centre) ; **portes latérales toujours au front de scène**.
- **Rendus de portes** : **arche** (ouverture noire), **porte en bois** (4 planches
  verticales veinées, gonds et poignée), **grille d'acier** (5 barreaux à points
  d'ancrage, 2 traverses pleine largeur). Porte principale **ornementée** (planches,
  clous dorés, liseré doré), sans texte. **Porte/grille barrée** (`barred: true`) :
  dessinée normalement, infranchissable depuis ce côté. Il s'agit d'un passage à sens unique.
- **Encadrement en pierres apparentes** sur toutes les ouvertures, repris de la capture
  de l'arche d'origine (`asset_legacy/arche.png`) : **6 pierres par montant, 3 voussoirs
  de chaque côté et une clé de voûte** plus large et plus claire, avec piquetage. Notre
  voûte reste surbaissée (l'original est en plein cintre). Les voussoirs épousent la
  courbe.
- **Perspective des ouvertures latérales** : le **pavage du sol se prolonge sous le
  seuil** des arches et grilles (le fond s'arrête à l'horizontale du pied du montant du
  fond, pas de triangle noir ni d'hypoténuse) ; au mur du fond, pas de trait au sol.
- **Cheminées** : **un cercle par montant**, même couleur pour décoratives et passages secrets.
  Passage secret : montant gauche = **cercle plein** (vs vide sur les décoratives), un indice
  discret, à découvrir. Ouverture **silencieuse** avec la clef en or (`O` sur col−1, aucun
  message si mauvaise clef ou passage déjà fermé) ; traversée accroupi + ↑ au centre.
  Fonctionnent **par paires** (A→B et B→A). Mur du fond, 3 cases de large.
- **Clef en or** : sert **exclusivement** aux passages secrets entre cheminées. Conforme
  à l'original (pilier gauche, traits jaunes de la carte).
- **Tours cylindriques** (`round: true`) : sol et mur du fond suivent un **arc parabolique**
  (deux polygones, pas de voûtes stepped). Cela donne l'illusion d'une salle ronde en
  pseudo-3D.
- **Menu de départ** : **1 – Entrer dans le château** (le plan original) /
  **2 – Aller chez le marchand**. Le château de démo a été supprimé.
- **Décors muraux d'origine** : boulet et sa chaîne, écusson à l'aigle noir, écusson
  armorié, cadre à croix, portrait, grandes colonnes d'angle, six piliers fins, toile
  d'araignée dans l'angle - redessinés en vectoriel d'après les salles du jeu
  (`DecorDef`, le mur porteur est déduit du layout).
- **Meubles d'origine** (captures `chaise.jpg`, `porte manteau.jpg`, `statue.jpg`,
  `table.jpg`) : chaise à haut dossier (2 dalles), porte-manteau sur socle cylindrique
  (1 dalle), statue drapée sur socle (2 dalles), grande table en planches veinées
  (3 dalles). **Non traversables à pied** comme à l'original ; le saut les enjambe.
- **Coffre en perspective** : caisse-boîte posée sur le plan-sol (face avant en
  planches, face latérale côté point de fuite), couvercle bombé débité en lattes -
  rectangulaire (vu de dessous) quand il est relevé.
- **Gardes en armure** : la figurine du héros en nuances de gris (casque, cuirasse,
  jambières), épée au poing, cycle de marche calé sur les cases. Un garde mort laisse
  un **squelette couché** à l'endroit de sa chute.
- **Ouvertures vers un niveau inférieur** : trou rond au sol dessiné dans le plan du sol
  en perspective ; marcher dessus descend (corde = indolore, sinon dégâts). On arrive sur
  la dale étoile ; la remontée respawn à côté du trou. Rendu **3D à double bord** comme
  l'original (capture `aigle.jpg`) : la **tranche de la dalle** est visible au second
  plan, dans le trou.
- **Dalle piégée crevée** : après une chute (et la remontée d'oubliette), la marque du
  piège est **remplacée par un trou béant** avec le même rendu que les trous de descente,
  visible même avec la bague ; on peut y retomber.
- **Ramassage qui referme un trou** : certains objets scellent le **trou au sol** de leur
  salle quand on les prend (option `closesHole` de l'`ItemDef`).
- **Effets des indices** : les efets de la bague, la clef d'or, le crucifix et l'étoile au sol sont dans les écrits en allemand.
- **Mode MO5** (touche `T`) : décor au trait magenta sur fond noir, sol nu (une ligne au
  pied du mur du fond, deux diagonales sur les côtés), ni appareil de pierre ni veinures,
  aucun dégradé ; le héros, les gardes, le feu et l'or restent des aplats colorés.
  **Chaque angle de mur - ouvert ou fermé - porte un trait vertical**, du pied du mur à
  son sommet : deux dans une salle rectangulaire, un par décrochement dans une salle en T
  ou en escalier (cf. `asset_legacy/grille piege ouverte.png`, où les quatre traits
  marquent les bouts du fond et les montants de l'alcôve).
  Calé sur les captures `asset_legacy/aigle.jpg` et `asset_legacy/table.jpg`. Ce sont les
  **contraintes de la machine** (16 couleurs câblées, dessin au trait) appliquées aux
  primitives du remake - aucun écran d'origine n'est reproduit.
  
## ⚠️ Divergences

- **Saut** : la doc dit « enjambe 2 cases » ; on est resté sur **4 cases** (test réel),
  conservé volontairement.
- **Épée / combat (F)** : ajout maison, absent de l'original. Le combat est **latéral
  uniquement** (face à la scène ou au fond, un message le rappelle) ; le coup **abaisse
  l'épée tenue** en arc (pas d'effet lumineux), portée en colonnes (`ATTACK_COLS`).
- **Grille stable entre salles** : l'original étirait les rangées selon la profondeur de
  la salle (profondeur totale 40·(cases+1)) - les dalles « bougeaient » d'une salle à
  l'autre. Nous avons fixé **50 px par rangée, constants partout** : la grille ne saute
  plus au passage des portes, au prix d'un léger écart d'échelle du mur du fond
  (0,615 vs 0,6 à 3 rangées, 0,706 vs 0,667 à 2). Choix assumé.
- **Cases occupées par un objet** : dans l'original on **ne pouvait pas** marcher dessus
  (limite de chevauchement de pixels de l'époque). On **autorise** de s'y tenir (pour
  ramasser). Divergence assumée.
- **Château livré** : le jeu embarque le **donjon de Ronceval** (`RONCEVAL_ROOMS`,
  13 salles écrites pour ce dépôt), et non le plan de L'Aigle d'Or - qui appartient à son
  auteur. Le moteur reste capable de jouer n'importe quel château chargé en `.json`
  (touche 3), y compris celui que vous reconstruiriez vous-même dans l'éditeur.
- **Bague « à l'émeraude »** : l'original ne parle que d'« une bague » (la pierre, turquoise,
  est entre le vert et le bleu). Notre lecture
  émeraude est une **interprétation assumée**.
- **Chauves-souris définitivement mortes** : dans le jeu elle réapparaissent sans
  prévenir ; chez nous, une chauve-souris enflammée ne revient pas. Choix assumé.
- **Pas de son** : l'original a quelques bruitages (pas du héros…) ; le remake restera
  muet. Choix assumé.

## ❌ Pas encore implémenté

- Rien 

## Compléments des captures MO5 (map du château + Catacombes)

Sources : map MO5 annotée + planche « Les Catacombes » (captures in-game + map).

### Conflit de version à trancher
- ✅ **`D` = saut en hauteur** (version MO5 testée ; l'autre solution *T07/TO9* dit `H`).
  Tranché : on garde **`D`**.
- **`Q` = suicide** : **confirmé** par la map MO5.
- ✅ **ESPACE = Debout** (se relever après s'être accroupi avec `A`).
- **Flèches = Nord / Sud / Est / Ouest** : ✅ confirme l'orientation 4 directions.

### HUD original (capture in-game)
`Forces: 88 %` · `Main: CROIX` · `Points: 6480` · `Pièces d'or: 2597`
- ✅ On affiche **« FORCES »** (conforme à l'original).
- ✅ **Score (« Points »)** : implémenté (barème par objet, HUD + écrans de fin).

### Objets / ennemis (nouveaux)
- ✅ **Deux fioles** : **Fiole de jouvence** (verte, soigne) **et Poison** (rouge à bouchon
  vert) - ramassée comme une fiole normale, elle **nuit à la consommation** (les fioles se
  boivent dans l'ordre d'acquisition).
- ✅ **Fantômes** : silhouette spectrale bleu pâle, lévitation, flottement vertical. Lancent un
  **éclair rouge** à hauteur de tête, traversant toute la salle. S'accroupir (`A`) = l'éclair
  passe et le fantôme relance un nouvel éclair 1 s après. Touché debout = **−11 % de vie**,
  sans hémorragie ; le fantôme relance immédiatement. **Crucifix en main + saut** (`D`) au bon
  moment = renvoi (éclair jaune) : décrémente le compteur interne du fantôme (`hits` = 1, 2 ou 4
  selon la def). Il meurt seulement quand ce compteur atteint 0, sinon il relance. Seul moyen
  de l'arrêter. Fantôme infranchissable (bloque le pas). **Le compteur n'est pas affiché**,
  le joueur doit le découvrir.
- ✅ **Chauves-souris** : silhouette rouge-brun au plafond, vol horizontal aller-retour
  (4 s pour traverser la salle). Plonge sur le joueur quand il passe dessous **sauf s'il
  est accroupi** (`A`) : la chauve-souris ne plonge pas du tout. Sinon : dégâts + hémorragie.
  La fiole ne protège pas ; elle sert uniquement à se soigner après le passage. Un saut
  `D` avec la **torche allumée** en main l'**enflamme** (morte, définitivement).
- ✅ **Flèche-piège** : certains objets sur piédestal (Aigle d'Or, Diamant Bleu) déclenchent
  une flèche au ramassage (`P`). La flèche jaillit du mur latéral configuré (côté opposé à
  la porte d'arrivée), un peu plus vite que l'éclair du fantôme, à la même hauteur. **S'accroupir** (`A`)
  immédiatement = elle passe par-dessus. Rester debout = **mort instantanée**. Indice : un
  petit trou discret dans le mur (couleur légèrement plus sombre que la pierre) signale le
  côté d'où la flèche partira, à repérer avant de toucher l'objet. Une seule flèche par objet.
- ✅ **Crucifix = arme** : **tenu en main** (`2`) + **saut** (`D`) au moment où l'éclair arrive
  = renvoi (éclair jaune). Rendu en main (forme de croix inclinée).
- ✅ **Anneau / bague** (bague à l'émeraude, objet-piège qui masque les pièges).

### Salles / portes (taxonomie MO5)
- ✅ **Deux types de salle noire** : salle sans torche au mur (obscurité permanente) vs
  salle avec torche(s) éteinte(s) (éclairable par le joueur au saut `D`).
- ❌ **Oubliette mortelle** (sans issue, pas de sortie à la corde) : non implémentée.
- **Portes / grilles** : ✅ **Arche** (passage noir, un pas suffit), ✅ **porte en bois**,
  ✅ **grille d'acier** (barreaux), ✅ verrous **clef en fer** / **pied de biche**,
  ✅ **porte/grille barrée** (`barred`) sens unique.
- ⚠️ **Écran titre** : même *fonction* qu'à l'origine (une arrivée, une rumeur, l'annonce
  de ce qu'il faut réunir), mais **texte entièrement réécrit** - la prose de 1984 est
  l'œuvre de son auteur et n'est pas reprise, pas même une phrase.
- ✅ **Herse** : se déclenche quand le joueur pose le pied sur la case déclencheuse, tombe
  définitivement, bloque le pas normal et le saut (étapes intermédiaires). Grille
  **ajourée** (traverse haute, **5 barreaux terminés en pointes**, 2 traverses), dessinée
  **devant le héros** enfermé derrière. Latérale : toute la profondeur ou bornée
  (`herseRows`). Marquage optionnel : **5 points d'alerte à l'aplomb exact** de la chute,
  un sous chaque pointe.
- ✅ **Coffres** qui **contiennent un objet** (fiole, bourse, parchemin…), peuvent être vides
  ou **piégés** ; contenu révélé au sol à l'ouverture (pied de biche).
- ℹ️ **« N pas avant l'oubliette »** = indication du nombre de pas avant la trappe.

### Niveaux & navigation (jeu MULTI-NIVEAUX)
- ✅ **Niveau supérieur** : `G` + corde sur une **dale étoile** monte au niveau du dessus
  (`climbTile`). Certaines salles hautes sans porte n'ont pour issue qu'une cheminée
  secrète (clef en or) : sans clef, piège mortel découvert seul. Bleu/rouge sur la carte
  papier = légende de l'auteur uniquement.
- ✅ **Niveau inférieur** : **trou rond** au sol (dessiné dans le plan du sol en perspective) ;
  marcher dessus descend au niveau inférieur. Avec corde = indolore ; sans corde = dégâts +
  saignement. On arrive sur la **dale étoile** du niveau inférieur ; en remontant on ressort
  **à côté du trou** (évite la boucle infinie).
- ✅ **Étage de l'aigle d'or** : niveau supplémentaire accessible par dale étoile + corde.
- (Confirmé sur le plan **CPC/Amstrad**, identique au MO5.)

### Fin de partie
- ✅ **Victoire = les 3 trophées** réunis (Aigle + Diamant + Livre), écran de victoire dédié.
  (Texte d'origine « Tu es trop fort! » non repris ; pas de visuel des 3 objets à l'écran.)

## Prochains chantiers conseillés (fidélité)

1. **Oubliette mortelle** : le personnage tombe sur des piques et meurt.
