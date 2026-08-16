/**
 * L'INSPECTEUR : les propriétés de la salle, et celles de l'élément sélectionné.
 *
 * Il ne connaît aucun type du format : il lit les tables de `fields.ts` et engendre
 * le formulaire. Les seules choses écrites à la main sont celles qui touchent à
 * PLUSIEURS salles à la fois - renommer une salle (il faut suivre toutes les portes
 * qui la visent), la supprimer, ou refermer un passage des deux côtés.
 */

import type { RoomId } from "../types";
import type { RoomDef } from "../world/rooms";
import {
  applyShape, disconnect, facingDoorIndex, resizeRoom, roomSize, rotateRoom,
  shapeOf, SHAPES, type ShapeId,
} from "./doors";
import { FIELDS, LIST_NAME, getPath, setPath, type Field } from "./fields";
import type { ListKey, Store } from "./store";

/** Familles d'éléments qui ne se posent pas sur la grille : elles s'ajoutent ici. */
const WALL_LISTS: ListKey[] = ["torches", "decors"];

export class Inspector {
  constructor(
    private readonly root: HTMLElement,
    private readonly store: Store,
    private readonly report: (message: string) => void,
  ) {}

  render(): void {
    const room = this.store.room;
    this.root.textContent = "";

    // L'élément sélectionné d'abord : c'est ce qu'on vient de désigner, donc ce
    // qu'on veut régler. Les propriétés de la salle suivent.
    const { list, index } = this.store.sel;
    if (list) this.root.append(this.elementGroup(room, list, index));
    if (room.climbTile) this.root.append(this.singleGroup(room, "climbTile"));
    if (room.holeTile) this.root.append(this.singleGroup(room, "holeTile"));

    this.root.append(this.roomGroup(room));
    for (const wallList of WALL_LISTS) this.root.append(this.wallGroup(room, wallList));
  }

  // ── La salle ────────────────────────────────────────────────────────────

  private roomGroup(room: RoomDef): HTMLElement {
    const castle = this.store.castle;
    const { cols, rows } = roomSize(room);
    const group = section(`Salle ${room.id}`);

    group.append(
      textInput("Identifiant", room.id, (value) => this.renameRoom(room.id, value)),
      textInput("Nom", room.name, (value) => this.setRoom(room.id, (r) => (r.name = value))),
    );

    // Gabarit : appliquer une forme réécrit le plan de sol d'un coup, et remet les
    // portes en place. C'est aussi la sortie de secours d'une salle creusée à la
    // main, dont on ne pourrait plus régler la profondeur autrement.
    const shape = shapeOf(room);
    group.append(
      selectInput(
        "Forme",
        shape ?? "",
        [
          ...(shape ? [] : [{ value: "", label: "— creusée à la main —" }]),
          ...SHAPES.map((s) => ({ value: s.id, label: s.label })),
        ],
        (value) => value && this.setShape(room.id, value as ShapeId),
      ),
      numberInput("Colonnes", cols, (value) => this.resize(room.id, value ?? cols, rows)),
    );
    // La profondeur d'une forme libre est celle de son layout : elle se règle par
    // le gabarit ou à l'outil « Sol », pas par un champ.
    if (room.layout) group.append(readonlyRow("Rangées", `${rows} (fixé par la forme)`));
    else group.append(numberInput("Rangées", rows, (value) => this.resize(room.id, cols, value ?? rows)));

    for (const [key, label] of [
      ["round", "Salle ronde"], ["oubliette", "Oubliette"], ["donjon", "Donjon"],
      ["ceilingExit", "Sortie plafond"],
    ] as const) {
      group.append(
        checkboxInput(label, room[key] === true, (on) =>
          this.setRoom(room.id, (r) => (on ? ((r as any)[key] = true) : delete (r as any)[key])),
        ),
      );
    }

    group.append(
      readonlyRow("Rôle", [
        castle.start === room.id ? "départ" : "",
        castle.oubliette === room.id ? "oubliette du château" : "",
      ].filter(Boolean).join(", ") || "—"),
    );

    const turn = document.createElement("div");
    turn.className = "row-actions";
    turn.append(
      button("↺ Tourner", () => this.rotate(room.id, -1), "Un quart de tour vers la gauche"),
      button("Tourner ↻", () => this.rotate(room.id, +1), "Un quart de tour vers la droite"),
    );
    group.append(turn);
    // L'entrée est la référence du plan (`orientations()` la fixe au nord) : la
    // tourner ne la fait pas pivoter, cela oriente tout le reste autour d'elle.
    if (castle.start === room.id)
      group.append(readonlyRow("", "l'entrée est la référence du plan : la tourner oriente ses voisines"));

    const actions = document.createElement("div");
    actions.className = "row-actions";
    actions.append(
      button("Salle de départ", () => this.store.edit((c) => (c.start = room.id))),
      button("Salle-oubliette", () => this.store.edit((c) => (c.oubliette = room.id))),
      button("Supprimer", () => this.deleteRoom(room.id)),
    );
    group.append(actions);
    return group;
  }

