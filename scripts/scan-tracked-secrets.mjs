#!/usr/bin/env node

import {
  lstatSync,
  readFileSync
} from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const RULES = Object.freeze([
  {
    label: "Stripe secret or restricted API key",
    pattern: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g
  },
  {
    label: "Stripe webhook signing secret",
    pattern: /\bwhsec_[A-Za-z0-9]{24,}\b/g
  },
  {
    label: "Resend API key",
    pattern: /\bre_[A-Za-z0-9]{24,}\b/g
  },
  {
    label: "GitHub access token",
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/g
  },
  {
    label: "Cloudflare global API key",
    pattern: /\bcfk_[A-Za-z0-9_-]{40,}\b/g
  },
  {
    label: "Cloudflare user API token",
    pattern: /\bcfut_[A-Za-z0-9_-]{40,}\b/g
  },
  {
    label: "Cloudflare account API token",
    pattern: /\bcfat_[A-Za-z0-9_-]{40,}\b/g
  },
  {
    label: "Google OAuth client secret",
    pattern: /\bGOCSPX-[A-Za-z0-9_-]{20,}\b/g
  },
  {
    label: "Google API key",
    pattern: /\bAIza[0-9A-Za-z_-]{30,}\b/g
  },
  {
    label: "Private key material",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g
  }
]);

export function scanTextForTrackedSecrets(text, file = "unknown") {
  const findings = [];
  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    for (const match of text.matchAll(rule.pattern)) {
      findings.push({
        file,
        line: lineNumberAt(text, match.index ?? 0),
        label: rule.label
      });
    }
  }
  return findings;
}

export function scanTrackedRepository(root = process.cwd()) {
  const trackedPaths = listGitPaths(root, ["ls-files", "-z"]);
  const findings = [];
  let scannedFiles = 0;
  for (const relativePath of trackedPaths) {
    const absolutePath = resolve(root, relativePath);
    let stat;
    try {
      stat = lstatSync(absolutePath);
    } catch {
      continue;
    }
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) continue;

    const bytes = readFileSync(absolutePath);
    if (bytes.includes(0)) continue;
    scannedFiles += 1;
    findings.push(...scanTextForTrackedSecrets(
      bytes.toString("utf8"),
      relativePath
    ));
  }
  return { findings, scannedFiles };
}

export function auditRepositorySecrets({
  root = process.cwd(),
  localSecretFiles = [],
  allowedLocalValues = []
} = {}) {
  const tracked = scanTrackedRepository(root);
  const findings = [...tracked.findings];
  const notices = [];
  const trackedPaths = new Set(listGitPaths(root, ["ls-files", "-z"]));
  const allowed = new Set(allowedLocalValues);
  const localSecrets = [];

  for (const localPath of localSecretFiles) {
    const absolutePath = resolve(root, localPath);
    let exists = false;
    try {
      exists = lstatSync(absolutePath).isFile();
    } catch {
      // Missing local files are valid in CI and fresh checkouts.
    }

    if (!gitPathIsIgnored(root, localPath)) {
      findings.push({
        file: localPath,
        line: 1,
        label: "Local secret file is not ignored"
      });
    }
    if (trackedPaths.has(localPath)) {
      findings.push({
        file: localPath,
        line: 1,
        label: "Local secret file is tracked"
      });
    }
    if (!exists) {
      notices.push(`${localPath}: local secret file not present; exact-value scan skipped.`);
      continue;
    }
    localSecrets.push(...parseLocalSecrets(
      readFileSync(absolutePath, "utf8"),
      localPath,
      allowed
    ));
  }

  if (localSecretFiles.length > 0 && localSecrets.length === 0) {
    notices.push("No non-allowlisted local secret values found to scan.");
  }
  if (localSecrets.length > 0) {
    const candidatePaths = listGitPaths(
      root,
      ["ls-files", "-co", "--exclude-standard", "-z"]
    ).filter((file) => !localSecretFiles.includes(file));
    for (const relativePath of candidatePaths) {
      const absolutePath = resolve(root, relativePath);
      let bytes;
      try {
        if (!lstatSync(absolutePath).isFile()) continue;
        bytes = readFileSync(absolutePath);
      } catch {
        continue;
      }
      for (const secret of localSecrets) {
        if (bytes.includes(Buffer.from(secret.value))) {
          findings.push({
            file: relativePath,
            line: lineNumberAt(
              bytes.toString("utf8"),
              bytes.indexOf(Buffer.from(secret.value))
            ),
            label: `${secret.key} from ${secret.source} appears in the worktree`
          });
        }
      }
    }
    for (const secret of localSecrets) {
      if (gitHistoryContains(root, secret.value)) {
        findings.push({
          file: secret.source,
          line: secret.line,
          label: `${secret.key} appears in git history`
        });
      }
    }
  }

  return {
    findings,
    notices,
    scannedFiles: tracked.scannedFiles
  };
}

export function runSecretAudit(options = {}) {
  let result;
  try {
    result = auditRepositorySecrets(options);
  } catch {
    console.error("Unable to complete repository secret audit.");
    return false;
  }

  if (result.findings.length === 0) {
    const localPolicy = (options.localSecretFiles?.length ?? 0) > 0;
    console.log(localPolicy
      ? `Secret audit passed (${result.scannedFiles} tracked text files).`
      : `Tracked secret scan passed (${result.scannedFiles} text files).`
    );
    for (const notice of result.notices) console.log(`- ${notice}`);
    return true;
  }

  console.error("Tracked secret scan failed:");
  for (const finding of result.findings) {
    console.error(`- ${finding.file}:${finding.line}: ${finding.label}`);
  }
  console.error("Secret values were intentionally omitted.");
  return false;
}

function listGitPaths(root, args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024
  });
  if (result.error || result.status !== 0) {
    throw new Error("Unable to enumerate repository files");
  }
  return result.stdout.split("\0").filter(Boolean);
}

function gitPathIsIgnored(root, relativePath) {
  const result = spawnSync("git", ["check-ignore", "-q", "--", relativePath], {
    cwd: root,
    encoding: "utf8"
  });
  return !result.error && result.status === 0;
}

function gitHistoryContains(root, value) {
  const result = spawnSync(
    "git",
    ["log", "--all", "--format=%H", `-S${value}`, "--", "."],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024
    }
  );
  if (result.error || result.status !== 0) {
    throw new Error("Unable to scan repository history");
  }
  return result.stdout.trim().length > 0;
}

function parseLocalSecrets(text, source, allowed) {
  const secrets = [];
  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const separator = line.indexOf("=");
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!value || !/(SECRET|KEY|TOKEN)/.test(key) || allowed.has(value)) {
      continue;
    }
    secrets.push({ key, value, source, line: index + 1 });
  }
  return secrets;
}

function lineNumberAt(text, offset) {
  if (offset < 0) return 1;
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (text.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

function run() {
  if (!runSecretAudit()) process.exitCode = 1;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) run();
