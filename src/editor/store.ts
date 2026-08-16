/**
 * État de l'éditeur : le château en cours, la sélection, l'historique.
 *
 * Règle d'or : **toute modification produit un château neuf** (`structuredClone`).
 * `castleMap()` est mémoïsée par IDENTITÉ de l'objet de salles (`mapLayout.ts`) -
 * muter en place lui ferait resservir un plan périmé, sans le moindre signe.
 * Cloner 65 salles (~40 ko) à chaque geste est indolore, et l'historique undo/redo
 * n'est alors qu'une pile de références.
 */

import type { RoomId } from "../types";
import type { CastleDef, RoomDef } from "../world/rooms";
import { RONCEVAL_CASTLE } from "../world/ronceval";

/** Tableaux d'éléments d'une salle : la clé sert d'adresse à la sélection. */
export type ListKey =
  | "doors" | "items" | "guards" | "chests" | "torches" | "traps" | "herses"
  | "decors" | "furnitures" | "skeletons" | "fireplaces" | "bats" | "ghosts";

/** Ce que l'inspecteur affiche : une salle, ou un élément de cette salle. */
export interface Selection {
  room: RoomId;
  /** `null` = la salle elle-même. */
  list: ListKey | null;
  index: number;
}

const MAX_HISTORY = 200;

export class Store {
  castle: CastleDef = RONCEVAL_CASTLE;
  /** Nom du château, proposé comme nom de fichier à l'export. */
  name = "ronceval";
  /** Étage affiché par le plan. */
  level = 0;
  sel: Selection = { room: RONCEVAL_CASTLE.start, list: null, index: 0 };
  /** Modifié depuis le dernier chargement / export. */
  dirty = false;

  private undoStack: CastleDef[] = [];
  private redoStack: CastleDef[] = [];
  private listeners: (() => void)[] = [];

  subscribe(fn: () => void): void {
    this.listeners.push(fn);
  }

  /** Redessine tout : à 65 salles, rien ne justifie un rendu plus fin. */
  emit(): void {
    for (const fn of this.listeners) fn();
  }

  /** La salle sélectionnée (jamais `undefined` : la sélection est recalée au besoin). */
  get room(): RoomDef {
    return this.castle.rooms[this.sel.room] ?? this.castle.rooms[this.castle.start];
  }

  /**
   * Modifie le château : clone, applique, empile pour l'annulation, prévient les vues.
   *
   * La valeur de retour de `change` est **ignorée**, et c'est délibéré : une mutation
   * s'écrit volontiers `(c) => (salle.cols = 20)`, dont la valeur est celle qu'on
   * vient d'affecter. La lire pour y chercher un sens ferait taire la modification.
   * Pour un geste qui peut être refusé, voir `tryEdit`.
   */
  edit(change: (castle: CastleDef) => unknown): void {
    this.commit((castle) => {
      change(castle);
      return null;
    });
  }

  /**
   * Geste qui peut échouer : `change` renvoie un message pour le REFUSER, `null`
   * pour l'accepter. Le clone est alors jeté et l'historique n'est pas touché - un
   * geste impossible ne doit pas occuper un cran d'annulation. Le message revient à
   * l'appelant, qui l'affiche.
   */
  tryEdit(change: (castle: CastleDef) => string | null): string | null {
    return this.commit(change);
  }

  private commit(change: (castle: CastleDef) => string | null): string | null {
    const next = structuredClone(this.castle);
    const refusal = change(next);
    if (refusal) return refusal;

    this.undoStack.push(this.castle);
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
    this.redoStack.length = 0;

    this.castle = next;
    this.dirty = true;
    this.recallSelection();
    this.emit();
    return null;
  }

  /** Sélectionne une salle (et éventuellement un de ses éléments). */
  select(room: RoomId, list: ListKey | null = null, index = 0): void {
    this.sel = { room, list, index };
    this.emit();
  }

  undo(): void {
    const previous = this.undoStack.pop();
    if (!previous) return;
    this.redoStack.push(this.castle);
    this.castle = previous;
    this.recallSelection();
    this.emit();
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(this.castle);
    this.castle = next;
    this.recallSelection();
    this.emit();
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Remplace le château (ouverture d'un fichier, nouveau château). */
  load(castle: CastleDef, name: string): void {
    this.castle = castle;
    this.name = name;
    this.sel = { room: castle.start, list: null, index: 0 };
    this.level = 0;
    this.dirty = false;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.emit();
  }

  /** Après une suppression ou une annulation, la sélection peut pointer dans le vide. */
  private recallSelection(): void {
    const room = this.castle.rooms[this.sel.room];
    if (!room) {
      this.sel = { room: this.castle.start, list: null, index: 0 };
      return;
    }
    if (this.sel.list) {
      const list = room[this.sel.list];
      if (!list || this.sel.index >= list.length) this.sel = { room: this.sel.room, list: null, index: 0 };
    }
  }
}
