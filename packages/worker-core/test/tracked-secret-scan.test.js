import assert from "node:assert/strict";
import test from "node:test";

import {
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
  const findings = scanTextForTrackedSecrets(
    `safe=true\nSTRIPE=${stripe}\nRESEND=${resend}`,
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
    }
  ]);
  assert.equal(JSON.stringify(findings).includes(stripe), false);
  assert.equal(JSON.stringify(findings).includes(resend), false);
});

test("detects private key material", () => {
  const marker = ["-----BEGIN ", "PRIVATE KEY-----"].join("");
  assert.deepEqual(scanTextForTrackedSecrets(marker, "key.pem"), [{
    file: "key.pem",
    line: 1,
    label: "Private key material"
  }]);
});
