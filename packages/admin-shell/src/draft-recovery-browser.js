(function(scope) {
  "use strict";
  if (scope.DustWaveDraftRecovery) return;
  // Revisions and snapshots are opaque consumer values. Never rebase unpublished
  // edits by pairing their old revision with a newer published snapshot.
  function recoverDraftBaseline({ draftRevision = "", draftSnapshot,
    currentRevision = "", currentSnapshot = "", needsPublishing,
    workingRevisionChanged = false, legacyRevisionMatches = false }) {
    if (!needsPublishing || !(workingRevisionChanged || (draftRevision && draftSnapshot !== currentSnapshot))) {
      return { revision: currentRevision, snapshot: currentSnapshot, conflict: false };
    }
    if (legacyRevisionMatches) {
      return { revision: currentRevision, snapshot: currentSnapshot, conflict: false };
    }
    return { revision: draftRevision, snapshot: draftSnapshot || "", conflict: draftRevision !== currentRevision };
  }
  Object.defineProperty(scope, "DustWaveDraftRecovery", {
    value: Object.freeze({ recoverDraftBaseline }), configurable: false
  });
})(globalThis);
