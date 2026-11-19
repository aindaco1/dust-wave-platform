import { escapeAttribute as escape } from "./html-attribute.js";

const R2_DASHBOARD = "https://dash.cloudflare.com/?to=/:account/r2/overview";
const JURISDICTIONS = new Map([
  ["default", "Default"], ["eu", "European Union"], ["us", "United States"], ["fedramp", "FedRAMP"]
]);

function form(action, csrfToken, contents) {
  if (typeof action !== "string" || !action.startsWith("/") || action.includes("//") ||
      !/^[a-zA-Z0-9_~./-]+$/.test(action) ||
      action.split("/").some(part => part === "." || part === "..")) {
    throw new TypeError("Form action must be a root-relative path.");
  }
  const csrf = csrfToken ? `<input type="hidden" name="csrf" value="${escape(csrfToken)}">` : "";
  return `<form class="provider-form" method="post" action="${escape(action)}">${csrf}${contents}</form>`;
}

function card(provider, title, status, description, body) {
  if (typeof status !== "string" || !status.trim()) throw new TypeError("A provider status label is required.");
  return `<section class="provider-card provider-card--${provider}" aria-label="${escape(title)}">
    <h2>${escape(title)}</h2>
    <p class="provider-status" role="status">${escape(status)}</p>
    ${description ? `<p class="provider-description">${escape(description)}</p>` : ""}
    ${body}
  </section>`;
}

function officialLink(url, label) {
  return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

function modeButton(mode, label) {
  return `<button type="submit" name="mode" value="${mode}">${escape(label)}</button>`;
}

export function renderStripeCard({
  status, description, title = "Stripe", action, checkAction, buttonLabel, csrfToken,
  existingOAuth = false, resume = false, ready = false
}) {
  let body = "";
  if (!ready) {
    if (resume) {
      body += "<p>Continue on Stripe to review any remaining account details.</p>";
      if (action) body += form(action, csrfToken, modeButton("resume", buttonLabel || "Continue Stripe setup"));
    } else {
      const existing = existingOAuth
        ? "Sign in to Stripe and choose the eligible account you want to connect."
        : "Sign in on Stripe. For a new connected account, Stripe may offer to reuse business details you have already verified.";
      body += `<div class="provider-guide">
        <p><strong>New to Stripe?</strong> Create an account on Stripe and follow its prompts for business details, identity verification, and payouts.</p>
        <p><strong>Already use Stripe?</strong> ${existing}</p>
      </div>`;
      if (action) {
        body += form(action, csrfToken, modeButton("new", buttonLabel || "Create a Stripe account") +
          modeButton(existingOAuth ? "existing" : "reuse", existingOAuth ? "Connect my Stripe account" : "Reuse my Stripe details"));
      }
    }
  }
  if (checkAction) body += form(checkAction, csrfToken, '<button type="submit">Check Stripe status</button>');
  body += `<details class="provider-guide"><summary>About Stripe setup</summary>
    <p>Enter any identity and bank details directly on Stripe. Return here to check whether Stripe still needs information.</p>
    <p>${officialLink("https://docs.stripe.com/connect/hosted-onboarding", "Stripe’s onboarding guide")}</p>
  </details>`;
  return card("stripe", title, status, description, body);
}

function r2Guide() {
  return `<div class="provider-guide">
    <details><summary>Choose a Cloudflare account and bucket</summary>
      <p>${officialLink(R2_DASHBOARD, "Open R2 in the Cloudflare dashboard")} in a new tab. Sign into the account that owns the bucket, or create a Cloudflare account. If prompted, activate R2 and review ${officialLink("https://developers.cloudflare.com/r2/pricing/", "R2 pricing")}.</p>
      <p><strong>Existing bucket.</strong> Select a private bucket dedicated to the files you want to share with this app. The token can read every object in it.</p>
      <p><strong>New bucket.</strong> Choose <strong>Create bucket</strong>, give it a name, and select the storage class. Standard storage includes a monthly free allowance.</p>
      <p>Open the bucket’s settings. Confirm the public development URL (<code>r2.dev</code>) is disabled and there are no active custom domains. For an existing public bucket, create a separate private bucket to preserve its current links.</p>
    </details>
    <details><summary>Get a read-only key for this bucket</summary>
      <ol>
        <li>In ${officialLink(R2_DASHBOARD, "R2 Overview")}, find <strong>Account Details</strong> and select <strong>Manage</strong> beside <strong>API Tokens</strong>.</li>
        <li>Create an account token if you administer the account, or a user token with the required bucket access. Choose <strong>Object Read only</strong> and <strong>Apply to specific buckets only</strong>. Select just this bucket.</li>
        <li>Create the token. Copy the Access Key ID and Secret Access Key into the connection form. Save the secret in your password manager while Cloudflare displays it.</li>
      </ol>
      <p>${officialLink("https://developers.cloudflare.com/r2/api/tokens/", "Cloudflare’s R2 token guide")}</p>
    </details>
  </div>`;
}

function r2Fields({ accountId, bucket, jurisdiction = "default" }, buttonLabel) {
  if (!JURISDICTIONS.has(jurisdiction)) throw new TypeError("Unsupported R2 jurisdiction.");
  const options = [...JURISDICTIONS].map(([value, label]) =>
    `<option value="${value}"${value === jurisdiction ? " selected" : ""}>${label}</option>`).join("");
  return `<label>Cloudflare account ID
      <input name="accountId" value="${escape(accountId)}" required minlength="32" maxlength="32" pattern="[0-9a-fA-F]{32}" autocomplete="off" spellcheck="false">
      <small>In Cloudflare’s dashboard search, choose “Copy account ID”.</small></label>
    <label>Bucket name <input name="bucket" value="${escape(bucket)}" required minlength="3" maxlength="63" autocomplete="off" spellcheck="false"></label>
    <details><summary>Bucket jurisdiction</summary>
      <label>Jurisdiction <select name="jurisdiction">${options}</select></label>
      <small>Keep Default unless the bucket was created in a specific jurisdiction. This setting is separate from its location hint.</small>
    </details>
    <label>Access Key ID <input name="accessKeyId" required autocomplete="off" spellcheck="false"></label>
    <label>Secret Access Key <input type="password" name="secretAccessKey" required autocomplete="off" spellcheck="false"></label>
    <label><input type="checkbox" name="privateConfirmed" value="yes" required>
      I checked that the bucket is private and this key grants Object Read only access to this bucket alone.</label>
    <button type="submit">${escape(buttonLabel)}</button>`;
}

export function renderR2Card({
  status, description, title = "Cloudflare R2", action, buttonLabel, csrfToken, values = {}, connected = false
}) {
  let body = r2Guide();
  if (action) {
    const fields = r2Fields(values, buttonLabel || (connected ? "Save replacement key" : "Connect private bucket"));
    const connection = form(action, csrfToken, fields);
    body += connected ? `<details class="provider-connection"><summary>Replace R2 credentials</summary>${connection}</details>` : connection;
  }
  return card("r2", title, status, description, body);
}