  /** Tourne la salle : ses portes changent de mur, les portes d'en face suivent. */
  private rotate(id: RoomId, quarter: number): void {
    const refusal = this.store.tryEdit((castle) => rotateRoom(castle, id, quarter));
    if (refusal) this.report(refusal);
  }

  private resize(id: RoomId, cols: number, rows: number): void {
    const refusal = this.store.tryEdit((castle) => resizeRoom(castle, id, cols, rows));
    if (refusal) this.report(refusal);
  }

  private setShape(id: RoomId, shape: ShapeId): void {
    const refusal = this.store.tryEdit((castle) => applyShape(castle, id, shape));
    if (refusal) this.report(refusal);
  }

  /**
   * Renommer une salle, c'est renommer sa clé ET tout ce qui la vise : les portes,
   * les cheminées secrètes, les dalles étoile, les trous, et les deux repères du
   * château. Sans quoi le château se disloque en silence.
   */
  private renameRoom(from: RoomId, to: RoomId): void {
    if (!to || to === from) return;
    const refusal = this.store.tryEdit((castle) => {
      if (castle.rooms[to]) return `« ${to} » existe déjà.`;
      const room = castle.rooms[from];
      delete castle.rooms[from];
      room.id = to;
      castle.rooms[to] = room;

      for (const other of Object.values(castle.rooms)) {
        for (const door of other.doors) if (door.target === from) door.target = to;
        for (const fireplace of other.fireplaces ?? []) if (fireplace.target === from) fireplace.target = to;
        if (other.climbTile?.target === from) other.climbTile.target = to;
        if (other.holeTile?.target === from) other.holeTile.target = to;
      }
      if (castle.start === from) castle.start = to;
      if (castle.oubliette === from) castle.oubliette = to;
      return null;
    });
    if (refusal) this.report(refusal);
    else this.store.select(to);
  }

  /** Supprime la salle, et avec elle toutes les portes qui y menaient. */
  private deleteRoom(id: RoomId): void {
    const refusal = this.store.tryEdit((castle) => {
      if (Object.keys(castle.rooms).length <= 1) return "Un château a besoin d'au moins une salle.";
      if (castle.start === id) return "La salle de départ ne se supprime pas : désignez-en une autre d'abord.";
      delete castle.rooms[id];
      for (const room of Object.values(castle.rooms)) {
        room.doors = room.doors.filter((d) => d.target !== id);
        if (room.fireplaces) room.fireplaces = room.fireplaces.filter((f) => f.target !== id);
        if (room.climbTile?.target === id) delete room.climbTile;
        if (room.holeTile?.target === id) delete room.holeTile;
      }
      return null;
    });
    if (refusal) this.report(refusal);
    else this.store.select(this.store.castle.start);
  }

  private setRoom(id: RoomId, change: (room: RoomDef) => void): void {
    this.store.edit((castle) => change(castle.rooms[id]));
  }

  // ── Torches et décors muraux ────────────────────────────────────────────

