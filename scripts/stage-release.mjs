import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const outDir = path.join(root, "dist");
const assets = ["manifest.json", "main.js", "styles.css"];

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const asset of assets) {
  fs.copyFileSync(path.join(root, asset), path.join(outDir, asset));
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
console.log(`Staged New Tab Pins ${manifest.version} release assets in dist/.`);
