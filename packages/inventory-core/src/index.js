export function cloneInventory(inventory) {
  return JSON.parse(JSON.stringify(inventory || {}));
}

export function cloneReservations(reservations) {
  return JSON.parse(JSON.stringify(reservations || {}));
}

export function normalizeCountMap(map) {
  const normalized = {};
  for (const [key, value] of Object.entries(map || {})) {
    const qty = Number(value || 0);
    if (!key || !Number.isFinite(qty) || qty < 0) continue;
    normalized[key] = Math.floor(qty);
  }
  return normalized;
}

export function getReservationCounts(reservation) {
  if (!reservation || typeof reservation !== 'object') return {};
  if (reservation.counts && typeof reservation.counts === 'object') {
    return normalizeCountMap(reservation.counts);
  }
  return normalizeCountMap(reservation);
}

export function getReservedCounts(
  reservations = {},
  excludedReservationId = null
) {
  const counts = {};
  for (const [reservationId, reservation] of Object.entries(reservations || {})) {
    if (excludedReservationId && reservationId === excludedReservationId) continue;
    for (const [itemId, qty] of Object.entries(getReservationCounts(reservation))) {
      counts[itemId] = (counts[itemId] || 0) + qty;
    }
  }
  return counts;
}

export function mergeBootstrapInventory(
  currentInventory = {},
  bootstrapInventory = {}
) {
  const current = cloneInventory(currentInventory || {});
  const bootstrap = cloneInventory(bootstrapInventory || {});
  if (Object.keys(bootstrap).length === 0) return current;

  for (const [itemId, bootstrapEntry] of Object.entries(bootstrap)) {
    const currentEntry = current[itemId] || {};
    current[itemId] = {
      ...bootstrapEntry,
      claimed: Math.max(
        0,
        Number(currentEntry.claimed ?? bootstrapEntry.claimed ?? 0) || 0
      )
    };
  }
  return current;
}

export function createInventoryStateMechanics({
  defaultReservationTtlSeconds,
  bootstrapStrategy = 'replace'
} = {}) {
  if (
    !Number.isSafeInteger(defaultReservationTtlSeconds)
    || defaultReservationTtlSeconds <= 0
  ) {
    throw new TypeError('defaultReservationTtlSeconds must be a positive integer');
  }
  if (!['replace', 'merge'].includes(bootstrapStrategy)) {
    throw new TypeError('bootstrapStrategy must be replace or merge');
  }

  function buildReservationEntry(
    counts,
    now = Date.now(),
    ttlSeconds = defaultReservationTtlSeconds
  ) {
    const ttl = Number.isFinite(ttlSeconds) && ttlSeconds > 0
      ? Math.floor(ttlSeconds)
      : defaultReservationTtlSeconds;
    return {
      counts: normalizeCountMap(counts),
      expiresAt: new Date(now + (ttl * 1000)).toISOString()
    };
  }

  function normalizeReservationExpiry(reservation, now = Date.now()) {
    const rawExpiresAt = typeof reservation?.expiresAt === 'string'
      ? reservation.expiresAt
      : '';
    const parsed = rawExpiresAt ? Date.parse(rawExpiresAt) : NaN;
    const expiryMs = Number.isFinite(parsed)
      ? parsed
      : now + (defaultReservationTtlSeconds * 1000);
    if (expiryMs <= now) return null;
    return new Date(expiryMs).toISOString();
  }

  function normalizeReservations(reservations, now = Date.now()) {
    const normalized = {};
    let cleanedExpiredReservations = false;

    for (const [reservationId, reservation] of Object.entries(reservations || {})) {
      if (!reservationId) continue;
      const counts = getReservationCounts(reservation);
      if (Object.keys(counts).length === 0) continue;

      const expiresAt = normalizeReservationExpiry(reservation, now);
      if (!expiresAt) {
        cleanedExpiredReservations = true;
        continue;
      }
      normalized[reservationId] = { counts, expiresAt };
    }
    return { reservations: normalized, cleanedExpiredReservations };
  }

  function normalizeState(state, bootstrapInventory, now = Date.now()) {
    const inventory = bootstrapStrategy === 'merge'
      ? mergeBootstrapInventory(state?.inventory || {}, bootstrapInventory || {})
      : cloneInventory(state?.inventory || bootstrapInventory || {});
    const { reservations, cleanedExpiredReservations } = normalizeReservations(
      state?.reservations || {},
      now
    );
    return {
      inventory,
      reservations,
      updatedAt: typeof state?.updatedAt === 'string' ? state.updatedAt : null,
      cleanedExpiredReservations
    };
  }

  return Object.freeze({
    bootstrapStrategy,
    buildReservationEntry,
    defaultReservationTtlSeconds,
    normalizeReservationExpiry,
    normalizeReservations,
    normalizeState
  });
}
