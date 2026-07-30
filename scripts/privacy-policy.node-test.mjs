import assert from "node:assert/strict";
import test from "node:test";
import {
  extractIdentityEmail,
  isApprovedEmail,
  scanFile,
  scanText,
  sha256,
  validateTrackedPath
} from "./privacy-policy.mjs";

const approvedEmail = ["public", "example.com"].join("@");
const privateEmail = ["private", "example.net"].join("@");
const config = {
  version: 1,
  approvedEmailSha256: [sha256(approvedEmail)],
  approvedImages: {
    "assets/approved.png": sha256(Buffer.from("approved-image"))
  },
  allowedUrlHosts: ["example.com", "github.com", "registry.npmjs.org"],
  allowedObsidianVaultNames: ["Dev"]
};

test("allows explicitly approved and GitHub noreply emails", () => {
  assert.equal(isApprovedEmail(approvedEmail, config), true);
  assert.equal(isApprovedEmail("123+user@users.noreply.github.com", config), true);
  assert.equal(isApprovedEmail(["private", "example.com"].join("@"), config), false);
});

test("extracts the effective Git author email", () => {
  const identity = `Public User <${approvedEmail}> 1760000000 +0800`;
  assert.equal(extractIdentityEmail(identity), approvedEmail);
  assert.equal(extractIdentityEmail("not-an-identity"), "");
});

test("blocks local paths without echoing the sensitive value", () => {
  const sensitive = ["/", "Users", "private-user", "Secret Vault", "file.md"].join("/");
  const findings = scanText("notes.txt", sensitive, config);
  assert.equal(findings.some((item) => item.category === "macos-user-path"), true);
  assert.equal(JSON.stringify(findings).includes(sensitive), false);
});

test("blocks unapproved emails and URL hosts", () => {
  const findings = scanText(
    "notes.txt",
    `${privateEmail} ${["https://", "internal.example.net/path"].join("")}`,
    config
  );
  assert.equal(findings.some((item) => item.category === "unapproved-email"), true);
  assert.equal(findings.some((item) => item.category === "unapproved-url-host"), true);
});

test("blocks credential-shaped values and sensitive URL queries", () => {
  const findings = scanText(
    "notes.txt",
    [
      "api_",
      "key = \"1234567890-secret\" ",
      "https://",
      "example.com/?",
      "token=redacted"
    ].join(""),
    config
  );
  assert.equal(
    findings.some((item) => item.category === "credential-assignment"),
    true
  );
  assert.equal(
    findings.some((item) => item.category === "sensitive-url-query"),
    true
  );
});

test("allows approved public URLs and synthetic Obsidian vault names", () => {
  assert.deepEqual(
    scanText(
      "notes.txt",
      [
        "https://",
        "github.com/example/repo ",
        "obsidian://",
        "open?vault=Dev&file=Plan.md"
      ].join(""),
      config
    ),
    []
  );
});

test("blocks unapproved Obsidian vault names", () => {
  const findings = scanText(
    "notes.txt",
    ["obsidian://", "open?vault=PrivateVault&file=Plan.md"].join(""),
    config
  );
  assert.equal(
    findings.some((item) => item.category === "unapproved-obsidian-vault"),
    true
  );
});

test("requires manual approval for new or changed images", () => {
  const approved = scanFile(
    "assets/approved.png",
    Buffer.from("approved-image"),
    config
  );
  const changed = scanFile(
    "assets/approved.png",
    Buffer.from("changed-image"),
    config
  );
  const newImage = scanFile(
    "assets/new.png",
    Buffer.from("new-image"),
    config
  );

  assert.deepEqual(approved, []);
  assert.equal(
    changed.some((item) => item.category === "approved-image-hash-changed"),
    true
  );
  assert.equal(
    newImage.some((item) => item.category === "image-needs-manual-approval"),
    true
  );
});

test("blocks common sensitive filenames", () => {
  assert.equal(validateTrackedPath(".env").length > 0, true);
  assert.equal(validateTrackedPath("credentials.json").length > 0, true);
  assert.equal(
    validateTrackedPath(".obsidian/plugins/new-tab-pins/data.json").length > 0,
    true
  );
  assert.deepEqual(validateTrackedPath(".env.example"), []);
});
