import { VIEW_H, VIEW_W } from "./config";
import { Renderer } from "./engine/Renderer";
import { Input } from "./engine/Input";
import { Loop } from "./engine/Loop";
import { Game } from "./engine/Game";

const canvas = document.getElementById("game") as HTMLCanvasElement | null;
if (!canvas) throw new Error("Canvas #game introuvable");

const renderer = new Renderer(canvas, VIEW_W, VIEW_H);
const input = new Input();
const game = new Game(renderer, input);

const loop = new Loop(
  (dt) => game.update(dt),
  () => game.render(),
);
loop.start();
