import { writeFile } from 'node:fs/promises';

export const DEFAULT_NM_GRT_API_BASE = 'https://grt.edacnm.org';

export const NM_GRT_STARTER_ADDRESSES = Object.freeze([
  {
    city: 'Albuquerque',
    county: 'Bernalillo',
    postalCode: '87193',
    street_number: '65432',
    street_name: 'PO BOX'
  },
  {
    city: 'Santa Fe',
    county: 'Santa Fe',
    postalCode: '87501',
    street_number: '1',
    street_name: 'Mansion',
    street_suffix: 'Dr'
  },
  {
    city: 'Los Alamos',
    county: 'Los Alamos',
    postalCode: '87544',
    street_number: '1',
    street_name: 'PO BOX'
  },
  {
    city: 'Española',
    county: 'Rio Arriba',
    postalCode: '87532',
    street_number: '1',
    street_name: 'PO BOX'
  },
  {
    city: 'Taos',
    county: 'Taos',
    postalCode: '87571',
    street_number: '1',
    street_name: 'PO BOX'
  }
]);

function normalizeCityAliases(city) {
  const ascii = String(city || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
  const original = String(city || '').trim().toUpperCase();
  return Array.from(new Set([ascii, original])).filter(Boolean);
}

export async function lookupNmGrtAddress(
  apiBase,
  seed,
  fetchImpl = globalThis.fetch
) {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('fetchImpl must be a function');
  }
  const params = new URLSearchParams({
    street_number: seed.street_number,
    street_name: seed.street_name,
    city: seed.city,
    zipcode: seed.postalCode,
    county: seed.county
  });
  if (seed.street_suffix) params.set('street_suffix', seed.street_suffix);
  if (seed.street_post_directional) params.set('street_post_directional', seed.street_post_directional);
  if (seed.pre_direction) params.set('pre_direction', seed.pre_direction);

  const response = await fetchImpl(
    `${apiBase.replace(/\/+$/, '')}/api/by_address?${params.toString()}`,
    { headers: { Accept: 'application/json' } }
  );
  if (!response.ok) {
    throw new Error(`Lookup failed for ${seed.city} ${seed.postalCode}: ${response.status}`);
  }
  const payload = await response.json();
  const result = Array.isArray(payload?.results) ? payload.results[0] : null;
  if (!result || result.success !== true) {
    throw new Error(`No successful result for ${seed.city} ${seed.postalCode}`);
  }

  return {
    city: normalizeCityAliases(seed.city)[0] === String(seed.city || '').trim().toUpperCase()
      ? seed.city
      : seed.city.normalize('NFD').replace(/\p{Diacritic}/gu, ''),
    cityAliases: normalizeCityAliases(seed.city),
    county: seed.county,
    postalCodes: [seed.postalCode],
    locationCode: String(result.location_code || '').trim(),
    effectiveRate: Math.max(0, Number(result.tax_rate) || 0) / 100,
    source: String(result.source || '').trim() || 'Unknown',
    sampleAddress: {
      street_number: seed.street_number,
      street_name: seed.street_name,
      ...(seed.street_suffix ? { street_suffix: seed.street_suffix } : {}),
      ...(seed.street_post_directional ? { street_post_directional: seed.street_post_directional } : {}),
      ...(seed.pre_direction ? { pre_direction: seed.pre_direction } : {}),
      city: seed.city,
      zipcode: seed.postalCode,
      county: seed.county
    }
  };
}

export function renderNmGrtStarterModule(entries, apiBase, generatedAt) {
  return `export const NM_GRT_STARTER_METADATA = ${JSON.stringify({
    generatedAt,
    source: `${apiBase.replace(/\/+$/, '')}/api/by_address`,
    notes: 'Starter New Mexico GRT reference locations harvested from the public EDAC API. Rates are percentages and should be refreshed over time.'
  }, null, 2)};

export const NM_GRT_STARTER_LOCATIONS = ${JSON.stringify(entries, null, 2)};
`;
}

export async function updateNmGrtStarter({
  apiBase = DEFAULT_NM_GRT_API_BASE,
  outputPath,
  seeds = NM_GRT_STARTER_ADDRESSES,
  fetchImpl = globalThis.fetch,
  writeFileImpl = writeFile,
  generatedAt = new Date().toISOString().slice(0, 10)
} = {}) {
  if (!outputPath || typeof outputPath !== 'string') {
    throw new TypeError('outputPath is required');
  }
  if (typeof writeFileImpl !== 'function') {
    throw new TypeError('writeFileImpl must be a function');
  }

  const entries = [];
  for (const seed of seeds) {
    entries.push(await lookupNmGrtAddress(apiBase, seed, fetchImpl));
  }

  const source = renderNmGrtStarterModule(entries, apiBase, generatedAt);
  await writeFileImpl(outputPath, source, 'utf8');
  return { entries, generatedAt, outputPath, source };
}
