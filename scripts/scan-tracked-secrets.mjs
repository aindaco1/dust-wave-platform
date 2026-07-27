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
  const tracked = spawnSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024
  });
  if (tracked.error || tracked.status !== 0) {
    throw new Error("Unable to enumerate tracked files");
  }

  const findings = [];
  let scannedFiles = 0;
  for (const relativePath of tracked.stdout.split("\0").filter(Boolean)) {
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

function lineNumberAt(text, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (text.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

function run() {
  let result;
  try {
    result = scanTrackedRepository();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Secret scan failed");
    process.exitCode = 1;
    return;
  }

  if (result.findings.length === 0) {
    console.log(`Tracked secret scan passed (${result.scannedFiles} text files).`);
    return;
  }

  console.error("Tracked secret scan failed:");
  for (const finding of result.findings) {
    console.error(`- ${finding.file}:${finding.line}: ${finding.label}`);
  }
  console.error("Secret values were intentionally omitted.");
  process.exitCode = 1;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) run();
