export const ACTIVE_TRANSCRIPT_POINTER_SCHEMA:
  "active-reviewed-transcript-pointer-v1";

export interface TranscriptRevisionLineage {
  transcriptId: string;
  sourceAudioSha256: string;
  revisionSha256: string;
  parentTranscriptId: string | null;
  parentRevisionSha256: string | null;
}

export interface ActiveTranscriptPointer {
  schemaVersion: typeof ACTIVE_TRANSCRIPT_POINTER_SCHEMA;
  projectId: string;
  sourceAudioSha256: string;
  transcriptId: string;
  parentTranscriptId: string | null;
  revisionSha256: string;
  updatedAt: string;
  manifestSha256: string;
}

export function validateTranscriptRevisionLineage(
  value: TranscriptRevisionLineage,
  parent?: {
    transcriptId: string;
    sourceAudioSha256: string;
    revisionSha256: string;
  } | null
): TranscriptRevisionLineage;

export function buildActiveTranscriptPointer(input: {
  projectId: string;
  sourceAudioSha256: string;
  transcriptId: string;
  parentTranscriptId?: string | null;
  revisionSha256: string;
  updatedAt?: string;
}): Promise<ActiveTranscriptPointer>;

export function validateActiveTranscriptPointer(
  value: unknown,
  expected?: {
    projectId?: string;
    sourceAudioSha256?: string;
  }
): Promise<ActiveTranscriptPointer>;
