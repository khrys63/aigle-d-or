import type { RoomId } from "../types";
import type { Door, Spawn } from "../entities/Door";
import type { Player } from "../entities/Player";
import type { Room } from "../world/Room";
import { HELD_NAME, SCORE } from "../items";
import { Item } from "../entities/Item";

export type InteractResult =
  | { kind: "none" }
  | { kind: "message"; text: string }
  | { kind: "transition"; target: RoomId; spawn: Spawn }
  | { kind: "leave" } // porte principale : retour à l'écran de sélection
  | { kind: "trap" } // coffre piégé : chute en oubliette (gérée par Game)
  | { kind: "win" };

function doorAt(room: Room, col: number, row: number): Door | undefined {
  return room.doors.find((d) => d.col === col && d.row === row);
}

/** Usure du pied de biche à chaque usage : il casse (et quitte l'inventaire) après 30 à 40 coups. */
function wearCrowbar(player: Player): void {
  player.crowbarWear += 1;
  if (player.crowbarWear < player.crowbarLife) return;
  player.crowbarWear = 0;
  player.crowbarLife = 30 + Math.floor(Math.random() * 11); // durée de vie du suivant
  player.inventory.crowbar -= 1;
  player.crowbarBroke = true;
  if (player.inventory.crowbar <= 0) player.inHand = null;
}

/** O : ouvrir / franchir la porte sur la case courante (selon l'objet en main). */
export function openDoor(player: Player, room: Room): InteractResult {
  const door = doorAt(room, player.col, player.row);
  if (!door) return { kind: "none" };
  if (door.barred) return { kind: "none" };

  if (door.exit) {
    // Porte principale : victoire avec les TROIS objets, sinon retour à la sélection.
    return player.hasAllQuest ? { kind: "win" } : { kind: "leave" };
  }
  if (door.lock && !door.opened) {
    // Main vide => « verrouillée » ; mauvais objet en main => « fermée » (aucun indice).
    if (player.inHand === null) return { kind: "message", text: "La porte est verrouillee." };
    if (player.inHand !== door.lock) return { kind: "message", text: "La porte est fermee." };
    // Bon objet en main : une porte au pied de biche peut résister 1 ou 2 fois.
    if (door.lock === "crowbar" && door.resist > 0) {
      door.resist -= 1;
      wearCrowbar(player);
      return { kind: "message", text: "La porte resiste ..." };
    }
    if (door.lock === "crowbar") wearCrowbar(player); // le coup qui fait céder la porte
    door.opened = true;
  }
  return { kind: "transition", target: door.target, spawn: door.spawn };
}

/** O sur le montant gauche d'une cheminée secrète (col-1) : ouvrir avec la clé en or. */
export function openFireplace(player: Player, room: Room): InteractResult {
  const fp = room.fireplaces.find(
    (f) => f.secret && f.col - 1 === player.col && f.row === player.row,
  );
  if (!fp) return { kind: "none" };
  if (fp.opened) return { kind: "none" };
  if (player.inHand !== "goldKey") return { kind: "none" };
  fp.opened = true;
  return { kind: "message", text: "La cheminee grince et s'entrouvre !" };
}

/** O (sur un coffre) : l'ouvrir au pied de biche ; révèle le contenu au sol. */
export function openChest(player: Player, room: Room): InteractResult {
  const chest = room.chests.find((c) => !c.opened && c.col === player.col && c.row === player.row);
  if (!chest) return { kind: "none" };

  if (chest.lock && player.inHand !== chest.lock) {
    return { kind: "message", text: "Le coffre est verrouille." };
  }
  if (chest.lock === "crowbar") wearCrowbar(player);
  chest.opened = true;

  if (chest.trap) return { kind: "trap" }; // piège : chute en oubliette
  if (!chest.content) return { kind: "message", text: "Le coffre est vide." };

  // Révéler le contenu : un objet posé sur la case, ramassable (A+P) ou lisible (L).
  const { kind, amount, text } = chest.content;
  room.items.push(new Item(`${chest.id}-loot`, kind, chest.col, chest.row, amount ?? 0, text ?? ""));
  return { kind: "message", text: "Le coffre s'ouvre..." };
}

