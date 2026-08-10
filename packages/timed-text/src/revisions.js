import { canonicalAlignmentSha256 } from "./alignment.js";

export const ACTIVE_TRANSCRIPT_POINTER_SCHEMA =
  "active-reviewed-transcript-pointer-v1";

const DIGEST = /^[a-f0-9]{64}$/;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,179}$/;
const POINTER_KEYS = [
  "schemaVersion",
  "projectId",
  "sourceAudioSha256",
  "transcriptId",
  "parentTranscriptId",
  "revisionSha256",
  "updatedAt",
  "manifestSha256"
];
const LINEAGE_KEYS = [
  "transcriptId",
  "sourceAudioSha256",
  "revisionSha256",
  "parentTranscriptId",
  "parentRevisionSha256"
];

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} is invalid`);
  }
  const keys = Object.keys(value);
  if (keys.length !== expected.length
      || keys.some((key) => !expected.includes(key))) {
    throw new TypeError(`${label} fields are invalid`);
  }
}

function identifier(value, label) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) {
    throw new TypeError(`${label} is invalid`);
  }
  return value;
}

function digest(value, label) {
  if (typeof value !== "string" || !DIGEST.test(value)) {
    throw new TypeError(`${label} is invalid`);
  }
  return value;
}

function nullableIdentifier(value, label) {
  return value === null ? null : identifier(value, label);
}

function nullableDigest(value, label) {
  return value === null ? null : digest(value, label);
}

function timestamp(value) {
  if (typeof value !== "string" || value.length > 40
      || Number.isNaN(Date.parse(value))
      || new Date(value).toISOString() !== value) {
    throw new TypeError("active transcript pointer timestamp is invalid");
  }
  return value;
}

export function validateTranscriptRevisionLineage(value, parent = null) {
  exactKeys(value, LINEAGE_KEYS, "transcript revision lineage");
  const normalized = {
    transcriptId: identifier(value.transcriptId, "transcript revision ID"),
    sourceAudioSha256: digest(
      value.sourceAudioSha256,
      "transcript revision source SHA-256"
    ),
    revisionSha256: digest(
      value.revisionSha256,
      "transcript revision SHA-256"
    ),
    parentTranscriptId: nullableIdentifier(
      value.parentTranscriptId,
      "parent transcript revision ID"
    ),
    parentRevisionSha256: nullableDigest(
      value.parentRevisionSha256,
      "parent transcript revision SHA-256"
    )
  };
  if ((normalized.parentTranscriptId === null)
      !== (normalized.parentRevisionSha256 === null)
      || normalized.parentTranscriptId === normalized.transcriptId) {
    throw new TypeError("transcript revision parent is invalid");
  }
  if (parent !== null) {
    exactKeys(
      parent,
      ["transcriptId", "sourceAudioSha256", "revisionSha256"],
      "parent transcript revision"
    );
    if (normalized.parentTranscriptId !== identifier(
      parent.transcriptId,
      "parent transcript revision ID"
    ) || normalized.parentRevisionSha256 !== digest(
      parent.revisionSha256,
      "parent transcript revision SHA-256"
    ) || normalized.sourceAudioSha256 !== digest(
      parent.sourceAudioSha256,
      "parent transcript revision source SHA-256"
    )) {
      throw new TypeError("transcript revision lineage does not match its parent");
    }
  }
  return normalized;
}

export async function buildActiveTranscriptPointer({
  projectId,
  sourceAudioSha256,
  transcriptId,
  parentTranscriptId = null,
  revisionSha256,
  updatedAt = new Date().toISOString()
}) {
  const body = {
    schemaVersion: ACTIVE_TRANSCRIPT_POINTER_SCHEMA,
    projectId: identifier(projectId, "active transcript pointer project ID"),
    sourceAudioSha256: digest(
      sourceAudioSha256,
      "active transcript pointer source SHA-256"
    ),
    transcriptId: identifier(
      transcriptId,
      "active transcript pointer transcript ID"
    ),
    parentTranscriptId: nullableIdentifier(
      parentTranscriptId,
      "active transcript pointer parent transcript ID"
    ),
    revisionSha256: digest(
      revisionSha256,
      "active transcript pointer revision SHA-256"
    ),
    updatedAt: timestamp(updatedAt)
  };
  if (body.parentTranscriptId === body.transcriptId) {
    throw new TypeError("active transcript pointer parent is invalid");
  }
  return {
    ...body,
    manifestSha256: await canonicalAlignmentSha256(body)
  };
}

export async function validateActiveTranscriptPointer(value, expected = {}) {
  exactKeys(value, POINTER_KEYS, "active transcript pointer");
  if (!expected || typeof expected !== "object" || Array.isArray(expected)
      || Object.keys(expected).some((key) => ![
        "projectId", "sourceAudioSha256"
      ].includes(key))) {
    throw new TypeError("active transcript pointer expectations are invalid");
  }
  const rebuilt = await buildActiveTranscriptPointer({
    projectId: value.projectId,
    sourceAudioSha256: value.sourceAudioSha256,
    transcriptId: value.transcriptId,
    parentTranscriptId: value.parentTranscriptId,
    revisionSha256: value.revisionSha256,
    updatedAt: value.updatedAt
  });
  if (value.schemaVersion !== ACTIVE_TRANSCRIPT_POINTER_SCHEMA
      || !DIGEST.test(String(value.manifestSha256))
      || rebuilt.manifestSha256 !== value.manifestSha256
      || (expected.projectId !== undefined
        && rebuilt.projectId !== identifier(expected.projectId, "expected project ID"))
      || (expected.sourceAudioSha256 !== undefined
        && rebuilt.sourceAudioSha256 !== digest(
          expected.sourceAudioSha256,
          "expected source SHA-256"
        ))) {
    throw new TypeError("active transcript pointer is invalid");
  }
  return rebuilt;
}
