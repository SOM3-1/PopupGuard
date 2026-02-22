import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const source = resolve(root, "public", "manifest.firefox.json");
const target = resolve(root, "dist", "manifest.json");

await copyFile(source, target);
console.log("Firefox manifest copied to dist/manifest.json");
