import assert from "node:assert/strict";
import test from "node:test";
import { parseHTML } from "linkedom";
import { renderR2Card, renderStripeCard, renderR2TokenForm } from "@dustwave/admin-shell/provider-setup";

function card(html) {
  return parseHTML("<html><body>" + html + "</body></html>").document.body;
}

const state = { status: "Setup needed", action: "/setup/start", csrfToken: "test-csrf" };

test("R2 requests upload permission and storage consent only when the consumer opts in", () => {
  const location = { accountId: "a".repeat(32), bucket: "private-uploads" };
  const guided = { ...state, guideAction: "/setup/location" };
  const permission = { storageAccess: "uploads", uploadConsent: 'I authorize Example to store an encrypted credential for film & thumbnail uploads. <example>' };
  const screens = [
    options => card(renderR2Card({ ...state, ...options })),
    options => card(renderR2Card({ ...guided, ...options })),
    options => card(renderR2TokenForm({ ...state, ...location, ...options }))
  ];
  for (const screen of screens) {
    const legacy = screen({});
    assert.equal(screen({storageAccess:"read-only"}).innerHTML, legacy.innerHTML);
    assert.equal(legacy.querySelector('[name="storageAccess"], [name="uploadConsent"]'), null);
    assert.match(legacy.textContent, /Object Read only/);
    assert.throws(() => screen({ storageAccess: "admin" }), /storageAccess/);
    assert.throws(() => screen({ storageAccess: "uploads", uploadConsent: " " }), /consent/i);
    const uploads = screen(permission);
    assert.match(uploads.textContent, /Object Read & Write/);
    assert.match(uploads.textContent, /specific buckets only/i);
    assert.doesNotMatch(uploads.textContent, /Object Read only/);
    for (const form of uploads.querySelectorAll("form")) {
      assert.equal(form.querySelector('input[type="hidden"][name="storageAccess"]').value, "uploads");
      if (form.querySelector('input[type="url"]')) {
        assert.equal(form.querySelector('input[name="uploadConsent"]'), null);
        continue;
      }
      const consent = form.querySelector('input[type="checkbox"][name="uploadConsent"][required]');
      assert.equal(consent.getAttribute("value"), "yes");
      assert.equal(consent.hasAttribute("checked"), false);
      assert.equal(consent.closest("label").textContent.trim(), permission.uploadConsent);
      assert.equal(form.querySelector("example"), null);
      assert.ok(form.querySelector('input[type="checkbox"][name="privateConfirmed"][required]'));
    }
  }
});

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
  const links = [...view.querySelectorAll('ol a')];
  assert.deepEqual(links.map(link => link.textContent), ["Create an account token", "Create a user token"]);
  assert.deepEqual(links.map(link => link.getAttribute("href")), ["account", "user"].map(type =>
    `https://dash.cloudflare.com/${location.accountId}/r2/api-tokens/create?type=${type}`));
  for (const link of links) {
    assert.equal(link.getAttribute("target"), "_blank");
    assert.equal(link.getAttribute("rel"), "noopener noreferrer");
  }
  assert.match(view.querySelector("ol").textContent, /Apply to specific buckets only.*screenings/);
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

test("consumers can move provider guidance to a separate page without changing form actions or consent", () => {
  const stripe = { ...state, checkAction: "/setup/check", resetHref: "/setup/reset" };
  for (const options of [stripe, { ...stripe, resume: true }, { ...stripe, ready: true }]) {
    const full = card(renderStripeCard(options)), compact = card(renderStripeCard({ ...options, showGuide: false }));
    assert.ok(full.querySelector(".provider-guide"));
    assert.equal(compact.querySelector(".provider-guide"), null);
    assert.deepEqual([...compact.querySelectorAll("form,button,a")].map(el => el.outerHTML),
      [...full.querySelectorAll("form,button,a")].filter(el => !el.closest(".provider-guide")).map(el => el.outerHTML));
  }
  assert.equal(card(renderR2Card({ status: "Connected", showGuide: false })).querySelector("details, form"), null);
  const guided = card(renderR2Card({ ...state, guideAction: "/setup/location", showGuide: false }));
  assert.ok(guided.querySelector('[name=bucketUrl]'));
  assert.ok(guided.querySelector('[name=privateConfirmed][required]'));
  assert.equal(guided.querySelector(".provider-guide"), null);
  const rotation = card(renderR2TokenForm({ ...state, accountId: "a".repeat(32), bucket: "my-films", buttonLabel: "Save new key" }));
  assert.deepEqual([...rotation.querySelectorAll("button")].map(button => button.textContent), ["Save new key", "Save new key"]);
});
