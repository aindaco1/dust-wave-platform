export function stableOutboxStringify(value: unknown): string;
export function createOutboxJobId(input: { kind: string; dedupeKey?: string; payload?: unknown }): Promise<string>;
export function createOutboxJobRecord(input: {
  jobId: string; kind: string; payload: unknown; metadata?: Record<string, unknown>;
  existing?: Record<string, unknown> | null; now?: Date; expiresAt?: string; maxRecordBytes?: number;
}): { ok: true; jobId: string; record: Record<string, unknown>; serialized: string } | { ok: false; jobId: string; reason: string };
export function createOutboxQueueState(input: { hasPending: boolean; nextDueAt?: string; now?: Date }): { version: 1; hasPending: boolean; nextDueAt: string; updatedAt: string };
export function classifyOutboxJob(job: unknown, options?: { now?: Date; leaseMs?: number; terminalStatuses?: Set<string> | string[] }): { state: string; status?: string; nextDueAt?: string };
export function outboxRetryDelayMs(error: unknown, attempts: number, options?: { minimumMs?: number; maximumMs?: number; quotaTypes?: string[] }): number;
export function outboxDeliveryErrorEvidence(error: unknown, options?: { stage?: string }): { type: string; statusCode: number; stage?: string };
export function normalizeOutboxEmail(value?: unknown): string;
export function safeOutboxTagValue(value?: unknown): string;
export function outboxWebhookTags(data?: Record<string, unknown>): Record<string, string>;
export function outboxWebhookDeliveryStatus(type: unknown): string | null;
export function outboxWebhookShouldSuppress(event: unknown): boolean;
export function validOutboxJobId(value: unknown): boolean;
