import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVE_TRANSCRIPT_POINTER_SCHEMA,
  buildActiveTranscriptPointer,
  validateActiveTranscriptPointer,
  validateTranscriptRevisionLineage
} from "../src/revisions.js";

const SOURCE = "a".repeat(64);
const REVISION = "b".repeat(64);
const PARENT_REVISION = "c".repeat(64);

test("builds and validates a project-bound active transcript pointer", async () => {
  const pointer = await buildActiveTranscriptPointer({
    projectId: "project_fixture",
    sourceAudioSha256: SOURCE,
    transcriptId: "transcript_current",
    parentTranscriptId: "transcript_parent",
    revisionSha256: REVISION,
    updatedAt: "2026-08-08T12:00:00.000Z"
  });
  assert.equal(pointer.schemaVersion, ACTIVE_TRANSCRIPT_POINTER_SCHEMA);
  assert.match(pointer.manifestSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(await validateActiveTranscriptPointer(pointer, {
    projectId: "project_fixture",
    sourceAudioSha256: SOURCE
  }), pointer);
});

test("rejects pointer tampering, unknown fields, and wrong projects", async () => {
  const pointer = await buildActiveTranscriptPointer({
    projectId: "project_fixture",
    sourceAudioSha256: SOURCE,
    transcriptId: "transcript_current",
    revisionSha256: REVISION
  });
  await assert.rejects(
    validateActiveTranscriptPointer({ ...pointer, revisionSha256: "d".repeat(64) }),
    /pointer is invalid/
  );
  await assert.rejects(
    validateActiveTranscriptPointer({ ...pointer, unexpected: true }),
    /fields are invalid/
  );
  await assert.rejects(
    validateActiveTranscriptPointer(pointer, { projectId: "project_other" }),
    /pointer is invalid/
  );
});

test("validates a revision lineage against its exact parent", () => {
  const lineage = {
    transcriptId: "transcript_current",
    sourceAudioSha256: SOURCE,
    revisionSha256: REVISION,
    parentTranscriptId: "transcript_parent",
    parentRevisionSha256: PARENT_REVISION
  };
  assert.deepEqual(validateTranscriptRevisionLineage(lineage, {
    transcriptId: "transcript_parent",
    sourceAudioSha256: SOURCE,
    revisionSha256: PARENT_REVISION
  }), lineage);
  assert.throws(() => validateTranscriptRevisionLineage(lineage, {
    transcriptId: "transcript_other",
    sourceAudioSha256: SOURCE,
    revisionSha256: PARENT_REVISION
  }), /does not match/);
  assert.throws(() => validateTranscriptRevisionLineage({
    ...lineage,
    parentRevisionSha256: null
  }), /parent is invalid/);
});
