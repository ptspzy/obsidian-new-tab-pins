import process from "node:process";
import { execFileSync } from "node:child_process";

if (process.env.CI === "true") {
  process.exit(0);
}

try {
  execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
    stdio: "ignore"
  });
} catch {
  process.exit(0);
}

execFileSync("git", ["config", "core.hooksPath", ".githooks"], {
  stdio: "ignore"
});

console.log("Installed New Tab Pins privacy pre-commit hook.");
