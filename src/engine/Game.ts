import type { Dir, GameStateName, RoomId } from "../types";
import type { DoorSide } from "../entities/Door";
import { ATTACK_COOLDOWN, ATTACK_DURATION, BLEED_RATE, CLIMB_THROW_TIME, CLIMB_UP_TIME, COLORS, DEBUG_ROOM_NAME, GHOST_DAMAGE, GUARD_DAMAGE, MAP_REVEAL_ALL, MAX_HEALTH, TIME_DRAIN_INTERVAL, TORCH_DURATION } from "../config";
import { Renderer } from "./Renderer";
import { Input } from "./Input";
import { Player } from "../entities/Player";
import { World, type Room } from "../world/Room";
import type { CastleDef } from "../world/rooms";
import { RONCEVAL_CASTLE } from "../world/ronceval";
import { dropCastle, pickCastle, type LoadedCastle } from "../world/loadCastle";
import { jumpInPlace, stepPlayer } from "../systems/physics";
import { resolveCombat } from "../systems/combat";
import { openChest, openDoor, openFireplace, readItem, takeItem } from "../systems/interaction";
import { HELD_KEYS, HELD_NAME, SHOP } from "../items";
import { drawScene } from "../render/Scene";
import { toggleLegacy } from "../render/legacy";
import { drawHud } from "../ui/Hud";
import { drawGameOver, drawInventory, drawSelect, drawShop, drawTitle, drawWin } from "../ui/screens";
import { castleMap, type CastleMap } from "../world/mapLayout";
import { drawCastleMapScreen } from "../ui/MapScreen";

/** En arrivant par une porte, on lui tourne le dos (on regarde vers l'intérieur). */
const ENTRY_FACING: Record<DoorSide, Dir> = {
  front: "front", // porte au mur du fond -> on regarde vers la caméra
  back: "back",
  left: "right",
  right: "left",
};

/** Direction d'un pas « dans » l'arche (vers le mur où elle se trouve). */
const ARCH_EXIT: Record<DoorSide, Dir> = {
  front: "back", // mur du fond : on s'y enfonce (+profondeur)
  back: "front",
  left: "left",
  right: "right",
};

/** Machine à états du jeu + orchestration update/render. */
export class Game {
  private state: GameStateName = "title";
  private world!: World;
  private player!: Player;
  private message = "";
  private messageTime = 0;
  private showInventory = false;
  /** Plan du château ouvert (touche C) : met le jeu en pause, comme l'inventaire. */
  private showMap = false;
  /** Niveau affiché par le plan (flèches haut/bas pour en changer). */
  private mapLevel = 0;
  /** Où ressortir d'une oubliette (case sûre d'avant la chute). */
  private oublietteReturn: { roomId: RoomId; col: number; row: number } | null = null;
  /** Transition à exécuter quand le héros sort par le plafond (fin de la grimpe). */
  private pendingClimb: (() => void) | null = null;
  /** Drain temporel : temps écoulé depuis la dernière perte de forces (s). */
  private drainTimer = 0;
  /** Château joué : celui qui est livré, ou celui d'un fichier chargé (touche 3). */
  private castle: CastleDef = RONCEVAL_CASTLE;
  /** Nom du fichier chargé, affiché à la sélection ("" = le château livré). */
  private castleName = "";
  /** Dernier échec de chargement, affiché à la sélection. */
  private castleError = "";

  constructor(
    private readonly r: Renderer,
    private readonly input: Input,
  ) {
    // Un château glissé sur la fenêtre remplace le château courant - sauf en pleine
    // partie, où on ne va pas escamoter le château sous les pieds du joueur.
    dropCastle(
      (loaded) => {
        if (this.state === "playing") this.castleError = "Terminez la partie d'abord.";
        else this.loadCastle(loaded);
      },
      () => (this.castleError = "Fichier illisible."),
    );
  }

