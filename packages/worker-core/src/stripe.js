export const DEFAULT_STRIPE_API_VERSION = '2026-06-24.dahlia';

export class StripeApiError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'StripeApiError';
    this.type = details.type || 'stripe_api_error';
    this.code = details.code || '';
    this.declineCode = details.declineCode || '';
    this.statusCode = Number(details.statusCode || 0) || 0;
    this.requestId = details.requestId || '';
    this.objectId = details.objectId || '';
    this.retryable = details.retryable === true;
  }
}

function arrayBufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(left, right) {
  const candidate = String(left || '');
  const expected = String(right || '');
  let difference = candidate.length ^ expected.length;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= (candidate.charCodeAt(index) || 0) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

export async function verifyStripeSignature(
  payload,
  signatureHeader,
  secret,
  { toleranceSeconds = 300, nowSeconds = Math.floor(Date.now() / 1000) } = {}
) {
  if (!signatureHeader || !secret) {
    return { valid: false, error: 'Missing signature or secret' };
  }
  const parts = String(signatureHeader).split(',');
  const timestampText = parts.find((part) => part.startsWith('t='))?.slice(2);
  const signatures = parts
    .filter((part) => part.startsWith('v1='))
    .map((part) => part.slice(3));
  if (!/^\d+$/.test(timestampText || '') || signatures.length === 0) {
    return { valid: false, error: 'Invalid signature format' };
  }
  const timestamp = Number(timestampText);
  if (!Number.isSafeInteger(timestamp)) {
    return { valid: false, error: 'Invalid signature format' };
  }
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    return { valid: false, error: 'Timestamp outside tolerance' };
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`)
  );
  const expected = arrayBufferToHex(signature);
  return {
    valid: signatures.some((candidate) => timingSafeEqual(candidate, expected)),
    timestamp
  };
}

function flattenObject(object, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(object ?? {})) {
    if (value === undefined || value === null) continue;
    const path = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          Object.assign(result, flattenObject(item, `${path}[${index}]`));
        } else {
          result[`${path}[${index}]`] = String(item);
        }
      });
    } else if (typeof value === 'object') {
      Object.assign(result, flattenObject(value, path));
    } else {
      result[path] = String(value);
    }
  }
  return result;
}

function stripePathId(value) {
  const id = String(value || '').trim();
  if (!id) throw new TypeError('A Stripe object ID is required');
  return encodeURIComponent(id);
}

function isRetryableResponse(response) {
  const stripeShouldRetry = String(response.headers.get('stripe-should-retry') || '').toLowerCase();
  if (stripeShouldRetry === 'true') return true;
  if (stripeShouldRetry === 'false') return false;
  return response.status === 409 || response.status === 429 || response.status >= 500;
}

export function createStripeClient(secretKey, clientOptions = {}) {
  if (!secretKey) throw new Error('Stripe API key is required');
  const baseUrl = String(clientOptions.baseUrl || 'https://api.stripe.com/v1').replace(/\/$/, '');
  const userAgent = String(clientOptions.userAgent || 'dust-wave-worker-core/0.6.0');
  const fetchImplementation = clientOptions.fetchImplementation
    || globalThis.fetch?.bind(globalThis);
  if (typeof fetchImplementation !== 'function') {
    throw new TypeError('A fetch implementation is required');
  }

  async function notifyRequest(event) {
    try {
      await clientOptions.onRequest?.(event);
    } catch {
      // Observability must never change billing behavior.
    }
  }

  async function request(method, path, data = null, requestOptions = {}) {
    const query = method === 'GET' && data
      ? new URLSearchParams(flattenObject(data)).toString()
      : '';
    const normalizedPath = String(path).split('?')[0];
    const responsePath = query ? `${path}${String(path).includes('?') ? '&' : '?'}${query}` : path;
    const stripeVersion = requestOptions.stripeVersion
      || clientOptions.stripeVersion
      || DEFAULT_STRIPE_API_VERSION;
    const headers = {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': stripeVersion,
      'User-Agent': userAgent
    };
    if (method === 'POST' && requestOptions.idempotencyKey) {
      headers['Idempotency-Key'] = String(requestOptions.idempotencyKey);
    }

    let response;
    let payload = {};
    try {
      response = await fetchImplementation(`${baseUrl}${responsePath}`, {
        method,
        headers,
        ...(method !== 'GET' && data
          ? { body: new URLSearchParams(flattenObject(data)).toString() }
          : {})
      });
      payload = await response.json().catch(() => ({}));
    } catch {
      const error = new StripeApiError(
        'Stripe API request failed before a response was received',
        { type: 'network_error', retryable: true }
      );
      await notifyRequest({
        method,
        path: normalizedPath,
        idempotencyKey: String(requestOptions.idempotencyKey || ''),
        stripeVersion,
        success: false,
        status: 0,
        errorType: error.type,
        retryable: true
      });
      throw error;
    }

    const retryable = response.ok ? false : isRetryableResponse(response);
    const requestEvent = {
      method,
      path: normalizedPath,
      idempotencyKey: String(requestOptions.idempotencyKey || ''),
      stripeVersion,
      success: response.ok,
      status: response.status,
      requestId: String(response.headers.get('request-id') || ''),
      objectId: String(payload?.id || ''),
      objectType: String(payload?.object || ''),
      errorType: String(payload?.error?.type || ''),
      errorCode: String(payload?.error?.code || ''),
      retryable
    };
    await notifyRequest(requestEvent);
    if (!response.ok) {
      const stripeError = payload?.error || {};
      throw new StripeApiError(
        String(stripeError.message || `Stripe API request failed (${response.status})`)
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 320),
        {
          type: String(stripeError.type || 'stripe_api_error'),
          code: String(stripeError.code || ''),
          declineCode: String(stripeError.decline_code || ''),
          statusCode: response.status,
          requestId: requestEvent.requestId,
          objectId: String(
            stripeError.payment_intent?.id
            || stripeError.setup_intent?.id
            || stripeError.charge
            || ''
          ),
          retryable
        }
      );
    }
    return payload;
  }

  return {
    products: {
      create: (data, options) => request('POST', '/products', data, options),
      retrieve: (id, options) => request('GET', `/products/${stripePathId(id)}`, null, options)
    },
    prices: {
      create: (data, options) => request('POST', '/prices', data, options),
      retrieve: (id, options) => request('GET', `/prices/${stripePathId(id)}`, null, options)
    },
    taxRates: {
      create: (data, options) => request('POST', '/tax_rates', data, options),
      retrieve: (id, options) => request('GET', `/tax_rates/${stripePathId(id)}`, null, options)
    },
    checkout: {
      sessions: {
        create: (data, options) => request('POST', '/checkout/sessions', data, options),
        retrieve: (id, options) => request('GET', `/checkout/sessions/${stripePathId(id)}`, null, options),
        list: (data, options) => request('GET', '/checkout/sessions', data, options),
        expire: (id, options) => request('POST', `/checkout/sessions/${stripePathId(id)}/expire`, null, options)
      }
    },
    setupIntents: {
      retrieve: (id, options) => request('GET', `/setup_intents/${stripePathId(id)}`, null, options)
    },
    paymentIntents: {
      create: (data, options) => request('POST', '/payment_intents', data, options),
      retrieve: (id, data, options) => request('GET', `/payment_intents/${stripePathId(id)}`, data, options)
    },
    billingPortal: {
      sessions: {
        create: (data, options) => request('POST', '/billing_portal/sessions', data, options)
      }
    },
    customers: {
      create: (data, options) => request('POST', '/customers', data, options),
      update: (id, data, options) => request('POST', `/customers/${stripePathId(id)}`, data, options),
      retrieve: (id, options) => request('GET', `/customers/${stripePathId(id)}`, null, options),
      delete: (id, data, options) => request('DELETE', `/customers/${stripePathId(id)}`, data, options)
    },
    paymentMethods: {
      attach: (id, data, options) => request('POST', `/payment_methods/${stripePathId(id)}/attach`, data, options),
      retrieve: (id, options) => request('GET', `/payment_methods/${stripePathId(id)}`, null, options)
    },
    subscriptions: {
      create: (data, options) => request('POST', '/subscriptions', data, options),
      update: (id, data, options) => request('POST', `/subscriptions/${stripePathId(id)}`, data, options),
      retrieve: (id, options) => request('GET', `/subscriptions/${stripePathId(id)}`, null, options),
      cancel: (id, data, options) => request('DELETE', `/subscriptions/${stripePathId(id)}`, data, options)
    },
    invoices: {
      list: (data, options) => request('GET', '/invoices', data, options),
      retrieve: (id, options) => request('GET', `/invoices/${stripePathId(id)}`, null, options),
      pay: (id, data, options) => request('POST', `/invoices/${stripePathId(id)}/pay`, data, options)
    },
    invoicePayments: {
      list: (data, options) => request('GET', '/invoice_payments', data, options)
    },
    refunds: {
      create: (data, options) => request('POST', '/refunds', data, options),
      retrieve: (id, options) => request('GET', `/refunds/${stripePathId(id)}`, null, options)
    },
    events: {
      retrieve: (id, options) => request('GET', `/events/${stripePathId(id)}`, null, options),
      retry: (id, data, options) => request('POST', `/events/${stripePathId(id)}/retry`, data, options)
    },
    testHelpers: {
      testClocks: {
        create: (data, options) => request('POST', '/test_helpers/test_clocks', data, options),
        retrieve: (id, options) => request('GET', `/test_helpers/test_clocks/${stripePathId(id)}`, null, options),
        advance: (id, data, options) => request('POST', `/test_helpers/test_clocks/${stripePathId(id)}/advance`, data, options),
        delete: (id, options) => request('DELETE', `/test_helpers/test_clocks/${stripePathId(id)}`, null, options)
      }
    }
  };
}