/** P : prendre l'objet posé sur la case courante. */
export function takeItem(player: Player, room: Room): InteractResult {
  // Posture stricte (comme l'original) : accroupi on ne prend que les objets AU SOL,
  // debout on ne prend que sur un PIÉDESTAL - accroupi devant un piédestal, rien.
  const item = room.items.find(
    (i) => !i.collected && i.col === player.col && i.row === player.row &&
      (player.crouching ? !i.pedestal : i.pedestal),
  );
  if (!item) {
    // Prendre sur un coffre ouvert et vide : le signaler.
    const empty = room.chests.find(
      (c) => c.opened && !c.content && !c.trap && c.col === player.col && c.row === player.row,
    );
    return empty ? { kind: "message", text: "Le coffre est vide." } : { kind: "none" };
  }

  // L'aigle d'or est scellé : il faut poser l'aigle de plomb à sa place pour le prendre.
  // Une fois l'échange fait, l'aigle de plomb est incrusté à son tour sur le piédestal.
  if ((item.kind === "eagle" && !player.owns("leadEagle")) || (item.kind === "leadEagle" && item.pedestal)) {
    return { kind: "message", text: "L'aigle est incruste." };
  }

  // Toutes les branches ci-dessous ramassent l'objet : les points sont acquis ici,
  // et le ramassage peut refermer le trou au sol de la salle.
  player.score += SCORE[item.kind] ?? 0;
  if (item.closesHole) room.closeHole();

  switch (item.kind) {
    case "parchment":
      // On le ramasse : son texte rejoint l'inventaire (lu ensuite avec L, à la suite).
      item.collected = true;
      player.parchments.push(item.text);
      return { kind: "message", text: "Parchemin ramassé (lisez-le avec L)." };
    case "treasure":
      item.collected = true;
      player.treasures += 1;
      return { kind: "message", text: "Tresor ramassé !" };
    case "purse": {
      item.collected = true;
      const g = 75 + Math.floor(Math.random() * 176); // 75..250
      player.gold += g;
      return { kind: "message", text: `Bourse : +${g} pièces d'or !` };
    }
    case "poison":
      // Pas d'effet au ramassage : elle rejoint l'inventaire comme une fiole
      // ordinaire (même message, rien ne la trahit) - le poison agit quand on la BOIT.
      item.collected = true;
      player.inventory.vial += 1;
      player.vialQueue.push(true);
      return { kind: "message", text: `${HELD_NAME.vial} : ramassé(e).` };
    case "ring":
      // Piège : on n'annonce PAS l'effet (à découvrir). On l'ajoute à l'inventaire.
      item.collected = true;
      player.inventory.ring += 1;
      player.hasRing = true;
      return { kind: "message", text: "Bague à l'émeraude ramassée." };
    case "leadEagle":
      item.collected = true;
      player.inventory.leadEagle += 1;
      return { kind: "message", text: "Aigle de plomb ramassé." };
    case "eagle":
      item.collected = true;
      player.hasEagle = true;
      // Échange : l'aigle de plomb quitte l'inventaire et prend sa place sur le piédestal.
      player.inventory.leadEagle -= 1;
      room.items.push(new Item(`${item.id}-lead`, "leadEagle", item.col, item.row, 0, "", true));
      player.gold += 5000;
      return { kind: "message", text: "AIGLE D'OR (puissance) !" };
    case "diamond":
      item.collected = true;
      player.hasDiamond = true;
      player.gold += 500;
      return { kind: "message", text: "DIAMANT BLEU (richesse) !" };
    case "book":
      item.collected = true;
      player.hasBook = true;
      if (item.text) player.parchments.push(item.text);
      return { kind: "message", text: "LIVRE SACRE (sagesse) !" };
    default:
      item.collected = true;
      player.inventory[item.kind] += 1;
      if (item.kind === "vial") player.vialQueue.push(false); // saine, dans la file
      return { kind: "message", text: `${HELD_NAME[item.kind]} : ramassé(e).` };
  }
}

/**
 * L : lire. Le Livre Sacré se lit au sol (avant de le ramasser) ; les parchemins, eux,
 * se lisent une fois ramassés - chaque appui affiche le suivant (à la suite).
 */
export function readItem(player: Player, room: Room): InteractResult {
  const book = room.items.find(
    (i) => !i.collected && i.kind === "book" && i.text && i.col === player.col && i.row === player.row,
  );
  if (book) return { kind: "message", text: book.text };

  const n = player.parchments.length;
  if (n > 0) {
    const i = player.parchmentReadIdx % n;
    player.parchmentReadIdx = (i + 1) % n;
    return { kind: "message", text: `${player.parchments[i]}` };
  }
  return { kind: "message", text: "Rien à lire." };
}
