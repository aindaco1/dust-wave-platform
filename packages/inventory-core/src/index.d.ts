export type InventoryRecord = Record<string, Record<string, unknown>>;
export type CountMap = Record<string, number>;

export interface ReservationEntry {
  counts: CountMap;
  expiresAt: string;
}

export interface NormalizedInventoryState {
  inventory: InventoryRecord;
  reservations: Record<string, ReservationEntry>;
  updatedAt: string | null;
  cleanedExpiredReservations: boolean;
}

export function cloneInventory(inventory: unknown): InventoryRecord;
export function cloneReservations(reservations: unknown): Record<string, unknown>;
export function normalizeCountMap(map: unknown): CountMap;
export function getReservationCounts(reservation: unknown): CountMap;
export function getReservedCounts(
  reservations?: unknown,
  excludedReservationId?: string | null
): CountMap;
export function mergeBootstrapInventory(
  currentInventory?: unknown,
  bootstrapInventory?: unknown
): InventoryRecord;

export interface InventoryStateMechanics {
  readonly bootstrapStrategy: 'replace' | 'merge';
  readonly defaultReservationTtlSeconds: number;
  buildReservationEntry(
    counts: unknown,
    now?: number,
    ttlSeconds?: number
  ): ReservationEntry;
  normalizeReservationExpiry(reservation: unknown, now?: number): string | null;
  normalizeReservations(
    reservations: unknown,
    now?: number
  ): {
    reservations: Record<string, ReservationEntry>;
    cleanedExpiredReservations: boolean;
  };
  normalizeState(
    state: unknown,
    bootstrapInventory: unknown,
    now?: number
  ): NormalizedInventoryState;
}

export function createInventoryStateMechanics(options: {
  defaultReservationTtlSeconds: number;
  bootstrapStrategy?: 'replace' | 'merge';
}): InventoryStateMechanics;
