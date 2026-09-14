function utcDay(date) {
  return date.toISOString().slice(0, 10);
}

function utcMonth(date) {
  return date.toISOString().slice(0, 7);
}

function utcIsoWeek(date) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((value.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${value.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function retainBuckets(snapshots, count, keyFor, reason, retained) {
  if (count <= 0) return;
  const buckets = new Set();
  for (const snapshot of snapshots) {
    const key = keyFor(snapshot.createdAt);
    if (buckets.has(key)) continue;
    buckets.add(key);
    retained.get(snapshot.name).add(reason);
    if (buckets.size >= count) break;
  }
}

/** Plan over verified snapshot metadata; never discovers, reads or deletes files. */
export function planSnapshotRetention({ snapshots = [], retention: configured = {}, untouched = [], rootName = '', now = new Date() } = {}) {
  snapshots = [...snapshots].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  const retained = new Map(snapshots.map((snapshot) => [snapshot.name, new Set()]));
  if (snapshots.length) retained.get(snapshots[0].name).add('newest');
  retainBuckets(snapshots, Number(configured.daily || 0), utcDay, 'daily', retained);
  retainBuckets(snapshots, Number(configured.weekly || 0), utcIsoWeek, 'weekly', retained);
  retainBuckets(snapshots, Number(configured.monthly || 0), utcMonth, 'monthly', retained);
  if (configured.releaseSnapshots !== false) {
    for (const snapshot of snapshots.filter((entry) => entry.releaseSnapshot)) {
      retained.get(snapshot.name).add('release');
    }
  }

  const keep = snapshots.filter((snapshot) => retained.get(snapshot.name).size > 0).map((snapshot) => ({
    name: snapshot.name,
    createdAt: snapshot.createdAt.toISOString(),
    archiveBytes: snapshot.archiveBytes,
    reasons: Array.from(retained.get(snapshot.name)).sort()
  }));
  const prune = snapshots.filter((snapshot) => retained.get(snapshot.name).size === 0).map((snapshot) => ({
    name: snapshot.name,
    createdAt: snapshot.createdAt.toISOString(),
    archiveBytes: snapshot.archiveBytes
  }));
  return {
    schemaVersion: 1,
    plannedAt: now.toISOString(),
    rootName,
    retention: {
      daily: Number(configured.daily || 0),
      weekly: Number(configured.weekly || 0),
      monthly: Number(configured.monthly || 0),
      releaseSnapshots: configured.releaseSnapshots !== false
    },
    keep,
    prune,
    untouched: [...untouched].sort((left, right) => left.name.localeCompare(right.name)),
    bytesEligibleForPrune: prune.reduce((sum, snapshot) => sum + snapshot.archiveBytes, 0),
    containsCustomerData: false,
    executeByDefault: false
  };
}

function ageHours(timestamp, now = new Date()) {
  const parsed = Date.parse(String(timestamp || ''));
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, (now.getTime() - parsed) / (60 * 60 * 1000));
}

export function evidenceAgeCheck({ id, label, evidence, timestampFields, maxAgeHours, required, now = new Date() }) {
  if (!evidence) {
    return {
      id,
      status: required ? 'FAIL' : 'WARN',
      detail: `${label} evidence is unavailable`,
      ageHours: null,
      maxAgeHours
    };
  }
  const timestamp = timestampFields.map((field) => evidence[field]).find(Boolean);
  const age = ageHours(timestamp, now);
  if (age === null) {
    return {
      id,
      status: 'FAIL',
      detail: `${label} evidence has no valid timestamp`,
      ageHours: null,
      maxAgeHours
    };
  }
  return {
    id,
    status: age <= maxAgeHours ? 'PASS' : (required ? 'FAIL' : 'WARN'),
    detail: `${label} evidence age is ${age.toFixed(2)} hours`,
    ageHours: Number(age.toFixed(2)),
    maxAgeHours
  };
}

