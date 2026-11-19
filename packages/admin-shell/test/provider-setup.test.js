import assert from "node:assert/strict";
import test from "node:test";
import { parseHTML } from "linkedom";
import { renderR2Card, renderStripeCard, renderR2TokenForm } from "@dustwave/admin-shell/provider-setup";

function card(html) {
  return parseHTML("<html><body>" + html + "</body></html>").document.body;
}

const state = { status: "Setup needed", action: "/setup/start", csrfToken: "test-csrf" };

test("Stripe exposes precisely the actions enabled by the consumer", () => {
  const modes = options => [...card(renderStripeCard(options)).querySelectorAll('button[name="mode"]')].map(button => button.value || button.getAttribute("value"));
  assert.deepEqual(modes(state), ["new", "reuse"]);
  assert.deepEqual(modes({ ...state, existingOAuth: true }), ["new", "existing"]);
  assert.deepEqual(modes({ ...state, resume: true, existingOAuth: true }), ["resume"]);
  assert.deepEqual(modes({ ...state, ready: true }), []);
  const ui = card(renderStripeCard({ ...state, status: "Stripe review pending", resume: true, checkAction: "/setup/check" }));
  assert.equal(ui.querySelector(".provider-status").textContent, "Stripe review pending");
  assert.deepEqual([...ui.querySelectorAll("form")].map(form => form.getAttribute("action")), ["/setup/start", "/setup/check"]);
  for (const form of ui.querySelectorAll("form")) {
    assert.equal(form.getAttribute("method"), "post");
    assert.equal(form.querySelector("input[name=csrf]").getAttribute("value"), "test-csrf");
  }
  assert.equal(ui.querySelector("input[type=password]"), null);
});

test("R2 keeps public access and token-scope attestation separate from a successful connection", () => {
  const options = { ...state, connected: true, values: { bucket: "my-bucket", accountId: "a".repeat(32),
    jurisdiction: "eu", accessKeyId: "stale-id", secretAccessKey: "stale-secret" } };
  const ui = card(renderR2Card(options));
  const form = ui.querySelector("form");
  assert.equal(form.closest("details").hasAttribute("open"), false);
  assert.equal(form.getAttribute("method"), "post");
  assert.equal(form.querySelector("input[name=bucket]").value, "my-bucket");
  assert.deepEqual([...form.querySelectorAll("select option")].map(option => option.value), ["default", "eu", "us", "fedramp"]);
  assert.equal(form.querySelector("option[selected]").value, "eu");
  const confirmScope = form.querySelector("input[name=privateConfirmed]");
  assert.equal(confirmScope.hasAttribute("required"), true);
  assert.equal(confirmScope.hasAttribute("checked"), false);
  assert.equal(confirmScope.getAttribute("value"), "yes");
  assert.equal(form.querySelector("input[name=secretAccessKey]").getAttribute("type"), "password");
  for (const key of ["accessKeyId", "secretAccessKey"]) assert.equal(form.querySelector('[name="' + key + '"]').value, "");
  assert.doesNotMatch(ui.innerHTML, /stale-id|stale-secret/);
  assert.match(ui.textContent, /r2.dev/);
  assert.match(ui.textContent, /custom domain/i);
  assert.match(ui.textContent, /Object Read only/);
  assert.match(ui.textContent, /specific buckets only/i);
  assert.equal(ui.querySelector("input[type=file]"), null);
  assert.equal(ui.querySelector("[name=objectKey]"), null);
  assert.throws(() => renderR2Card({ ...state, values: { jurisdiction: "incorrect" } }), /jurisdiction/);
});

test("missing actions produce read-only guidance, and rendered caller text stays text", () => {
  const injected = '"><img src=x onerror=x>&';
  for (const render of [renderR2Card, renderStripeCard]) {
    assert.throws(() => render({}), /status/);
    const ui = card(render({ status: injected, title: injected, description: injected }));
    assert.equal(ui.querySelector(".provider-status").textContent, injected);
    assert.equal(ui.querySelector("h2").textContent, injected);
    assert.equal(ui.querySelector("form, input, img, script"), null);
    const active = card(render({ ...state, buttonLabel: injected, csrfToken: injected, values: { bucket: injected } }));
    assert.equal(active.querySelector("button").textContent, injected);
    assert.equal(active.querySelector("input[name=csrf]").value, injected);
    assert.equal(active.querySelector("[onerror], img, script"), null);
  }
});

test("only literal root-relative form routes can receive a submission", () => {
  for (const action of ["//third-party.invalid/pay", "https://third-party.invalid", "relative", "/\\host", "/\t/host", "/a/../b", "/a%2fb", "/a?secret=x"]) {
    assert.throws(() => renderR2Card({ ...state, action }), /path/);
    assert.throws(() => renderStripeCard({ ...state, checkAction: action }), /path/);
  }
});

test("optional guided connections use local review routes and keep credentials out of the first step", () => {
  const r2 = card(renderR2Card({ ...state, guideAction: "/setup/r2/location" }));
  const guided = r2.querySelector('form[action="/setup/r2/location"]');
  assert.ok(guided.querySelector('input[name=bucketUrl][type=url][required]'));
  assert.equal(guided.querySelector('[type=password]'), null);
  assert.ok(r2.querySelector('details form[action="/setup/start"]'));
  const stripe = card(renderStripeCard({ ...state, resetHref: "/setup/stripe/reset", ready: true }));
  assert.equal(stripe.querySelector('a[href="/setup/stripe/reset"]').textContent, "Reset Stripe connection");
  assert.throws(() => renderStripeCard({ ...state, resetHref: "//bad.invalid" }), /path/);
  assert.throws(() => renderR2Card({ ...state, guideAction: "https://bad.invalid" }), /path/);
});

test("R2 token and saved-key handoffs each submit only the chosen bucket after confirmation", () => {
  const location = { accountId: "a".repeat(32), jurisdiction: "eu", bucket: "screenings" };
  const view = card(renderR2TokenForm({ ...location, ...state }));
  const forms = [...view.querySelectorAll("form")];
  assert.equal(forms.length, 2);
  for (const element of forms) {
    assert.equal(element.getAttribute("action"), state.action);
    assert.equal(element.querySelector('[name=csrf]').value, state.csrfToken);
    assert.equal(element.querySelector('[name=bucketUrl]').value, "https://dash.cloudflare.com/" + location.accountId + "/r2/eu/buckets/screenings");
    assert.ok(element.querySelector('[name=privateConfirmed][required]'));
  }
  assert.ok(forms[0].querySelector('[name=tokenValue][type=password]'));
  assert.ok(forms[1].closest("details"));
  for (const bucket of [undefined, "x/y", '<img>']) assert.throws(() => renderR2TokenForm({ ...state, ...location, bucket }), /location/);
});
