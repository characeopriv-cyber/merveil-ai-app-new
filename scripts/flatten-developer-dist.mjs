import { copyFileSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const dist = resolve(root, "dist");
const nested = resolve(dist, "public/developer");
const sourceIndex = resolve(nested, "index.html");
const targetIndex = resolve(dist, "index.html");

if (!existsSync(sourceIndex)) {
  throw new Error(`Developer build output not found: ${sourceIndex}`);
}

copyFileSync(sourceIndex, targetIndex);
rmSync(resolve(dist, "public"), { recursive: true, force: true });

console.log(`Flattened Developer Platform entry to ${targetIndex}`);
