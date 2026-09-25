/** GitHub normalizes whitespace in uploaded asset names to dots. */
export function githubReleaseAssetName(name) {
  return String(name || '').replace(/\s+/g, '.');
}

export function githubReleaseAssetUrl(baseUrl, artifactName) {
  return `${baseUrl}/${encodeURIComponent(githubReleaseAssetName(artifactName))}`;
}

/** Caller owns signature validation, artifact choice, channel and release notes. */
export function createTauriUpdateManifest({ version, notes, pubDate, platforms }) {
  return { version, notes, pub_date: pubDate, platforms };
}