  private wallGroup(room: RoomDef, list: ListKey): HTMLElement {
    const group = section(list === "torches" ? "Torches" : "Décors muraux");
    const elements = (room[list] as any[]) ?? (list === "torches" ? [{ side: "left" }, { side: "right" }] : []);

    if (list === "torches" && !room.torches) {
      group.append(readonlyRow("", "défaut : deux torches allumées"));
    }
    elements.forEach((element, index) => {
      const label = list === "torches"
        ? `${element.side === "left" ? "gauche" : "droite"} · ${element.lit ?? true ? "allumée" : "éteinte"}`
        : `${element.kind}${element.col != null ? ` · col ${element.col}` : ""}`;
      const row = document.createElement("div");
      row.className = "row-actions";
      row.append(
        button(label, () => {
          this.materialiseTorches(room.id, list);
          this.store.select(room.id, list, index);
        }),
        button("✕", () => {
          this.materialiseTorches(room.id, list);
          this.removeElement(room.id, list, index);
        }),
      );
      group.append(row);
    });

    const add = document.createElement("div");
    add.className = "row-actions";
    add.append(button("+ ajouter", () => this.addWallElement(room.id, list)));
    if (list === "torches" && room.torches) {
      add.append(button("salle noire", () => this.setRoom(room.id, (r) => (r.torches = []))));
      add.append(button("défaut", () => this.setRoom(room.id, (r) => delete r.torches)));
    }
    group.append(add);
    return group;
  }

  /**
   * Les deux torches allumées par défaut n'existent PAS dans la donnée : la salle
   * omet simplement le champ, et l'inspecteur les affiche pour mémoire. Avant d'en
   * retirer une ou de l'éteindre, il faut donc les y inscrire - sans quoi on
   * modifierait un tableau qui n'est pas là, et il ne se passerait rien.
   */
  private materialiseTorches(id: RoomId, list: ListKey): void {
    if (list !== "torches" || this.store.castle.rooms[id].torches) return;
    this.store.edit((castle) => {
      castle.rooms[id].torches = [{ side: "left", lit: true }, { side: "right", lit: true }];
    });
  }

  private addWallElement(id: RoomId, list: ListKey): void {
    this.store.edit((castle) => {
      const room = castle.rooms[id] as any;
      // Ajouter une torche à une salle qui n'en déclare pas : on part du défaut.
      if (list === "torches" && !room.torches) room.torches = [{ side: "left" }, { side: "right" }];
      (room[list] ??= []).push(list === "torches" ? { side: "right", lit: true } : { kind: "ecusson", col: 8 });
    });
  }

  // ── L'élément sélectionné ───────────────────────────────────────────────

  private elementGroup(room: RoomDef, list: ListKey, index: number): HTMLElement {
    const element = (room[list] as any[])?.[index];
    const group = section(`${LIST_NAME[list]} ${index + 1}`);
    if (!element) {
      group.append(readonlyRow("", "élément disparu"));
      return group;
    }

    for (const field of FIELDS[list]) {
      group.append(this.fieldRow(field, element, (change) =>
        this.store.edit((castle) => change((castle.rooms[room.id] as any)[list][index])),
      ));
    }

    const actions = document.createElement("div");
    actions.className = "row-actions";
    if (list === "doors") {
      actions.append(
        button("Appliquer à la porte d'en face", () => this.mirrorDoor(room.id, index)),
        button("Sens unique", () => this.makeOneWay(room.id, index)),
      );
    }
    actions.append(button("Supprimer", () => this.removeElement(room.id, list, index)));
    group.append(actions);
    return group;
  }

  /** `climbTile` / `holeTile` : un seul par salle, donc pas de rang. */
  private singleGroup(room: RoomDef, key: "climbTile" | "holeTile"): HTMLElement {
    const group = section(LIST_NAME[key]);
    const element = room[key]!;
    for (const field of FIELDS[key]) {
      group.append(this.fieldRow(field, element, (change) =>
        this.store.edit((castle) => change((castle.rooms[room.id] as any)[key])),
      ));
    }
    const actions = document.createElement("div");
    actions.className = "row-actions";
    actions.append(button("Supprimer", () => this.setRoom(room.id, (r) => delete r[key])));
    group.append(actions);
    return group;
  }

  /** Recopie l'aspect d'une porte sur sa jumelle : c'est le cas courant. */
  private mirrorDoor(id: RoomId, index: number): void {
    const refusal = this.store.tryEdit((castle) => {
      const door = castle.rooms[id].doors[index];
      const twin = facingDoorIndex(castle, id, door);
      if (twin < 0) return "Cette porte n'a pas de jumelle : le passage est à sens unique.";
      const other = castle.rooms[door.target].doors[twin];
      for (const key of ["lock", "arch", "grille"] as const) {
        if (door[key] === undefined) delete (other as any)[key];
        else (other as any)[key] = door[key];
      }
      return null;
    });
    if (refusal) this.report(refusal);
  }

