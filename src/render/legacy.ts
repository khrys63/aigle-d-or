/**
 * Mode MO5 : le rendu tel que la machine l'imposait en 1985.
 *
 * Ce n'est pas un second moteur de rendu, et ce n'est pas un décalque des écrans
 * d'origine : ce sont les mêmes primitives que le mode couleur, soumises aux deux
 * contraintes du Thomson MO5/TO9 - sa palette matérielle de 16 teintes, et le fait
 * qu'on y dessinait au trait faute de RAM pour des aplats. Le décor devient un
 * contour magenta sur fond noir ; seules les figurines, le feu et l'or gardent leurs
 * couleurs, comme sur la machine.
 *
 * Tout passe par une interception du contexte 2D (voir installLegacyContext) : aucune
 * des ~3 200 lignes de Scene.ts n'a besoin de connaître le mode, y compris les
 * couleurs qui y sont écrites en dur. Scene.ts ne fait qu'activer le mode le temps de
 * la scène et sauter les passes d'ornement (appareil de pierre, pavage, veinures).
 */

import { COLORS } from "../config";

// --- État -------------------------------------------------------------------

/** Préférence utilisateur (touche T). */
let enabled = false;
/** Vrai seulement pendant drawScene : le HUD, la carte et les menus n'y passent pas. */
let active = false;
/** Suspendu le temps d'un fond plein, qui ne doit pas être cerné d'un trait. */
let outlining = true;

export function isLegacy(): boolean {
  return enabled;
}

/** Bascule le mode et renvoie son nouvel état. */
export function toggleLegacy(): boolean {
  enabled = !enabled;
  return enabled;
}

/** Ouvre/ferme la fenêtre pendant laquelle le contexte est remappé. */
export function setLegacyActive(on: boolean): void {
  active = on;
}

/** Remplit sans cerner : pour les fonds pleins (effacement de l'écran). */
export function withoutOutline<T>(fn: () => T): T {
  const prev = outlining;
  outlining = false;
  try {
    return fn();
  } finally {
    outlining = prev;
  }
}

// --- Palette ----------------------------------------------------------------

/**
 * Les 16 couleurs du Thomson MO5. C'est une caractéristique de la machine, pas un
 * choix d'auteur : toute image affichée sur un MO5 y était ramenée.
 */
const MO5 = [
  "#000000", "#f00000", "#00f000", "#f0f000", // noir, rouge, vert, jaune
  "#0000f0", "#f000f0", "#00f0f0", "#f0f0f0", // bleu, magenta, cyan, blanc
  "#808080", "#f08080", "#80f080", "#f0f080", // gris, rose, vert clair, jaune clair
  "#8080f0", "#f080f0", "#80f0f0", "#f0a000", // bleu clair, magenta clair, cyan clair, orangé
];

/** Le trait : magenta, index 5 de la palette. */
export const INK = MO5[5];
/** Le fond : noir, index 0. */
const BG = MO5[0];

/**
 * Les couleurs qui restent des aplats colorés au lieu de devenir du trait, et la
 * teinte MO5 qu'elles prennent : les figurines (héros, gardes), le feu et l'or. Ce
 * sont les seules taches de couleur des salles d'époque, tout le reste y est au trait.
 *
 * La correspondance est écrite à la main plutôt que calculée par distance : la palette
 * du remake est sourde, celle du MO5 est saturée, et le plus proche voisin en RGB
 * ramène au gris tout ce qui est moyennement saturé (un vert de pantalon, par exemple).
 */
const KEEP = new Map<string, string>([
  // Héros - HERO_PAL (Scene.ts).
  [COLORS.hero, MO5[3]],        // or -> jaune
  [COLORS.heroDark, MO5[3]],
  [COLORS.heroHair, MO5[3]],
  [COLORS.heroSkin, MO5[9]],    // chair -> rose
  [COLORS.heroTunic, MO5[4]],   // tunique -> bleu
  [COLORS.heroBelt, MO5[15]],   // ceinture -> orangé
  [COLORS.heroPants, MO5[2]],   // pantalon -> vert
  [COLORS.heroBoots, MO5[1]],   // bottes -> rouge
  ["#ffe79a", MO5[11]],         // HERO_PAL.hairHi -> jaune clair
  // Gardes - GUARD_PAL (Scene.ts) : les gris d'armure, écrits en dur là-bas.
  // #8a93a0 vaut aussi COLORS.grilleBar et COLORS.grapple : les barreaux d'acier et
  // le grappin restent donc gris eux aussi. Le gris est une des 16 teintes du MO5 et
  // l'acier s'en accommode - garder la figurine du garde entière prime.
  ["#9aa3b0", MO5[8]], ["#cdd3dc", MO5[7]], ["#8a93a0", MO5[8]],
  ["#4a4f58", MO5[8]], ["#6a7280", MO5[8]], ["#3a3f48", MO5[8]],
  [COLORS.guard, MO5[1]],
  [COLORS.guardDark, MO5[1]],
  // Feu et or.
  [COLORS.flameOuter, MO5[15]],
  [COLORS.flameInner, MO5[3]],
  [COLORS.treasure, MO5[15]],
  [COLORS.eagle, MO5[3]],
  [COLORS.key, MO5[6]],
  // Contour des figurines : il reste noir, il ne devient pas un trait magenta de plus.
  ["#1a1018", MO5[0]],
  // Le seul texte tracé dans la scène (« Il fait noir ici »).
  [COLORS.textDim, MO5[7]],
]);

