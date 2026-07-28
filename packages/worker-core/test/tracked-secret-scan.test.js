import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

import {
  auditRepositorySecrets,
  scanTextForTrackedSecrets
} from "../../../scripts/scan-tracked-secrets.mjs";

test("allows documented placeholders and short test fixtures", () => {
  const text = [
    "STRIPE_SECRET_KEY=replace-me",
    "sk_test_fixture",
    "rk_test_fixture",
    "whsec_fixture",
    "re_fixture"
  ].join("\n");

  assert.deepEqual(scanTextForTrackedSecrets(text, "fixture.env"), []);
});

test("reports high-confidence provider credentials without returning values", () => {
  const stripe = ["sk", "live", "A".repeat(24)].join("_");
  const resend = `re_${"B".repeat(32)}`;
  const cloudflareGlobalKey = `cfk_${"C".repeat(44)}`;
  const cloudflareUserToken = `cfut_${"D".repeat(44)}`;
  const cloudflareAccountToken = `cfat_${"E".repeat(44)}`;
  const findings = scanTextForTrackedSecrets(
    [
      "safe=true",
      `STRIPE=${stripe}`,
      `RESEND=${resend}`,
      `CLOUDFLARE_GLOBAL=${cloudflareGlobalKey}`,
      `CLOUDFLARE_USER=${cloudflareUserToken}`,
      `CLOUDFLARE_ACCOUNT=${cloudflareAccountToken}`
    ].join("\n"),
    "unsafe.env"
  );

  assert.deepEqual(findings, [
    {
      file: "unsafe.env",
      line: 2,
      label: "Stripe secret or restricted API key"
    },
    {
      file: "unsafe.env",
      line: 3,
      label: "Resend API key"
    },
    {
      file: "unsafe.env",
      line: 4,
      label: "Cloudflare global API key"
    },
    {
      file: "unsafe.env",
      line: 5,
      label: "Cloudflare user API token"
    },
    {
      file: "unsafe.env",
      line: 6,
      label: "Cloudflare account API token"
    }
  ]);
  assert.equal(JSON.stringify(findings).includes(stripe), false);
  assert.equal(JSON.stringify(findings).includes(resend), false);
  assert.equal(JSON.stringify(findings).includes(cloudflareGlobalKey), false);
  assert.equal(JSON.stringify(findings).includes(cloudflareUserToken), false);
  assert.equal(JSON.stringify(findings).includes(cloudflareAccountToken), false);
});

test("detects private key material", () => {
  const marker = ["-----BEGIN ", "PRIVATE KEY-----"].join("");
  assert.deepEqual(scanTextForTrackedSecrets(marker, "key.pem"), [{
    file: "key.pem",
    line: 1,
    label: "Private key material"
  }]);
});

test("finds an injected local secret in history without returning its value", () => {
  const root = mkdtempSync(join(tmpdir(), "dustwave-secret-audit-"));
  const secret = ["owner", "secret", "C".repeat(24)].join("-");
  const git = (...args) => execFileSync("git", args, {
    cwd: root,
    stdio: "ignore"
  });
  try {
    git("init");
    git("config", "user.email", "test@dustwave.invalid");
    git("config", "user.name", "Dust Wave Test");
    mkdirSync(join(root, "worker"));
    writeFileSync(join(root, ".gitignore"), "worker/.dev.vars\n");
    writeFileSync(join(root, "safe.txt"), `SERVICE_SECRET=${secret}\n`);
    git("add", ".gitignore", "safe.txt");
    git("commit", "-m", "fixture with leaked value");
    writeFileSync(join(root, "safe.txt"), "safe=true\n");
    git("add", "safe.txt");
    git("commit", "-m", "remove leaked value");
    writeFileSync(
      join(root, "worker", ".dev.vars"),
      `SERVICE_SECRET=${secret}\n`
    );

    const result = auditRepositorySecrets({
      root,
      localSecretFiles: ["worker/.dev.vars"]
    });

    assert(result.findings.some((finding) =>
      finding.label === "SERVICE_SECRET appears in git history"
    ));
    assert.equal(JSON.stringify(result).includes(secret), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
