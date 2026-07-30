import crypto from "node:crypto";

const IMAGE_EXTENSIONS = new Set([
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp"
]);

const MAX_REVIEWED_FILE_BYTES = 5 * 1024 * 1024;

const SECRET_PATTERNS = [
  {
    category: "private-key",
    pattern: /-----BEGIN (?:RSA|OPENSSH|EC|DSA|PGP) PRIVATE KEY-----/g
  },
  {
    category: "github-token",
    pattern: /\b(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{20,}\b/g
  },
  {
    category: "openai-style-key",
    pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g
  },
  {
    category: "aws-access-key",
    pattern: /\bAKIA[0-9A-Z]{16}\b/g
  },
  {
    category: "google-api-key",
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g
  },
  {
    category: "slack-token",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g
  },
  {
    category: "stripe-key",
    pattern: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g
  },
  {
    category: "jwt",
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g
  },
  {
    category: "credential-in-url",
    pattern: /https?:\/\/[^/\s:@]+:[^@\s/]+@/g
  },
  {
    category: "credential-assignment",
    pattern:
      /\b(?:password|passwd|client_secret|access_token|auth_token|api_key)\s*[:=]\s*["'][^"'\r\n]{8,}["']/gi
  }
];

const LOCAL_PATH_PATTERNS = [
  {
    category: "macos-user-path",
    pattern: /\/Users\/[^/\s]+(?:\/|$)/g
  },
  {
    category: "linux-user-path",
    pattern: /\/home\/[^/\s]+(?:\/|$)/g
  },
  {
    category: "windows-user-path",
    pattern: /[A-Za-z]:\\Users\\[^\\\r\n]+(?:\\|$)/g
  },
  {
    category: "icloud-path",
    pattern: new RegExp(
      ["Library\\/Mobile Documents", "iCloud" + "~[A-Za-z0-9~_-]*"].join("|"),
      "g"
    )
  },
  {
    category: "file-uri",
    pattern: /file:\/\/[^\s<>"')]+/g
  }
];

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const URL_PATTERN = /https?:\/\/[^\s<>"')]+/gi;
const OBSIDIAN_URI_PATTERN = /obsidian:\/\/[^\s<>"')]+/gi;
const SENSITIVE_QUERY_NAMES = new Set([
  "access_token",
  "api_key",
  "auth",
  "key",
  "password",
  "secret",
  "sig",
  "signature",
  "token"
]);

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function validatePolicyConfig(config) {
  const errors = [];

  if (!config || config.version !== 1) {
    errors.push("privacy-allowlist.json must use policy version 1.");
  }

  for (const field of [
    "approvedEmailSha256",
    "allowedUrlHosts",
    "allowedObsidianVaultNames"
  ]) {
    if (!Array.isArray(config?.[field])) {
      errors.push(`privacy-allowlist.json ${field} must be an array.`);
    }
  }

  if (
    !config?.approvedImages ||
    typeof config.approvedImages !== "object" ||
    Array.isArray(config.approvedImages)
  ) {
    errors.push("privacy-allowlist.json approvedImages must be an object.");
  }

  return errors;
}

export function isApprovedEmail(email, config) {
  const normalized = email.trim().replace(/^<|>$/g, "").toLowerCase();

  if (
    normalized === "noreply@github.com" ||
    /^\d+\+[^@]+@users\.noreply\.github\.com$/i.test(normalized)
  ) {
    return true;
  }

  return config.approvedEmailSha256.includes(sha256(normalized));
}

export function extractIdentityEmail(identity) {
  return identity.match(/<([^<>\r\n]+)>\s+\d+\s+[+-]\d{4}$/)?.[1] ?? "";
}

export function validateTrackedPath(filePath) {
  const normalized = filePath.replaceAll("\\", "/");
  const lower = normalized.toLowerCase();
  const findings = [];

  if (
    /(^|\/)\.env(?:\.|$)/i.test(normalized) &&
    !/(^|\/)\.env\.example$/i.test(normalized)
  ) {
    findings.push(createFinding(filePath, "sensitive-file-name"));
  }

  if (
    /(^|\/)\.npmrc$/i.test(normalized) ||
    /\.(?:key|mobileprovision|p12|pem|pfx)$/i.test(normalized) ||
    /(^|\/)(?:credentials?|secrets?)(?:[./]|$)/i.test(normalized) ||
    /(^|\/)\.obsidian(?:\/|$)/i.test(normalized) ||
    /(^|\/)data\.json$/i.test(normalized)
  ) {
    findings.push(createFinding(filePath, "sensitive-file-name"));
  }

  if (lower.includes("library/mobile documents") || lower.includes("icloud~")) {
    findings.push(createFinding(filePath, "private-path-name"));
  }

  return findings;
}

export function scanText(filePath, text, config) {
  const findings = [];

  for (const { category, pattern } of [...SECRET_PATTERNS, ...LOCAL_PATH_PATTERNS]) {
    for (const match of text.matchAll(pattern)) {
      findings.push(
        createFinding(filePath, category, text, match.index, match[0])
      );
    }
  }

  for (const match of text.matchAll(EMAIL_PATTERN)) {
    if (!isApprovedEmail(match[0], config)) {
      findings.push(
        createFinding(filePath, "unapproved-email", text, match.index, match[0])
      );
    }
  }

  for (const match of text.matchAll(URL_PATTERN)) {
    const rawUrl = match[0].replace(/[),.;]+$/g, "");

    try {
      const url = new URL(rawUrl);
      const hostAllowed = config.allowedUrlHosts.some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`)
      );

      if (!hostAllowed) {
        findings.push(
          createFinding(filePath, "unapproved-url-host", text, match.index, rawUrl)
        );
      }

      if (url.username || url.password) {
        findings.push(
          createFinding(filePath, "credential-in-url", text, match.index, rawUrl)
        );
      }

      for (const name of url.searchParams.keys()) {
        if (SENSITIVE_QUERY_NAMES.has(name.toLowerCase())) {
          findings.push(
            createFinding(
              filePath,
              "sensitive-url-query",
              text,
              match.index,
              `${url.hostname}:${name}`
            )
          );
        }
      }
    } catch {
      findings.push(
        createFinding(filePath, "invalid-url", text, match.index, rawUrl)
      );
    }
  }

  for (const match of text.matchAll(OBSIDIAN_URI_PATTERN)) {
    try {
      const url = new URL(match[0]);
      const vaultName = url.searchParams.get("vault");

      if (vaultName && !config.allowedObsidianVaultNames.includes(vaultName)) {
        findings.push(
          createFinding(
            filePath,
            "unapproved-obsidian-vault",
            text,
            match.index,
            vaultName
          )
        );
      }
    } catch {
      findings.push(
        createFinding(filePath, "invalid-obsidian-uri", text, match.index, match[0])
      );
    }
  }

  return dedupeFindings(findings);
}

export function scanFile(filePath, buffer, config) {
  const findings = [...validateTrackedPath(filePath)];
  const extension = getExtension(filePath);

  if (buffer.length > MAX_REVIEWED_FILE_BYTES) {
    findings.push(createFinding(filePath, "file-too-large-for-automatic-review"));
    return dedupeFindings(findings);
  }

  if (IMAGE_EXTENSIONS.has(extension)) {
    const approvedHash = config.approvedImages[filePath];
    const actualHash = sha256(buffer);

    if (!approvedHash) {
      findings.push(createFinding(filePath, "image-needs-manual-approval"));
      return dedupeFindings(findings);
    }

    if (approvedHash !== actualHash) {
      findings.push(
        createFinding(
          filePath,
          "approved-image-hash-changed",
          undefined,
          undefined,
          actualHash
        )
      );
      return dedupeFindings(findings);
    }

    const printableMetadata = Array.from(
      buffer.toString("latin1").matchAll(/[\x20-\x7e]{6,}/g),
      (match) => match[0]
    ).join("\n");
    findings.push(...scanText(filePath, printableMetadata, config));
    return dedupeFindings(findings);
  }

  if (buffer.includes(0)) {
    findings.push(createFinding(filePath, "unapproved-binary-file"));
    return dedupeFindings(findings);
  }

  findings.push(...scanText(filePath, buffer.toString("utf8"), config));
  return dedupeFindings(findings);
}

export function formatFinding(finding) {
  const location = finding.line
    ? `${finding.file}:${finding.line}`
    : finding.file;
  const fingerprint = finding.fingerprint
    ? ` fingerprint=${finding.fingerprint}`
    : "";
  return `${location} [${finding.category}]${fingerprint}`;
}

function getExtension(filePath) {
  const match = filePath.toLowerCase().match(/\.[^./]+$/);
  return match?.[0] ?? "";
}

function createFinding(
  file,
  category,
  text,
  index,
  sensitiveValue
) {
  return {
    file,
    category,
    line:
      typeof text === "string" && typeof index === "number"
        ? text.slice(0, index).split("\n").length
        : undefined,
    fingerprint: sensitiveValue
      ? sha256(String(sensitiveValue)).slice(0, 12)
      : undefined
  };
}

function dedupeFindings(findings) {
  const seen = new Set();

  return findings.filter((finding) => {
    const key = [
      finding.file,
      finding.category,
      finding.line ?? "",
      finding.fingerprint ?? ""
    ].join(":");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
