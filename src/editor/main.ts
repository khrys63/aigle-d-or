/**
 * L'ÉDITEUR DE CHÂTEAU - point d'entrée.
 *
 * Il partage les données et la déduction du plan avec le jeu (`world/rooms.ts`,
 * `world/mapLayout.ts`, `world/loadCastle.ts`) : ce qu'on voit ici est ce que le
 * joueur verra. L'inverse est interdit - rien dans `src/editor/` ne doit être
 * importé par le jeu, sans quoi l'éditeur entrerait dans son bundle et sa contrainte
 * de taille (128 ko, la RAM d'un TO9).
 */

import "./style.css";
import type { CastleDef } from "../world/rooms";
import { RONCEVAL_CASTLE } from "../world/ronceval";
import { parseCastle } from "../world/loadCastle";
import { makeExitDoor, makeRoom } from "./doors";
import { download, fileName, openFile, toJSON } from "./io";
import { Inspector } from "./inspector";
import { PlanView } from "./planView";
import { RoomView, TOOLS, type Tool } from "./roomView";
import { Store } from "./store";
import { validate, type Check } from "./validate";

const $ = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Élément #${id} introuvable`);
  return element as T;
};

const store = new Store();
// Le château livré est le point de départ, mais l'éditeur travaille sur une
// copie : on ne veut pas muter la constante que le jeu embarque.
store.load(structuredClone(RONCEVAL_CASTLE), "ronceval");

let notice = "";
const report = (message: string): void => {
  notice = message;
  renderChecks();
};

const planView = new PlanView($<HTMLCanvasElement>("plan"), store, report);
const roomView = new RoomView($<HTMLCanvasElement>("room"), store, report);
const inspector = new Inspector($("inspector"), store, report);

// ── Palette d'outils ────────────────────────────────────────────────────────

const palette = $("palette");
for (const { tool, label } of TOOLS) {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  element.dataset.tool = tool;
  element.addEventListener("click", () => {
    roomView.tool = tool as Tool;
    renderAll();
  });
  palette.append(element);
}

// ── Barre d'outils ──────────────────────────────────────────────────────────

$("btn-original").addEventListener("click", () => {
  if (!confirmDiscard()) return;
  store.load(structuredClone(RONCEVAL_CASTLE), "ronceval");
});

$("btn-new").addEventListener("click", () => {
  if (!confirmDiscard()) return;
  store.load(emptyCastle(), "mon-chateau");
});

$("btn-open").addEventListener("click", () => {
  openFile((text, name) => {
    const castle = parseCastle(text);
    if (!castle) return report("Ce fichier n'est pas un château lisible.");
    store.load(castle, name);
    report(`« ${name} » chargé.`);
  });
});

$("btn-export").addEventListener("click", () => {
  const blocking = validate(store.castle).filter((c) => c.level === "error");
  if (blocking.length && !confirm(`${blocking.length} erreur(s) : le jeu risque de ne pas s'y retrouver.\n\nExporter quand même ?`))
    return;
  download(toJSON(store.castle, store.name), fileName(store.name));
  store.dirty = false;
  report(`Exporté : ${fileName(store.name)} - chargez-le dans le jeu par « 3 – Charger un château ».`);
});

$("level-up").addEventListener("click", () => changeLevel(+1));
$("level-down").addEventListener("click", () => changeLevel(-1));

addEventListener("keydown", (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
  e.preventDefault();
  if (e.shiftKey) store.redo();
  else store.undo();
});

addEventListener("beforeunload", (e) => {
  if (store.dirty) e.preventDefault();
});

/** Château minimal mais JOUABLE : une salle, sa porte principale, une oubliette. */
function emptyCastle(): CastleDef {
  const entree = makeRoom("entree", "Entrée");
  entree.doors.push(makeExitDoor(entree));
  const oubliette = makeRoom("oubliette", "Oubliette");
  oubliette.rows = 2;
  oubliette.oubliette = true;
  oubliette.ceilingExit = true;
  return {
    rooms: { entree, oubliette },
    start: "entree",
    spawn: { col: 8, row: 0 },
    oubliette: "oubliette",
  };
}

function confirmDiscard(): boolean {
  return !store.dirty || confirm("Le château en cours n'est pas exporté. Continuer ?");
}

function changeLevel(step: number): void {
  const levels = planView.levels;
  const at = levels.indexOf(store.level);
  // `map.levels` est trié du plus haut au plus bas : monter, c'est reculer d'un cran.
  const next = levels[at - step];
  if (next !== undefined) {
    store.level = next;
    store.emit();
  }
}

// ── Rendu ───────────────────────────────────────────────────────────────────

function renderChecks(): void {
  const checks = validate(store.castle);
  const errors = checks.filter((c) => c.level === "error").length;
  const warnings = checks.length - errors;

  $("counts").innerHTML = `<span class="err">⛔ ${errors}</span> · <span class="warn">⚠ ${warnings}</span>`;
  $<HTMLButtonElement>("btn-export").classList.toggle("on", errors === 0);

  const list = $("checks");
  list.textContent = "";
  if (notice) {
    const item = document.createElement("li");
    item.className = "ok";
    item.textContent = notice;
    list.append(item);
  }
  if (!checks.length) {
    const item = document.createElement("li");
    item.className = "ok";
    item.textContent = "Rien à signaler : le château est conforme.";
    list.append(item);
    return;
  }
  // Les erreurs d'abord : ce sont elles qui bloquent l'export.
  const ordered = [...checks].sort((a, b) => (a.level === b.level ? 0 : a.level === "error" ? -1 : 1));
  for (const check of ordered) list.append(checkRow(check));
}

function checkRow(check: Check): HTMLElement {
  const item = document.createElement("li");
  if (check.level === "warn") item.className = "warn";
  const tag = document.createElement("span");
  tag.className = "tag";
  tag.textContent = check.level === "error" ? "erreur" : "avert.";
  const where = document.createElement("span");
  where.className = "where";
  where.textContent = check.room ? `${check.room} · ` : "";
  item.append(tag, where, document.createTextNode(check.message));
  if (check.room) {
    item.addEventListener("click", () => {
      notice = "";
      store.select(check.room!, check.list ?? null, check.index ?? 0);
    });
  }
  return item;
}

/** Les salles que le plan ne montre pas (les oubliettes) : sans cela, inatteignables. */
function renderOffPlan(): void {
  const root = $("offplan");
  root.textContent = "";
  const ids = planView.offPlanRooms();
  if (!ids.length) return;

  const label = document.createElement("span");
  label.className = "hint";
  label.textContent = "Hors plan :";
  root.append(label);

  for (const id of ids) {
    const room = store.castle.rooms[id];
    const element = document.createElement("button");
    element.type = "button";
    element.textContent = id;
    element.title = `${room.name} - salle où l'on tombe, absente du plan`;
    element.classList.toggle("on", store.sel.room === id);
    element.addEventListener("click", () => store.select(id));
    root.append(element);
  }
}

function renderAll(): void {
  planView.render();
  roomView.render();
  inspector.render();
  renderChecks();
  renderOffPlan();

  const room = store.room;
  $("room-title").textContent = `${room.id} — ${room.name}`;
  $("level-label").textContent = planView.levelLabel();
  for (const element of palette.querySelectorAll("button"))
    element.classList.toggle("on", (element as HTMLButtonElement).dataset.tool === roomView.tool);
}

store.subscribe(() => {
  notice = "";
  renderAll();
});
addEventListener("resize", renderAll);
renderAll();
