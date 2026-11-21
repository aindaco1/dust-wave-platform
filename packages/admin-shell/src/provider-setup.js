import { escapeAttribute as escape } from "./html-attribute.js";

const R2_DASHBOARD = "https://dash.cloudflare.com/?to=/:account/r2/overview";
const JURISDICTIONS = new Map([
  ["default", "Default"], ["eu", "European Union"], ["us", "United States"], ["fedramp", "FedRAMP"]
]);

function localRoute(action) {
  if (typeof action !== "string" || !action.startsWith("/") || action.includes("//") ||
      !/^[a-zA-Z0-9_~./-]+$/.test(action) ||
      action.split("/").some(part => part === "." || part === "..")) {
    throw new TypeError("Form action must be a root-relative path.");
  }
  return escape(action);
}

function form(action, csrfToken, contents) {
  const csrf = csrfToken ? `<input type="hidden" name="csrf" value="${escape(csrfToken)}">` : "";
  return `<form class="provider-form" method="post" action="${localRoute(action)}">${csrf}${contents}</form>`;
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
  status, description, title = "Stripe", action, checkAction, resetHref, buttonLabel, csrfToken,
  existingOAuth = false, resume = false, ready = false, showGuide = true
}) {
  let body = "";
  if (!ready) {
    if (resume) {
      if (showGuide) body += "<p>Continue on Stripe to review any remaining account details.</p>";
      if (action) body += form(action, csrfToken, modeButton("resume", buttonLabel || "Continue Stripe setup"));
    } else {
      const existing = existingOAuth
        ? "Sign in to Stripe and choose the eligible account you want to connect."
        : "Sign in on Stripe. For a new connected account, Stripe may offer to reuse business details you have already verified.";
      if (showGuide) body += `<div class="provider-guide">
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
  if (resetHref) body += `<p><a href="${localRoute(resetHref)}">Reset Stripe connection</a></p>`;
  if (showGuide) body += `<details class="provider-guide"><summary>About Stripe setup</summary>
    <p>Enter any identity and bank details directly on Stripe. Return here to check whether Stripe still needs information.</p>
    <p>${officialLink("https://docs.stripe.com/connect/hosted-onboarding", "Stripe’s onboarding guide")}</p>
  </details>`;
  return card("stripe", title, status, description, body);
}

function r2Access(storageAccess = "read-only", uploadConsent) {
  if (storageAccess === "read-only") return { uploads: false, permission: "Object Read only", marker: "", consent: "" };
  if (storageAccess !== "uploads") throw new TypeError("Unsupported R2 storageAccess.");
  if (typeof uploadConsent !== "string" || !uploadConsent.trim()) throw new TypeError("Upload consent text is required.");
  return {
    uploads: true, permission: "Object Read &amp; Write",
    marker: '<input type="hidden" name="storageAccess" value="uploads">',
    consent: `<label><input type="checkbox" name="uploadConsent" value="yes" required> ${escape(uploadConsent)}</label>`
  };
}

function r2Guide(access) {
  return `<div class="provider-guide">
    <details><summary>Choose a Cloudflare account and bucket</summary>
      <p>${officialLink(R2_DASHBOARD, "Open R2 in the Cloudflare dashboard")} in a new tab. Sign into the account that owns the bucket, or create a Cloudflare account. If prompted, activate R2 and review ${officialLink("https://developers.cloudflare.com/r2/pricing/", "R2 pricing")}.</p>
      <p><strong>Existing bucket.</strong> Select a private bucket dedicated to the files you want to share with this app. The token can ${access.uploads ? "read and change" : "read"} every object in it.</p>
      <p><strong>New bucket.</strong> Choose <strong>Create bucket</strong>, give it a name, and select the storage class. Standard storage includes a monthly free allowance.</p>
      <p>Open the bucket’s settings. Confirm the public development URL (<code>r2.dev</code>) is disabled and there are no active custom domains. For an existing public bucket, create a separate private bucket to preserve its current links.</p>
    </details>
    <details><summary>Get ${access.uploads ? "an upload key" : "a read-only key"} for this bucket</summary>
      <ol>
        <li>In ${officialLink(R2_DASHBOARD, "R2 Overview")}, find <strong>Account Details</strong> and select <strong>Manage</strong> beside <strong>API Tokens</strong>.</li>
        <li>Create an account token if you administer the account, or a user token with the required bucket access. Choose <strong>${access.permission}</strong> and <strong>Apply to specific buckets only</strong>. Select just this bucket.</li>
        <li>Create the token. Copy the Access Key ID and Secret Access Key into the connection form. Save the secret in your password manager while Cloudflare displays it.</li>
      </ol>
      <p>${officialLink("https://developers.cloudflare.com/r2/api/tokens/", "Cloudflare’s R2 token guide")}</p>
    </details>
  </div>`;
}

function keyFields() {
  return `<label>Access Key ID <input name="accessKeyId" required autocomplete="off" spellcheck="false"></label>
    <label>Secret Access Key <input type="password" name="secretAccessKey" required autocomplete="off" spellcheck="false"></label>`;
}

function confirmBucket(buttonLabel, access) {
  return `<label><input type="checkbox" name="privateConfirmed" value="yes" required>
    I checked that the bucket is private and this key grants ${access.permission} access to this bucket alone.</label>${access.consent}
    <button type="submit">${escape(buttonLabel)}</button>`;
}

function r2Fields({ accountId, bucket, jurisdiction = "default" }, buttonLabel, access) {
  if (!JURISDICTIONS.has(jurisdiction)) throw new TypeError("Unsupported R2 jurisdiction.");
  const options = [...JURISDICTIONS].map(([value, label]) =>
    `<option value="${value}"${value === jurisdiction ? " selected" : ""}>${label}</option>`).join("");
  return `${access.marker}<label>Cloudflare account ID
      <input name="accountId" value="${escape(accountId)}" required minlength="32" maxlength="32" pattern="[0-9a-fA-F]{32}" autocomplete="off" spellcheck="false">
      <small>In Cloudflare’s dashboard search, choose “Copy account ID”.</small></label>
    <label>Bucket name <input name="bucket" value="${escape(bucket)}" required minlength="3" maxlength="63" autocomplete="off" spellcheck="false"></label>
    <details><summary>Bucket jurisdiction</summary>
      <label>Jurisdiction <select name="jurisdiction">${options}</select></label>
      <small>Keep Default unless the bucket was created in a specific jurisdiction. This setting is separate from its location hint.</small>
    </details>
    ${keyFields()}${confirmBucket(buttonLabel, access)}`;
}

export function renderR2Card({
  status, description, title = "Cloudflare R2", action, guideAction, buttonLabel, csrfToken, values = {}, connected = false, showGuide = true,
  storageAccess, uploadConsent
}) {
  const access = r2Access(storageAccess, uploadConsent);
  const guide = showGuide ? r2Guide(access) : "";
  let body = guideAction ? "" : guide;
  let connection = "";
  if (guideAction) {
    connection = `<p>${officialLink(R2_DASHBOARD, "Open Cloudflare R2")}. Sign in to your Cloudflare account or create one. Activate R2 if prompted. Open your private bucket, or choose <strong>Create bucket</strong> to make one.</p>` +
      form(guideAction, csrfToken, `${access.marker}<label>Bucket dashboard URL
        <input type="url" name="bucketUrl" required maxlength="2048" autocomplete="off" spellcheck="false">
        <small>Open the bucket and copy the address from your browser.</small></label>
        <button type="submit">Continue with this bucket</button>`);
  }
  if (action) {
    const fields = r2Fields(values, buttonLabel || (connected ? "Save replacement key" : "Connect private bucket"), access);
    const manual = form(action, csrfToken, fields);
    connection += guideAction ? `<details><summary>Enter connection details manually</summary>${guide}${manual}</details>` : manual;
  }
  if (connection) body += connected ? `<details class="provider-connection"><summary>Replace R2 credentials</summary>${connection}</details>` : connection;
  return card("r2", title, status, description, body);
}

export function renderR2TokenForm({ action, csrfToken, buttonLabel, accountId, jurisdiction = "default", bucket, storageAccess, uploadConsent }) {
  if (typeof accountId !== "string" || typeof bucket !== "string" || !/^[a-f0-9]{32}$/.test(accountId) || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket) || !JURISDICTIONS.has(jurisdiction)) {
    throw new TypeError("A valid R2 bucket location is required.");
  }
  const access = r2Access(storageAccess, uploadConsent);
  const url = `https://dash.cloudflare.com/${accountId}/r2/${jurisdiction}/buckets/${bucket}`;
  const createToken = `https://dash.cloudflare.com/${accountId}/r2/api-tokens/create`;
  const selected = `${access.marker}<input type="hidden" name="bucketUrl" value="${escape(url)}">`;
  return `<p>Give this app ${access.uploads ? "read and write" : "read"} access to <strong>${escape(bucket)}</strong>. In the bucket settings, keep the public development URL disabled and leave custom domains disconnected.</p>
    <ol><li>${officialLink(createToken + "?type=account", "Create an account token")} if you manage the Cloudflare account. Otherwise, ${officialLink(createToken + "?type=user", "Create a user token")} with your own access.</li>
      <li>Choose <strong>${access.permission}</strong>. Change the bucket scope to <strong>Apply to specific buckets only</strong> and select only <strong>${escape(bucket)}</strong>.</li>
      <li>Create the token and copy its <strong>Token value</strong>.</li></ol>` +
    form(action, csrfToken, `${selected}
      <label>R2 token value<input type="password" name="tokenValue" required maxlength="256" spellcheck="false" autocomplete="off"></label>
      ${confirmBucket(buttonLabel || "Connect private bucket", access)}`) +
    `<details><summary>Use an existing access key pair</summary>${form(action, csrfToken, selected + keyFields() + confirmBucket(buttonLabel || "Connect with access keys", access))}</details>`;
}
