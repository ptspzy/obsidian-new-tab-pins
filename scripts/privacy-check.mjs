import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import {
  extractIdentityEmail,
  formatFinding,
  isApprovedEmail,
  scanFile,
  validatePolicyConfig
} from "./privacy-policy.mjs";

const modes = new Set(process.argv.slice(2));
const mode = modes.has("--staged") ? "staged" : modes.has("--all") ? "all" : null;

if (!mode || modes.size !== 1) {
  console.error("Usage: node scripts/privacy-check.mjs --staged|--all");
  process.exit(2);
}

let root = process.cwd();
root = gitText(["rev-parse", "--show-toplevel"]);
const configBuffer = readRepositoryFile("privacy-allowlist.json", mode);
let config;

try {
  config = JSON.parse(configBuffer.toString("utf8"));
} catch {
  console.error("Privacy check failed:");
  console.error("- privacy-allowlist.json is missing or invalid JSON.");
  process.exit(1);
}

const configErrors = validatePolicyConfig(config);
if (configErrors.length > 0) {
  console.error("Privacy check failed:");
  for (const error of configErrors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

const files =
  mode === "staged"
    ? gitNullList(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"])
    : gitNullList(["ls-files", "-z"]);
const findings = [];

for (const filePath of files) {
  const fileMode = gitText(["ls-files", "-s", "--", filePath]).split(/\s+/)[0];

  if (fileMode === "120000") {
    findings.push({
      file: filePath,
      category: "tracked-symlink"
    });
    continue;
  }

  const buffer = readRepositoryFile(filePath, mode);
  findings.push(...scanFile(filePath, buffer, config));
}

if (mode === "staged") {
  const authorEmail = extractIdentityEmail(
    gitText(["var", "GIT_AUTHOR_IDENT"], true)
  );

  if (!authorEmail || !isApprovedEmail(authorEmail, config)) {
    findings.push({
      file: "git-author",
      category: authorEmail ? "unapproved-email" : "missing-author-email"
    });
  }
} else {
  const historyEmails = gitText(
    ["log", "--all", "--format=%ae%n%ce"],
    true
  )
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  const taggerEmails = gitText(
    ["for-each-ref", "--format=%(taggeremail)", "refs/tags"],
    true
  )
    .split(/\r?\n/)
    .map((value) => value.trim().replace(/^<|>$/g, ""))
    .filter(Boolean);

  for (const email of new Set([...historyEmails, ...taggerEmails])) {
    if (!isApprovedEmail(email, config)) {
      findings.push({
        file: "git-history",
        category: "unapproved-email"
      });
    }
  }
}

if (findings.length > 0) {
  console.error("Privacy check failed. Sensitive values are redacted:");
  for (const finding of findings) {
    console.error(`- ${formatFinding(finding)}`);
  }
  process.exit(1);
}

console.log(
  `Privacy check passed (${files.length} ${mode === "staged" ? "staged" : "tracked"} files).`
);

function readRepositoryFile(filePath, readMode) {
  if (readMode === "staged") {
    return gitBuffer(["show", `:${filePath}`]);
  }

  return fs.readFileSync(path.join(root, filePath));
}

function gitText(args, allowFailure = false) {
  try {
    return gitBuffer(args).toString("utf8").trim();
  } catch (error) {
    if (allowFailure) {
      return "";
    }
    throw error;
  }
}

function gitNullList(args) {
  return gitBuffer(args)
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
}

function gitBuffer(args) {
  return execFileSync("git", args, {
    cwd: root ?? process.cwd(),
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"]
  });
}