  /** Château chargé : on rebâtit le monde ; le héros et sa bourse sont conservés. */
  private loadCastle({ castle, name }: LoadedCastle): void {
    this.castle = castle;
    this.castleName = name;
    this.castleError = "";
    this.world = new World(castle.start, castle.rooms);
  }

  /** Nouvelle partie : héros (500 or) + château neufs, puis écran de sélection. */
  private startSession(): void {
    this.world = new World(this.castle.start, this.castle.rooms);
    this.player = new Player();
    this.message = "";
    this.messageTime = 0;
    this.showInventory = false;
    this.showMap = false;
    this.oublietteReturn = null;
    this.pendingClimb = null;
    this.drainTimer = 0;
    this.state = "select";
  }

  /** Entrer dans le château (depuis la sélection) : on apparaît à l'entrée. */
  private enterCastle(): void {
    const room = this.world.goTo(this.castle.start);
    this.player.placeAt(this.castle.spawn.col, this.castle.spawn.row, room.cols, room.rows);
    this.player.facing = "front";
    this.state = "playing";
  }

  /** Change de salle : place le héros sur la porte d'arrivée, dos à celle-ci. */
  private doTransition(target: RoomId, col: number, row: number): void {
    const next = this.world.goTo(target);
    this.player.placeAt(col, row, next.cols, next.rows);
    const arrival = next.doors.find((d) => d.col === col && d.row === row);
    if (arrival) this.player.facing = ENTRY_FACING[arrival.side];
    // Court verrou : la touche maintenue (pour entrer dans l'arche) ne re-pivote pas aussitôt.
    this.player.moveLock = 0.2;
  }

  /** Transition par cheminée : on arrive dans la cheminée cible, on se relève. */
  private doTransitionFireplace(target: RoomId, col: number, row: number): void {
    const next = this.world.goTo(target);
    this.player.placeAt(col, row, next.cols, next.rows);
    this.player.facing = "front"; // on regarde vers la salle à la sortie
    this.player.crouching = false;
    this.player.moveLock = 0.3;
  }

  /** Grimper à la corde par une dale étoile vers le niveau supérieur. */
  private doTransitionClimb(target: RoomId, col: number, row: number): void {
    const next = this.world.goTo(target);
    this.player.placeAt(col, row, next.cols, next.rows);
    this.player.facing = "front"; // on regarde la salle en arrivant par le plafond
    this.player.crouching = false;
    this.player.moveLock = 0.3;
  }

  /**
   * Grimpe à la corde : la corde est consommée au lancer du grappin ; `done`
   * exécute la transition de salle quand le héros est sorti par le plafond.
   */
  private startClimb(done: () => void): void {
    const p = this.player;
    p.inventory.rope -= 1;
    p.crouching = false;
    p.facing = "back"; // on grimpe dos à la caméra
    p.climbStage = "throw";
    p.climbT = 0;
    this.pendingClimb = done;
  }

  private setMessage(text: string): void {
    this.message = text;
    this.messageTime = 3;
  }

  update(dt: number): void {
    // Bascule d'affichage : hors du switch, donc valable dans tous les états.
    if (this.input.wasChar("t")) {
      this.setMessage(toggleLegacy() ? "Mode MO5" : "Mode couleur");
    }
    switch (this.state) {
      case "title":
        if (this.input.wasPressed("Enter")) this.startSession();
        break;
      case "select":
        if (this.input.wasPressed("Digit1") || this.input.wasPressed("Numpad1")) this.enterCastle();
        else if (this.input.wasPressed("Digit2") || this.input.wasPressed("Numpad2")) this.state = "shop";
        else if (this.input.wasPressed("Digit3") || this.input.wasPressed("Numpad3")) {
          pickCastle((loaded) => this.loadCastle(loaded), () => (this.castleError = "Fichier illisible."));
        }
        break;
      case "shop":
        this.updateShop();
        break;
      case "playing":
        this.updatePlaying(dt);
        break;
      case "win":
      case "gameover":
        if (this.input.wasPressed("Enter")) this.state = "title";
        break;
    }
    this.input.endFrame();
  }