  /** Barre la porte d'en face : elle reste visible, mais ne s'ouvre plus de ce côté. */
  private makeOneWay(id: RoomId, index: number): void {
    const refusal = this.store.tryEdit((castle) => {
      const door = castle.rooms[id].doors[index];
      const twin = facingDoorIndex(castle, id, door);
      if (twin < 0) return "Cette porte n'a pas de jumelle.";
      castle.rooms[door.target].doors[twin].barred = true;
      return null;
    });
    if (refusal) this.report(refusal);
  }

  private removeElement(id: RoomId, list: ListKey, index: number): void {
    // Une porte se retire des DEUX côtés : sinon on laisse un spawn dans le vide.
    if (list === "doors") this.store.edit((castle) => disconnect(castle, id, index));
    else this.store.edit((castle) => (castle.rooms[id] as any)[list].splice(index, 1));
    this.store.select(id);
  }

  // ── Fabrique de lignes ──────────────────────────────────────────────────

  private fieldRow(field: Field, element: any, apply: (change: (target: any) => void) => void): HTMLElement {
    const value = getPath(element, field.key);
    const write = (v: unknown) => apply((target) => setPath(target, field.key, v));

    if (field.type === "checkbox") {
      return checkboxInput(field.label, value === true, (on) => write(on ? true : field.opt ? undefined : false));
    }
    if (field.type === "select") {
      const options = field.rooms
        ? [{ value: "", label: "—" }, ...this.roomOptions()]
        : field.options ?? [];
      return selectInput(field.label, String(value ?? ""), options, (v) =>
        write(v === "" ? (field.opt ? undefined : "") : v),
      );
    }
    if (field.type === "number") {
      return numberInput(field.label, value as number | undefined, (v) =>
        write(v === undefined ? (field.opt ? undefined : value) : v),
      );
    }
    return textInput(field.label, String(value ?? ""), (v) =>
      write(v === "" ? (field.opt ? undefined : value) : v),
    );
  }

  private roomOptions(): { value: string; label: string }[] {
    const rooms = Object.values(this.store.castle.rooms).map((r) => ({
      value: r.id,
      label: r.name && r.name !== r.id ? `${r.id} — ${r.name}` : r.id,
    }));
    return [...rooms, { value: "__exit__", label: "__exit__ (sortie du château)" }];
  }
}

// ── Petits éléments de formulaire ─────────────────────────────────────────

function section(title: string): HTMLElement {
  const group = document.createElement("div");
  group.className = "group";
  const heading = document.createElement("h3");
  heading.textContent = title;
  group.append(heading);
  return group;
}

function row(label: string): { row: HTMLLabelElement } {
  const element = document.createElement("label");
  const span = document.createElement("span");
  span.textContent = label;
  element.append(span);
  return { row: element };
}

function readonlyRow(label: string, text: string): HTMLElement {
  const { row: element } = row(label);
  const value = document.createElement("span");
  value.textContent = text;
  element.append(value);
  return element;
}

function textInput(label: string, value: string, onChange: (value: string) => void): HTMLElement {
  const { row: element } = row(label);
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.addEventListener("change", () => onChange(input.value));
  element.append(input);
  return element;
}

function numberInput(label: string, value: number | undefined, onChange: (value: number | undefined) => void): HTMLElement {
  const { row: element } = row(label);
  const input = document.createElement("input");
  input.type = "number";
  input.value = value == null ? "" : String(value);
  input.addEventListener("change", () => {
    const raw = input.value.trim();
    onChange(raw === "" ? undefined : Number(raw));
  });
  element.append(input);
  return element;
}

function checkboxInput(label: string, checked: boolean, onChange: (on: boolean) => void): HTMLElement {
  const { row: element } = row(label);
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  element.append(input);
  return element;
}

function selectInput(
  label: string,
  value: string,
  options: readonly { value: string; label: string }[],
  onChange: (value: string) => void,
): HTMLElement {
  const { row: element } = row(label);
  const select = document.createElement("select");
  for (const option of options) {
    const node = document.createElement("option");
    node.value = option.value;
    node.textContent = option.label;
    select.append(node);
  }
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  element.append(select);
  return element;
}

function button(label: string, onClick: () => void, title?: string): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  if (title) element.title = title;
  element.addEventListener("click", onClick);
  return element;
}