/**
 * Vrai si la couleur est partiellement transparente : ombres portées, halo de torche,
 * voile de pénombre. On les laisse passer telles quelles - la pénombre est une
 * mécanique de jeu (les torches), pas un ornement.
 */
function translucent(c: string): boolean {
  const m = /^rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)/.exec(c);
  return m !== null && parseFloat(m[1]) < 1;
}

/** Un remplissage : la teinte d'époque si on la garde, sinon le fond (la forme sera cernée). */
function mapFill(v: unknown): unknown {
  if (typeof v !== "string") return v; // dégradés : laissés au mode couleur
  if (translucent(v)) return v;
  return KEEP.get(v) ?? BG;
}

/** Un trait : la teinte d'époque si on la garde, sinon l'encre magenta. */
function mapStroke(v: unknown): unknown {
  if (typeof v !== "string") return v;
  if (translucent(v)) return v;
  return KEEP.get(v) ?? INK;
}

// --- Interception du contexte 2D --------------------------------------------

/**
 * Détourne fillStyle / strokeStyle / fill() / fillRect() sur l'instance de contexte.
 * Tant que le mode n'est pas actif, chaque accesseur redonne la main au natif : le
 * mode couleur ne paie qu'un appel de fonction.
 *
 * Le remplissage sait ce qu'il devait peindre (la couleur DEMANDÉE, avant remappage) :
 * s'il ne s'agit pas d'une figurine, il repasse sur le même chemin à l'encre. C'est
 * cette bascule-là qui fait passer tout le rendu en fil de fer.
 */
export function installLegacyContext(ctx: CanvasRenderingContext2D): void {
  const proto = Object.getPrototypeOf(ctx) as CanvasRenderingContext2D;
  const fillDesc = Object.getOwnPropertyDescriptor(proto, "fillStyle")!;
  const strokeDesc = Object.getOwnPropertyDescriptor(proto, "strokeStyle")!;
  const nativeFill = proto.fill.bind(ctx);
  const nativeStroke = proto.stroke.bind(ctx);
  const nativeFillRect = proto.fillRect.bind(ctx);
  const nativeStrokeRect = proto.strokeRect.bind(ctx);
  const setFill = (v: unknown): void => fillDesc.set!.call(ctx, v);
  const setStroke = (v: unknown): void => strokeDesc.set!.call(ctx, v);

  /** Dernière couleur demandée pour un remplissage, avant remappage. */
  let wanted: unknown = BG;

  Object.defineProperty(ctx, "fillStyle", {
    get: () => fillDesc.get!.call(ctx),
    set(v: unknown) {
      wanted = v;
      setFill(active ? mapFill(v) : v);
    },
  });

  Object.defineProperty(ctx, "strokeStyle", {
    get: () => strokeDesc.get!.call(ctx),
    set(v: unknown) {
      setStroke(active ? mapStroke(v) : v);
    },
  });

  /** La forme en cours doit-elle être cernée d'un trait plutôt que remplie ? */
  const outlined = (): boolean =>
    active && outlining && typeof wanted === "string" && !KEEP.has(wanted) && !translucent(wanted);

  /** Repasse à l'encre sur ce qui vient d'être rempli, sans perdre le trait courant. */
  const inkOver = (draw: () => void): void => {
    const prev = ctx.lineWidth;
    setStroke(INK);
    ctx.lineWidth = 1;
    draw();
    ctx.lineWidth = prev;
  };

  ctx.fill = function (...args: unknown[]): void {
    (nativeFill as (...a: unknown[]) => void)(...args);
    // Un fill(Path2D) ne laisse pas de chemin courant à repasser : on s'abstient.
    if (!outlined() || typeof args[0] === "object") return;
    inkOver(nativeStroke);
  } as CanvasRenderingContext2D["fill"];

  ctx.fillRect = function (x: number, y: number, w: number, h: number): void {
    nativeFillRect(x, y, w, h);
    if (!outlined()) return;
    inkOver(() => nativeStrokeRect(x, y, w, h));
  };
}