  /** Boutique : achats (1..4) et sortie (Q/Echap) vers la sélection. */
  private updateShop(): void {
    const input = this.input;
    if (input.wasChar("q") || input.wasPressed("Escape")) {
      this.state = "select";
      return;
    }
    for (let i = 0; i < SHOP.length; i++) {
      if (input.wasPressed(`Digit${i + 1}`) || input.wasPressed(`Numpad${i + 1}`)) {
        const { item, price } = SHOP[i];
        if (this.player.gold >= price) {
          this.player.gold -= price;
          this.player.inventory[item] += 1;
          if (item === "vial") this.player.vialQueue.push(false); // saine, dans la file
          this.setMessage(`Achat : ${HELD_NAME[item]}`);
        } else {
          this.setMessage("Pas assez d'or.");
        }
        return;
      }
    }
  }

  private updatePlaying(dt: number): void {
    const p = this.player;
    const input = this.input;
    const room = this.world.current;

    // Inventaire (I) et plan du château (C) mettent le jeu en pause, et s'EXCLUENT :
    // on ne déplie pas la carte depuis l'inventaire, ni l'inverse - jamais deux
    // écrans superposés. Il faut refermer l'un pour ouvrir l'autre.
    if (this.showInventory) {
      if (input.wasChar("i")) this.showInventory = false;
      else this.handleHandSelection();
      return;
    }
    if (this.showMap) {
      this.updateMap();
      return;
    }
    if (input.wasChar("c")) {
      this.openMap();
      return;
    }
    if (input.wasChar("i")) {
      this.showInventory = true;
      return;
    }

    // Grimpe en cours : le monde attend ; la sortie par le plafond valide la transition.
    if (p.climbStage !== "none") {
      p.climbT += dt;
      if (p.climbStage === "throw" && p.climbT >= CLIMB_THROW_TIME) {
        p.climbStage = "up";
        p.climbT = 0;
      } else if (p.climbStage === "up" && p.climbT >= CLIMB_UP_TIME) {
        p.climbStage = "none";
        p.climbT = 0;
        const done = this.pendingClimb;
        this.pendingClimb = null;
        done?.();
      }
      return;
    }

    if (room.isOubliette) {
      // Drain : −1% de forces toutes les 5 secondes.
      p.health = Math.max(0, p.health - dt * 0.2);
      // Grimper (G) à la corde : seule issue, par le plafond.
      if (input.wasChar("g")) {
        if (p.owns("rope") && this.oublietteReturn) {
          const ret = this.oublietteReturn;
          this.startClimb(() => {
            const dest = this.world.goTo(ret.roomId);
            // On ressort À DROITE du trou (sinon on retomberait dedans) ; sinon à gauche.
            let c = ret.col + 1;
            const safe = (cc: number) =>
              dest.isWalkable(cc, ret.row) && !dest.isTrap(cc, ret.row) && !dest.isSkeletonAt(cc, ret.row);
            if (!safe(c)) c = ret.col - 1;
            p.placeAt(c, ret.row, dest.cols, dest.rows);
            this.setMessage("Vous vous hissez hors de l'oubliette !");
          });
        } else {
          this.setMessage("Il vous faut une corde pour grimper.");
        }
        return;
      }
      // (pas de return : le joueur peut se déplacer normalement)
    }


    // Minuteurs.
    p.invuln = Math.max(0, p.invuln - dt);
    p.attackTimer = Math.max(0, p.attackTimer - dt);
    p.attackCooldown = Math.max(0, p.attackCooldown - dt);
    if (this.messageTime > 0) {
      this.messageTime -= dt;
      if (this.messageTime <= 0) this.message = "";
    }

    // Hémorragie : la vie baisse continûment jusqu'à boire une fiole.
    if (p.bleeding) p.health = Math.max(0, p.health - BLEED_RATE * dt);

    // Drain temporel : les minutes qui s'égrènent coûtent 1 % de forces toutes les 45 s.
    this.drainTimer += dt;
    if (this.drainTimer >= TIME_DRAIN_INTERVAL) {
      this.drainTimer -= TIME_DRAIN_INTERVAL;
      p.health = Math.max(0, p.health - 1);
    }

    // Torche allumée en main : elle se consume puis disparaît.
    if (p.inHand === "torch" && p.handTorchLit) {
      p.torchFuel -= dt;
      if (p.torchFuel <= 0) {
        p.inventory.torch -= 1;
        p.handTorchLit = false;
        if (p.inventory.torch <= 0) p.inHand = null;
        this.setMessage("Votre torche s'est consumee.");
      }
    }

    if (!p.isAlive) {
      this.state = "gameover";
      return;
    }

    // Abandon (suicide).
    if (input.wasChar("q")) {
      this.state = "gameover";
      return;
    }

    this.handleHandSelection();

    // Accroupissement : A pour rester accroupi, Espace pour se relever.
    if (input.wasChar("a")) p.crouching = true;
    if (input.wasPressed("Space")) p.crouching = false;

    // Saut en hauteur (D) : sur place ; sous une torche murale, échange de feu avec la torche en main.
    if (!p.animating && !p.crouching && input.wasChar("d")) {
      this.handleTorchJump(room, p);
      jumpInPlace(p);
    }

    // Ouvrir (O) : porte → coffre → montant gauche d'une cheminée secrète.
    if (!p.animating && input.wasChar("o")) {
      let res = openDoor(p, room);
      if (res.kind === "none") res = openChest(p, room);
      if (res.kind === "none") res = openFireplace(p, room);
      // Le pied de biche vient de casser : le signaler (prime sur le message de l'action).
      if (p.crowbarBroke) {
        p.crowbarBroke = false;
        this.setMessage("CRAC ! Le pied de biche casse.");
        if (res.kind === "message") res = { kind: "none" };
      }
      if (res.kind === "win") {
        this.state = "win";
        return;
      }
      if (res.kind === "leave") {
        // Porte principale sans l'Aigle : retour à l'écran de sélection.
        this.state = "select";
        return;
      }
      if (res.kind === "transition") {
        this.doTransition(res.target, res.spawn.col, res.spawn.row);
        return;
      }
      if (res.kind === "trap") {
        // Coffre piégé : même chute que les dalles piégées.
        this.fallIntoOubliette(room, p.col, p.row);
        return;
      }
      if (res.kind === "message") this.setMessage(res.text);
    }

    // Prendre (P) : accroupi pour les objets au sol ; debout si piédestal.
    if (!p.animating && input.wasChar("p")) {
      const onPedestal = room.items.some(
        (i) => !i.collected && i.pedestal && i.col === p.col && i.row === p.row,
      );
      if (p.crouching || onPedestal) {
        const targetItem = room.items.find(
          (i) => !i.collected && i.col === p.col && i.row === p.row,
        );
        const res = takeItem(p, room);
        if (res.kind === "message") {
          this.setMessage(res.text);
          if (targetItem?.arrowTrap) {
            const trap = room.arrowTraps.find((t) => t.itemId === targetItem.id);
            if (trap) trap.trigger();
          }
        }
      }
    }

    // Frapper (F) : épée en main, et uniquement de profil (gauche/droite).
    if (input.wasChar("f")) {
      if (p.inHand !== "sword") {
      } else if (p.facing === "front" || p.facing === "back") {
      } else if (p.attackCooldown <= 0) {
        p.attackTimer = ATTACK_DURATION;
        p.attackCooldown = ATTACK_COOLDOWN;
      }
    }

    // Grimper (G) : depuis la dale étoile, avec une corde → monter au niveau supérieur.
    if (input.wasChar("g")) {
      if (room.climbTile && room.isClimbTile(p.col, p.row)) {
        if (p.owns("rope")) {
          const t = room.climbTile;
          this.startClimb(() => this.doTransitionClimb(t.target, t.spawn.col, t.spawn.row));
        } else {
          this.setMessage("Il vous faut une corde pour grimper.");
        }
      } else {
        this.setMessage("Rien à escalader ici.");
      }
    }
    // Boire (B) : la fiole en main restaure la vie à 100 % et est consommée (-1).
    if (input.wasChar("b")) {
      if (p.inHand !== "vial" || p.inventory.vial <= 0) {
        this.setMessage("Il faut une fiole en main pour boire.");
      } else if (p.health >= MAX_HEALTH && !p.bleeding) {
        this.setMessage("Vie deja pleine.");
      } else {
        // Les fioles se boivent dans l'ORDRE où elles ont été acquises : si la
        // prochaine de la file est l'empoisonnée, tant pis pour le héros.
        const poisoned = p.vialQueue.shift() ?? false;
        p.inventory.vial -= 1;
        if (p.inventory.vial === 0) p.inHand = null; // plus de fiole à tenir
        if (poisoned) {
          p.health = Math.max(0, p.health - GUARD_DAMAGE);
          p.bleeding = true;
          this.setMessage("POISON ! La fiole était empoisonnée...");
        } else {
          p.health = MAX_HEALTH;
          p.bleeding = false; // la fiole stoppe l'hémorragie
          this.setMessage("Vous buvez la fiole : vie restaurée, hémorragie stoppée !");
        }
      }
    }
    // Lire (L) : parchemins/inscriptions à venir.
    if (input.wasChar("l")) {
      const res = readItem(p, room);
      if (res.kind === "message") this.setMessage(res.text);
    }

    // Cheminée secrète ouverte : accroupi au centre + ↑ → s'y engager.
    if (p.crouching && !p.animating && input.wasPressed("ArrowUp")) {
      const fp = room.fireplaces.find((f) => f.secret && f.col === p.col && f.row === p.row);
      if (fp) {
        if (fp.opened && fp.target && fp.spawn) {
          this.doTransitionFireplace(fp.target, fp.spawn.col, fp.spawn.row);
        }
        return;
      }
    }

    // Déplacement + saut en longueur (S).
    stepPlayer(p, room, input, dt);

    // Arche : sur sa case, faire un pas DANS l'arche (vers le mur) change de salle.
    if (p.blockedDir) {
      const arch = room.doors.find(
        (d) => d.arch && d.col === p.col && d.row === p.row && ARCH_EXIT[d.side] === p.blockedDir,
      );
      if (arch) {
        this.doTransition(arch.target, arch.spawn.col, arch.spawn.row);
        return;
      }
    }

    // Dalle piégée : chute en oubliette (on note le TROU pour ressortir à côté, à la corde).
    if (!p.animating && room.isTrap(p.col, p.row)) {
      this.fallIntoOubliette(room, p.col, p.row);
      return;
    }

    // Trou au sol : descente au niveau inférieur (sans corde = dégâts + saignement).
    if (!p.animating && room.isHoleTile(p.col, p.row)) {
      this.fallThroughHole(room);
      return;
    }

    // Herse : se déclenche en posant le pied sur la case déclencheuse.
    if (!p.animating && room.triggerHerse(p.col, p.row)) {
      this.setMessage("Une herse s'abat derrière vous !");
    }

    for (const guard of room.guards) guard.update(dt);
    resolveCombat(p, room);

    // Chauves-souris : piquent si le joueur passe dessous sans s'accroupir. Elles
    // craignent le feu : un saut (D) avec la torche allumée en main les enflamme.
    for (const bat of room.bats) {
      if (!bat.alive) continue;
      bat.update(dt);
      if (p.hop > 0 && p.inHand === "torch" && p.handTorchLit && bat.isNearPlayer(p.x, p.z)) {
        bat.alive = false;
        this.setMessage("La chauve-souris s'enflamme !");
        continue;
      }
      if (bat.canDive && !p.crouching && bat.isNearPlayer(p.x, p.z)) bat.dive();
      if (bat.isStriking && bat.isNearPlayer(p.x, p.z) && p.invuln <= 0 && !p.crouching) {
        p.health = Math.max(0, p.health - GUARD_DAMAGE);
        p.invuln = 1.5;
        p.bleeding = true;
      }
    }

    // Flèches-pièges : déclenchées au ramassage d'un objet ; esquive en se baissant ; mort instantanée.
    for (const trap of room.arrowTraps) {
      trap.update(dt);
      if (!trap.arrowActive) continue;
      if (trap.arrowX > 1.05 || trap.arrowX < -1.05) {
        trap.arrowActive = false;
        continue;
      }
      if (Math.abs(trap.arrowX - p.x) < 0.14 && Math.abs(trap.z - p.z) < 0.22) {
        if (!p.crouching) {
          p.health = 0;
          trap.arrowActive = false;
          this.setMessage("La flèche vous transperce !");
        }
        // Accroupi : la flèche passe par-dessus, continue vers le mur opposé.
      }
    }

    // Fantômes : lancent des éclairs, bloquables en se baissant ou renvoyables avec le crucifix.
    for (const ghost of room.ghosts) {
      ghost.update(dt);
      if (!ghost.alive || !ghost.boltActive) continue;

      // Éclair renvoyé : touche le fantôme quand il revient dessus.
      if (ghost.boltDeflected && ghost.boltClearedGhost && Math.abs(ghost.boltX - ghost.x) < 0.14) {
        ghost.hitsLeft -= 1;
        if (ghost.hitsLeft <= 0) {
          ghost.alive = false;
          ghost.boltActive = false;
          this.setMessage("Le fantome est foudroyé !");
        } else {
          ghost.resetBolt();
        }
        continue;
      }

      // Éclair hors de la salle (touche un mur) : cooldown 1 s.
      if (ghost.boltX > 1.05 || ghost.boltX < -1.05) {
        ghost.resetBolt();
        continue;
      }

      // Éclair normal : vérifie la collision avec le joueur.
      if (!ghost.boltDeflected &&
          Math.abs(ghost.boltX - p.x) < 0.14 &&
          Math.abs(ghost.z - p.z) < 0.22) {
        if (p.hop > 0 && p.inHand === "crucifix") {
          // Renvoi avec le crucifix en main pendant le saut !
          ghost.deflectBolt();
        } else if (!p.crouching && p.invuln <= 0) {
          // Touché (debout, pas d'invincibilité) : −11 % de vie, sans hémorragie.
          p.health = Math.max(0, p.health - GHOST_DAMAGE);
          p.invuln = 2.0;
          this.setMessage("L'éclair vous frappe !");
          ghost.resetBolt();
        }
        // Si accroupi : l'éclair passe par-dessus, continue vers le mur.
      }
    }

    if (!p.isAlive) this.state = "gameover";
  }

