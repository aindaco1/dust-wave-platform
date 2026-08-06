import { fetchWithTimeout } from '../../worker-core/src/provider-fetch.js';

const MAX_MAIL_CLASSES = 32;
const MAX_ACCESS_TOKEN_LENGTH = 8_192;

export function createUspsRateClient({
  resolveConfig,
  domesticMailClasses,
  internationalMailClasses,
  fetchTarget = (...args) => globalThis.fetch(...args),
  now = () => Date.now(),
  maximumCacheEntries = 256
} = {}) {
  if (typeof resolveConfig !== 'function') {
    throw new TypeError('resolveConfig must be a function');
  }
  if (typeof fetchTarget !== 'function') {
    throw new TypeError('fetchTarget must be a function');
  }
  if (typeof now !== 'function') throw new TypeError('now must be a function');
  if (!Number.isSafeInteger(maximumCacheEntries) || maximumCacheEntries < 1) {
    throw new TypeError('maximumCacheEntries must be a positive integer');
  }

  const defaultDomesticMailClasses = normalizeMailClasses(
    domesticMailClasses,
    'domesticMailClasses'
  );
  const defaultInternationalMailClasses = normalizeMailClasses(
    internationalMailClasses,
    'internationalMailClasses'
  );
  let cachedToken = null;
  let cachedQuoteResults = new Map();
  let backoffUntil = 0;
  let backoffReason = '';

  function reset() {
    cachedToken = null;
    cachedQuoteResults = new Map();
    backoffUntil = 0;
    backoffReason = '';
  }

  function configFor(context) {
    const value = resolveConfig(context);
    if (!value || typeof value !== 'object') {
      throw new TypeError('resolveConfig must return an object');
    }
    return value;
  }

  function hasCredentials(config) {
    return Boolean(
      config.enabled
      && String(config.clientId || '').trim()
      && String(config.clientSecret || '').trim()
    );
  }

  function buildDomesticPayload(config, destination, shipment, mailClass) {
    const profile = shipment?.uspsDomesticProfile
      && typeof shipment.uspsDomesticProfile === 'object'
      ? shipment.uspsDomesticProfile
      : null;
    return {
      originZIPCode: normalizeUsZip(config.originZip),
      destinationZIPCode: normalizeUsZip(destination.postalCode),
      weight: ouncesToPounds(shipment.weightOz),
      length: shipment.lengthIn,
      width: shipment.widthIn,
      height: shipment.heightIn,
      mailClass,
      processingCategory: profile?.processingCategory || 'MACHINABLE',
      destinationEntryFacilityType: profile?.destinationEntryFacilityType || 'NONE',
      rateIndicator: profile?.rateIndicator || 'DR',
      priceType: profile?.priceType || 'RETAIL',
      mailingDate: new Date(now()).toISOString().slice(0, 10)
    };
  }

  function buildInternationalPayload(config, destination, shipment, mailClass) {
    return {
      originZIPCode: normalizeUsZip(config.originZip),
      foreignPostalCode: normalizeIntlPostalCode(destination.postalCode),
      destinationCountryCode: destination.country,
      weight: ouncesToPounds(shipment.weightOz),
      length: shipment.lengthIn,
      width: shipment.widthIn,
      height: shipment.heightIn,
      mailClass,
      processingCategory: 'NON_MACHINABLE',
      destinationEntryFacilityType: 'NONE',
      rateIndicator: 'SP',
      priceType: 'RETAIL',
      mailingDate: new Date(now()).toISOString().slice(0, 10)
    };
  }

  async function quote(context, destination, shipment) {
    const config = configFor(context);
    if (!hasCredentials(config)) {
      return { valid: false, error: 'USPS credentials unavailable' };
    }

    const cachedQuote = getCachedQuote(config, destination, shipment);
    if (cachedQuote) return cachedQuote;

    const activeBackoff = getBackoff();
    if (activeBackoff.active) {
      return {
        valid: false,
        error: activeBackoff.reason || 'USPS temporarily unavailable'
      };
    }

    const domestic = destination.country === config.originCountry;
    const shipmentMailClasses = shipment?.uspsDomesticProfile?.mailClasses;
    const domesticClasses = Array.isArray(shipmentMailClasses)
      && shipmentMailClasses.length > 0
      ? normalizeMailClasses(shipmentMailClasses, 'shipment mailClasses')
      : defaultDomesticMailClasses;
    const quoteSearch = domestic
      ? await searchRates(
          config,
          domesticClasses,
          (mailClass) => buildDomesticPayload(config, destination, shipment, mailClass)
        )
      : await searchRates(
          config,
          defaultInternationalMailClasses,
          (mailClass) => buildInternationalPayload(config, destination, shipment, mailClass)
        );

    if (!quoteSearch.valid) return quoteSearch;
    clearBackoff();
    const result = {
      valid: true,
      quote: {
        shippingCents: quoteSearch.quote.shippingCents,
        source: 'usps_live',
        carrier: 'usps',
        service: quoteSearch.quote.service,
        domestic
      }
    };
    setCachedQuote(config, destination, shipment, result);
    return result;
  }

  async function searchRates(config, mailClasses, buildPayload) {
    let firstError = null;
    for (const mailClass of mailClasses) {
      try {
        const result = await requestRate(config, buildPayload(mailClass), mailClass);
        if (result.valid) return result;
        firstError = firstError || result;
        if (getBackoff().active) return firstError;
      } catch (error) {
        armBackoff(
          config.failureCooldownMs,
          error?.message || 'USPS pricing failed'
        );
        firstError = firstError || {
          valid: false,
          error: error?.message || 'USPS pricing failed'
        };
        if (getBackoff().active) return firstError;
      }
    }
    return firstError || { valid: false, error: 'No USPS rates available' };
  }

  async function requestRate(config, payload, mailClass) {
    const baseUrl = String(config.apiBase || '').replace(/\/+$/, '');
    const domestic = payload.destinationZIPCode !== undefined;
    const endpoint = domestic
      ? `${baseUrl}/prices/v3/base-rates/search`
      : `${baseUrl}/international-prices/v3/base-rates/search`;
    let response = await performRateRequest(config, endpoint, payload);
    if (response.status === 401) {
      cachedToken = null;
      response = await performRateRequest(config, endpoint, payload);
    }

    if (!response.ok) {
      if (response.status === 429) {
        armBackoff(config.rateLimitCooldownMs, 'USPS rate limit reached');
      } else if (response.status >= 500) {
        armBackoff(
          config.failureCooldownMs,
          `USPS ${mailClass} temporarily unavailable`
        );
      }
      return {
        valid: false,
        error: `USPS ${mailClass} quote failed with ${response.status}`
      };
    }

    const body = await response.json().catch(() => null);
    const amount = getUspsPriceFromResponse(body);
    if (!(Number.isFinite(amount) && amount >= 0)) {
      return {
        valid: false,
        error: `USPS ${mailClass} quote was missing a price`
      };
    }
    return {
      valid: true,
      quote: {
        shippingCents: Math.round(amount * 100),
        service: getPreferredUspsService(body, mailClass)
      }
    };
  }

  async function getAccessToken(config) {
    const baseUrl = String(config.apiBase || '').replace(/\/+$/, '');
    const clientId = String(config.clientId || '').trim();
    const timestamp = now();
    if (
      cachedToken
      && cachedToken.baseUrl === baseUrl
      && cachedToken.clientId === clientId
      && cachedToken.expiresAt > timestamp + 60_000
    ) {
      return cachedToken.token;
    }

    const response = await fetchJsonWithTimeout(
      config,
      `${baseUrl}/oauth2/v3/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: String(config.clientSecret || ''),
          grant_type: 'client_credentials'
        })
      }
    );
    if (!response.ok) {
      if (response.status === 429) {
        armBackoff(config.rateLimitCooldownMs, 'USPS OAuth rate limit reached');
      } else if (response.status >= 500) {
        armBackoff(config.failureCooldownMs, 'USPS OAuth temporarily unavailable');
      }
      throw new Error(`USPS OAuth failed with ${response.status}`);
    }

    const body = await response.json().catch(() => null);
    const token = String(body?.access_token || '').trim();
    const expiresInSeconds = Number(body?.expires_in);
    if (!token || token.length > MAX_ACCESS_TOKEN_LENGTH) {
      throw new Error('USPS OAuth response did not include an access token');
    }
    cachedToken = {
      token,
      baseUrl,
      clientId,
      expiresAt: timestamp + (
        (Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
          ? expiresInSeconds
          : 300) * 1000
      )
    };
    return token;
  }

  async function fetchJsonWithTimeout(config, url, init) {
    try {
      return await fetchWithTimeout(url, init, config.timeoutMs, { fetchTarget });
    } catch (error) {
      if (error?.name === 'AbortError') {
        armBackoff(config.failureCooldownMs, 'USPS request timed out');
      }
      throw error;
    }
  }

  async function performRateRequest(config, endpoint, payload) {
    const token = await getAccessToken(config);
    return fetchJsonWithTimeout(config, endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
  }

  function quoteCacheKey(config, destination, shipment) {
    return JSON.stringify({
      apiBase: config.apiBase,
      originZip: config.originZip,
      originCountry: config.originCountry,
      destinationCountry: destination?.country || '',
      destinationPostalCode: destination?.postalCode || '',
      weightOz: Number(shipment?.weightOz || 0),
      lengthIn: Number(shipment?.lengthIn || 0),
      widthIn: Number(shipment?.widthIn || 0),
      heightIn: Number(shipment?.heightIn || 0),
      tierIds: Array.isArray(shipment?.tierIds) ? shipment.tierIds : [],
      supportItemIds: Array.isArray(shipment?.supportItemIds)
        ? shipment.supportItemIds
        : [],
      addOnIds: Array.isArray(shipment?.addOnIds) ? shipment.addOnIds : [],
      uspsDomesticProfile: shipment?.uspsDomesticProfile
        ? JSON.stringify(shipment.uspsDomesticProfile)
        : ''
    });
  }

  function getCachedQuote(config, destination, shipment) {
    if (!(config.quoteCacheTtlMs > 0)) return null;
    const key = quoteCacheKey(config, destination, shipment);
    const cached = cachedQuoteResults.get(key);
    if (!cached) return null;
    if (cached.expiresAt <= now()) {
      cachedQuoteResults.delete(key);
      return null;
    }
    return cached.result;
  }

  function setCachedQuote(config, destination, shipment, result) {
    if (!(config.quoteCacheTtlMs > 0)) return;
    const key = quoteCacheKey(config, destination, shipment);
    if (!cachedQuoteResults.has(key) && cachedQuoteResults.size >= maximumCacheEntries) {
      cachedQuoteResults.delete(cachedQuoteResults.keys().next().value);
    }
    cachedQuoteResults.set(key, {
      expiresAt: now() + config.quoteCacheTtlMs,
      result
    });
  }

  function armBackoff(durationMs, reason) {
    if (!(Number.isFinite(durationMs) && durationMs > 0)) return;
    const until = now() + durationMs;
    if (until > backoffUntil) {
      backoffUntil = until;
      backoffReason = String(reason || '').trim();
    }
  }

  function clearBackoff() {
    backoffUntil = 0;
    backoffReason = '';
  }

  function getBackoff() {
    if (backoffUntil > now()) return { active: true, reason: backoffReason };
    if (backoffUntil > 0) clearBackoff();
    return { active: false, reason: '' };
  }

  return Object.freeze({ quote, reset });
}

function normalizeMailClasses(value, label) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_MAIL_CLASSES) {
    throw new TypeError(`${label} must contain 1 to ${MAX_MAIL_CLASSES} values`);
  }
  return Object.freeze(value.map((entry) => {
    const normalized = String(entry || '').trim();
    if (!normalized || normalized.length > 120) {
      throw new TypeError(`${label} contains an invalid value`);
    }
    return normalized;
  }));
}

function getPreferredUspsService(body, fallbackMailClass) {
  const rate = Array.isArray(body?.rates) ? body.rates[0] : null;
  const mailClass = String(rate?.mailClass || fallbackMailClass || '')
    .trim()
    .toLowerCase();
  const description = String(rate?.description || '').trim().toLowerCase();
  if (mailClass.includes('ground')) return 'usps_ground_advantage';
  if (mailClass.includes('first-class') || description.includes('first-class')) {
    return 'usps_first_class_package_international';
  }
  if (mailClass.includes('priority')) return 'usps_priority_mail';
  return mailClass || 'usps_rate';
}

function getUspsPriceFromResponse(body) {
  if (Number.isFinite(Number(body?.totalBasePrice))) {
    return Number(body.totalBasePrice);
  }
  if (Array.isArray(body?.rates) && body.rates.length > 0) {
    const prices = body.rates
      .map((rate) => Number(rate?.price))
      .filter((price) => Number.isFinite(price) && price >= 0);
    if (prices.length > 0) return Math.min(...prices);
  }
  return null;
}

function ouncesToPounds(weightOz) {
  const normalized = Number(weightOz);
  if (!(Number.isFinite(normalized) && normalized > 0)) return 0;
  return Math.max(0.0625, Number((normalized / 16).toFixed(4)));
}

function normalizeUsZip(value) {
  return String(value || '').trim().replace(/[^0-9]/g, '').slice(0, 5);
}

function normalizeIntlPostalCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
}
