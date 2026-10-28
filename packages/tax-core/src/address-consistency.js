import reference from '../data/us-postal.json' with { type: 'json' };

const comparable = (value) => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const stateCodes = new Map(Object.entries(reference.states).flatMap(([code, name]) => [[comparable(code), code], [comparable(name), code]]));

export function normalizeUsState(value) {
  return stateCodes.get(comparable(value)) || String(value || '').trim().toUpperCase();
}

// Postal consistency only: unknown ZIPs are not invalid, and mailing-city
// aliases are suggestions, never payment blockers. No street verification.
export function checkAddressConsistency(address = {}) {
  const country = String(address?.country || address?.countryCode || '').trim().toUpperCase();
  const postal = String(address?.postalCode || address?.postal_code || '').trim();
  const entries = country === 'US' && /^\d{5}(?:-\d{4})?$/.test(postal) ? reference.postals[postal.slice(0, 5)] : null;
  if (!entries) return { checked: false, stateMismatch: false };
  const states = Object.keys(entries);
  const state = normalizeUsState(address.state || address.province || address.region || address.stateCode);
  const cities = entries[state] || Object.values(entries).flat();
  const city = comparable(address.city);
  return {
    checked: true, postalCode: postal.slice(0, 5), states,
    stateMismatch: Boolean(state && !states.includes(state)),
    suggestedCity: city && !cities.some((name) => comparable(name) === city) ? cities[0] : ''
  };
}

export function getAddressConsistencyError(address) {
  const result = checkAddressConsistency(address);
  return result.stateMismatch ? `ZIP code ${result.postalCode} belongs to ${result.states.join(' / ')}. Check the ZIP code or state.` : '';
}