  /** Descente par un trou au sol vers le niveau inférieur. Sans corde : dégâts + saignement. */
  private fallThroughHole(room: Room): void {
    const hole = room.holeTile!;
    if (!this.player.owns("rope")) {
      this.player.health = Math.max(0, this.player.health - GUARD_DAMAGE);
      this.player.bleeding = true;
    }
    const next = this.world.goTo(hole.target);
    this.player.placeAt(hole.spawn.col, hole.spawn.row, next.cols, next.rows);
    this.player.facing = "front";
    this.player.crouching = false;
    this.player.moveLock = 0.3;
  }

  /** Chute en oubliette depuis (col,row) : on note le TROU pour ressortir à côté, à la corde. */
  private fallIntoOubliette(room: Room, col: number, row: number): void {
    // La dalle piégée est révélée : elle restera affichée comme un trou béant.
    room.openTrap(col, row);
    this.oublietteReturn = { roomId: room.id, col, row };
    const oub = this.world.goTo(this.castle.oubliette);
    this.player.placeAt(8, 0, oub.cols, oub.rows);
  }

  /** Plan du château, déduit une fois pour toutes des données de salles. */
  private castleMap(): CastleMap {
    return castleMap(this.world.defs, this.world.startRoom);
  }

  /** C : déplier la carte, ouverte sur le niveau où l'on se trouve. */
  private openMap(): void {
    if (!this.player.owns("map")) {
      this.setMessage("Vous n'avez pas de carte.");
      return;
    }
    this.showMap = true;
    this.mapLevel = this.castleMap().byId.get(this.world.current.id)?.level ?? 0;
  }

