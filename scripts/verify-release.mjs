import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const errors = [];

function readJson(file) {
  const fullPath = path.join(root, file);

  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    errors.push(`${file} is missing or invalid JSON: ${error.message}`);
    return null;
  }
}

function requireFile(file) {
  const fullPath = path.join(root, file);

  if (!fs.existsSync(fullPath)) {
    errors.push(`${file} is missing.`);
    return;
  }

  const stats = fs.statSync(fullPath);

  if (!stats.isFile() || stats.size === 0) {
    errors.push(`${file} must be a non-empty file.`);
  }
}

const manifest = readJson("manifest.json");
const pkg = readJson("package.json");
const versions = readJson("versions.json");

for (const file of ["README.md", "LICENSE", "manifest.json", "main.js", "styles.css"]) {
  requireFile(file);
}

if (manifest && pkg) {
  if (manifest.version !== pkg.version) {
    errors.push(
      `manifest.json version (${manifest.version}) must match package.json version (${pkg.version}).`
    );
  }

  if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    errors.push("manifest.json version must use x.y.z semantic version format.");
  }

  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(manifest.id)) {
    errors.push("manifest.json id must use lowercase letters, numbers, and hyphens.");
  }

  if (manifest.id.includes("obsidian")) {
    errors.push('manifest.json id must not contain "obsidian".');
  }

  for (const field of ["id", "name", "version", "minAppVersion", "description", "author"]) {
    if (typeof manifest[field] !== "string" || manifest[field].trim() === "") {
      errors.push(`manifest.json ${field} must be a non-empty string.`);
    }
  }

  if (typeof manifest.isDesktopOnly !== "boolean") {
    errors.push("manifest.json isDesktopOnly must be a boolean.");
  }
}

if (manifest && versions) {
  if (versions[manifest.version] !== manifest.minAppVersion) {
    errors.push(
      `versions.json must map ${manifest.version} to minAppVersion ${manifest.minAppVersion}.`
    );
  }
}

const mainPath = path.join(root, "main.js");
if (fs.existsSync(mainPath)) {
  const mainJs = fs.readFileSync(mainPath, "utf8");

  if (!mainJs.includes("Obsidian New Tab Pins")) {
    errors.push("main.js does not look like the bundled plugin output.");
  }

  if (/sourceMappingURL=/.test(mainJs)) {
    errors.push("main.js must be built for production without inline source maps.");
  }
}

if (errors.length > 0) {
  console.error("Release verification failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Release verification passed.");
