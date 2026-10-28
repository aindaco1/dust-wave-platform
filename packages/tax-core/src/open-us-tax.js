// Conservative ZIP-level adapter. Data licensing/provenance: data/open-us-tax.NOTICE.
// This is a general-rate estimate, not an address geocoder or a taxability/nexus engine.
import snapshot from '../data/open-us-tax.json' with { type: 'json' };

export function resolveOpenUsTax(postalCode, { data = snapshot, now = Date.now() } = {}) {
  const today = new Date(now).toISOString().slice(0, 10);
  const updated = Date.parse(data.sourceUpdatedAt);
  if (data.schemaVersion !== 1 || !data.sourceUpdatedAt ||
      !Number.isFinite(updated) || now < updated || now >= updated + 90 * 86400000) return null;
  const zip = String(postalCode || '').match(/^(\d{5})(?:-\d{4})?$/)?.[1];
  const ids = zip && data.zipCodes[zip];
  if (!ids?.length) return null;
  const components = [];
  for (const id of ids) {
    const authority = data.authorities[id];
    if (!authority) return null;
    const active = authority.rates.filter(([rate, from, to]) => from <= today && (!to || to >= today));
    if (active.length !== 1) return null;
    const rate = active[0][0];
    if (!Number.isSafeInteger(rate) || rate < 0 || rate > 250000) return null;
    components.push({ state: authority.state, label: authority.name, type: authority.type, rate });
  }
  // Never choose the most common city/county or add competing jurisdictions together.
  const positive = components.filter((entry) => entry.rate > 0);
  if (new Set(components.map((entry) => entry.state)).size !== 1 ||
      components.filter((entry) => entry.type === 'state').length !== 1 ||
      ['county', 'city'].some((type) => positive.filter((entry) => entry.type === type).length > 1) ||
      !positive.some((entry) => entry.type !== 'state')) return null;
  // In these SST states the city rate already includes the county portion.
  if (['TN', 'WA'].includes(components[0].state) &&
      positive.some((entry) => entry.type === 'city') && positive.some((entry) => entry.type === 'county')) return null;
  const ratePartsPerMillion = positive.reduce((sum, entry) => sum + entry.rate, 0);
  if (ratePartsPerMillion > 250000) return null;
  return { state: components[0].state, ratePartsPerMillion, components: positive,
    dataVersion: `${data.release}:${data.sha256}`, sourceUpdatedAt: data.sourceUpdatedAt };
}

export function buildOpenUsTaxQuote({ destination, subtotalCents, shippingCents = 0, directCharge = true, now = Date.now() }) {
  if (destination?.country !== 'US') return null;
  const local = resolveOpenUsTax(destination.postalCode, { now });
  if (!local || (destination.state && destination.state !== local.state)) return null;
  const taxableSubtotalCents = Math.max(0, Number(subtotalCents) || 0);
  let cumulativeRate = 0, allocatedTaxCents = 0;
  const breakdown = local.components.map((entry) => {
    cumulativeRate += directCharge ? entry.rate : 0;
    const cumulativeTaxCents = Math.round(taxableSubtotalCents * cumulativeRate / 1_000_000);
    const taxCents = cumulativeTaxCents - allocatedTaxCents;
    allocatedTaxCents = cumulativeTaxCents;
    return { label: entry.label, rate: directCharge ? entry.rate / 1_000_000 : 0,
      taxableSubtotalCents, taxableShippingCents: 0, taxCents };
  });
  return { provider: 'open_us', source: 'opensalestax_zip_snapshot', estimated: true, coverage: 'zip_local',
    dataVersion: local.dataVersion, sourceUpdatedAt: local.sourceUpdatedAt,
    taxCents: allocatedTaxCents, effectiveRate: directCharge ? local.ratePartsPerMillion / 1_000_000 : 0,
    taxableSubtotalCents, taxableShippingCents: 0, shippingTaxed: false, destination,
    jurisdiction: { country: 'US', state: local.state, postalCode: destination.postalCode, type: 'zip_local' },
    shippingCents: Math.max(0, Number(shippingCents) || 0), breakdown };
}