  /** Carte dépliée : les flèches changent de niveau, C (ou Échap) la referme. */
  private updateMap(): void {
    if (this.input.wasChar("c") || this.input.wasPressed("Escape")) {
      this.showMap = false;
      return;
    }
    const levels = this.castleMap().levels;
    if (this.input.wasPressed("ArrowUp")) {
      const above = levels.filter((l) => l > this.mapLevel);
      if (above.length > 0) this.mapLevel = Math.min(...above);
    }
    if (this.input.wasPressed("ArrowDown")) {
      const below = levels.filter((l) => l < this.mapLevel);
      if (below.length > 0) this.mapLevel = Math.max(...below);
    }
  }

  /** Touches 1..6 : prendre un objet en main ; 0 : vider la main. */
  private handleHandSelection(): void {
    const p = this.player;
    if (this.input.wasPressed("Digit0") || this.input.wasPressed("Numpad0")) {
      p.inHand = null;
      this.setMessage("Main vide.");
      return;
    }
    for (let i = 0; i < HELD_KEYS.length; i++) {
      if (this.input.wasPressed(`Digit${i + 1}`) || this.input.wasPressed(`Numpad${i + 1}`)) {
        const it = HELD_KEYS[i];
        if (p.owns(it)) {
          p.inHand = it;
          if (it === "torch") p.handTorchLit = false; // éteinte par défaut une fois en main
        }
        return;
      }
    }
  }

