# Start with selected primitives

These are small, executable integration examples. They provide no product model,
provider credentials, production bindings, recipients, deployment workflow or
application generator. Copy one into a new consumer; keep its policies there.

| Recipe | Runtime packages | What the fixture exercises |
| --- | --- | --- |
| [Worker/admin](worker-admin/) | Worker Core 0.15.0, Admin Shell 0.11.0 | Deny-by-default authorization, CSRF header wiring, bounded JSON and typed client errors |
| [Scheduled digest](scheduled-digest/) | Digest Core 0.1.0 | Scheduled preview creation, escaping, and failure before saving |
| [Jekyll site](jekyll-site/) | Site Shell 0.3.0 | Template rendering, selected browser asset publication and exclusion of tooling |

Each also uses Test Core 0.2.0 for the pin check. The Node test tooling stays out
of runtime bundles. Add other packages only when the application uses their public
exports; do not copy another product's routes or data model to obtain a primitive.

## Copy and pin

In a new, empty project directory with Node 22 or 24 and Git installed:

```sh
git init
git submodule add https://github.com/aindaco1/dust-wave-platform.git shared/dust-wave-platform
git -C shared/dust-wave-platform checkout --detach v0.38.0
cp -R shared/dust-wave-platform/examples/recipes/worker-admin/. .
git -C shared/dust-wave-platform rev-parse HEAD > platform-commit.txt
git add .gitmodules shared/dust-wave-platform platform-commit.txt
npm ci
npm test
```

Choose `scheduled-digest` or `jekyll-site` in the copy command to use that recipe.
For Jekyll, complete the additional build steps below before `npm test`.
The tag selects the reviewed immutable release; `platform-commit.txt` records its
full commit. Review and commit that file, `platform-packages.json`, the lockfile,
source and tests together. The file dependencies resolve to this exact submodule;
the pin check rejects an unstaged pointer, wrong remote, wrong version or stale
lockfile. It never fetches or updates a dependency for you.

The Worker/admin example is a local composition test, not an authentication
system. The app must supply session/origin/CSRF authorization, schema and routes.
Bundle `src/worker.js` and `src/admin.js` separately using the app's chosen build
and deployment tooling. The default Worker denies every request.

The digest example creates a preview through injected loading and saving
functions. The app must define scheduling, validated item URLs, selection,
deduplication, persistence, audience and explicit delivery policy before adding a
send adapter. This example sends nothing.

## Jekyll integration

Use Ruby 3.2 and Bundler. The separately versioned template owns checked-in
Jekyll includes/plugins; Platform owns the browser primitive. From the copied
Jekyll recipe directory:

```sh
git submodule add https://github.com/aindaco1/dust-wave-jekyll-template.git shared/dust-wave-jekyll-template
git -C shared/dust-wave-jekyll-template checkout --detach 351281a5aec60fa85653a3d23391e66fb860aae6
node shared/dust-wave-jekyll-template/bin/sync-consumer.mjs --consumer-root . --write
git add .gitmodules shared/dust-wave-jekyll-template _includes _plugins
bundle install
npm run template:check
npm run build
npm test
```

Review the template's allowlisted copied files and commit `Gemfile.lock`. The
build excludes both shared repositories and publishes only the selected browser
entry into generated `_site/assets`. Layout, content, styles, localization and
hosting remain consumer-owned. Add Design Core when the site's styles need it.
A successful fixture build does not establish accessibility or production acceptance
for a completed application.

## Upgrade and rollback

Create a consumer upgrade branch; record the previous consumer commit and both
submodule pins. Check out the reviewed replacement Platform commit, update the
exact package map and lockfile, record the new full commit and stage the gitlink.
Run the behavior and complete application release gates before publishing.
Revert the consumer upgrade commit as a unit (source, pins, manifests and locks),
initialize submodules, run `npm ci` and its release gates, then redeploy that
consumer's reviewed previous release. Other consumers need no change.

## Maintainer verification

`npm test` in Platform runs package tests plus fresh-checkout, offline npm install
and behavior checks for the two JavaScript recipes on Node 22 and 24. It also
proves that a changed package contract fails the pin guard.
`npm run test:recipes:jekyll` clones the pinned template and performs an actual
Jekyll build; CI runs that lane with Ruby 3.2. The recipe harness checks the
**committed candidate** in temporary consumer directories and removes them after
the check. Commit local recipe/package changes before running it. No fixtures
contact a business provider or write to a real application.
