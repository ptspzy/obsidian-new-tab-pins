import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const VERSION = "8.30.1";
const RELEASES = {
  "darwin-arm64": {
    archive: `gitleaks_${VERSION}_darwin_arm64.tar.gz`,
    sha256: "b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5"
  },
  "darwin-x64": {
    archive: `gitleaks_${VERSION}_darwin_x64.tar.gz`,
    sha256: "dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709"
  },
  "linux-arm64": {
    archive: `gitleaks_${VERSION}_linux_arm64.tar.gz`,
    sha256: "e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080"
  },
  "linux-x64": {
    archive: `gitleaks_${VERSION}_linux_x64.tar.gz`,
    sha256: "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb"
  }
};

const target = `${process.platform}-${process.arch}`;
const release = RELEASES[target];

if (!release) {
  console.error(`Gitleaks runner does not support ${target}.`);
  process.exit(2);
}

const cacheDir = path.join(
  os.tmpdir(),
  "new-tab-pins-tools",
  `gitleaks-${VERSION}-${target}`
);
const executable = path.join(cacheDir, "gitleaks");

if (!fs.existsSync(executable)) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const archivePath = path.join(cacheDir, release.archive);
  const url = `https://github.com/gitleaks/gitleaks/releases/download/v${VERSION}/${release.archive}`;
  const response = await fetch(url);

  if (!response.ok) {
    console.error(`Could not download the pinned Gitleaks release (${response.status}).`);
    process.exit(1);
  }

  const archive = Buffer.from(await response.arrayBuffer());
  const digest = crypto.createHash("sha256").update(archive).digest("hex");

  if (digest !== release.sha256) {
    console.error("Gitleaks archive checksum verification failed.");
    process.exit(1);
  }

  fs.writeFileSync(archivePath, archive);
  execFileSync("tar", ["-xzf", archivePath, "-C", cacheDir, "gitleaks"], {
    stdio: "inherit"
  });
  fs.chmodSync(executable, 0o755);
}

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8"
}).trim();

execFileSync(
  executable,
  [
    "git",
    "--log-opts=--all",
    "--redact=100",
    "--no-banner",
    "--no-color",
    root
  ],
  {
    cwd: root,
    stdio: "inherit"
  }
);