  /**
   * Saut vertical sous une torche murale, torche en main :
   * - torche en main éteinte + torche murale allumée => on allume la torche en main ;
   * - torche en main allumée + torche murale éteinte => on allume la salle (définitif).
   */
  private handleTorchJump(room: Room, p: Player): void {
    if (p.inHand !== "torch" || p.row !== 0) return;
    const side = p.col === 0 ? "left" : p.col === room.cols - 1 ? "right" : null;
    if (!side) return;
    const wall = room.torches.find((t) => t.side === side);
    if (!wall) return;
    if (!p.handTorchLit && wall.lit) {
      p.handTorchLit = true;
      p.torchFuel = TORCH_DURATION;
    } else if (p.handTorchLit && !wall.lit) {
      wall.lit = true;
      this.setMessage("Vous allumez la salle !");
    }
  }

  render(): void {
    if (this.state === "title") {
      this.r.clear(COLORS.dark);
      drawTitle(this.r);
      return;
    }
    if (this.state === "select") {
      this.r.clear(COLORS.dark);
      drawSelect(this.r, this.player.gold, this.castleName, this.castleError);
      return;
    }
    if (this.state === "shop") {
      this.r.clear(COLORS.dark);
      drawShop(this.r, this.player);
      return;
    }

    const room = this.world.current;
    drawScene(this.r, room, this.player);
    // Nom de la salle : masqué (le jeu d'origine ne l'affichait pas), sauf en debug.
    const roomLabel = DEBUG_ROOM_NAME ? (room.isLit() ? room.name : "???") : "";
    drawHud(this.r, this.player, roomLabel, this.message);

    if (this.state === "win") drawWin(this.r, this.player);
    else if (this.state === "gameover") drawGameOver(this.r, this.player.score);

    // Jamais les deux : l'inventaire et le plan s'excluent (voir updatePlaying).
    if (this.showMap) {
      drawCastleMapScreen(
        this.r, this.castleMap(), this.mapLevel, room.id, this.world.visited, MAP_REVEAL_ALL,
      );
    } else if (this.showInventory) {
      drawInventory(this.r, this.player);
    }
  }

}
