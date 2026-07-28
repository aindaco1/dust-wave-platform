const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const US_POSTAL_CODE_PATTERN = /^\d{5}(?:-\d{4})?$/;
const INTERNATIONAL_POSTAL_CODE_PATTERN = /^[A-Z0-9][A-Z0-9 -]{1,15}$/;
const MAX_AMOUNT_CENTS = 999_999_999;
const RATE_DENOMINATOR = 1_000_000;

export function normalizeDestinationCountry(value) {
  const country = String(value || "").trim().toUpperCase();
  return COUNTRY_CODE_PATTERN.test(country) ? country : "";
}

export function normalizeDestinationPostalCode(value, country = "") {
  const postalCode = String(value || "").trim().toUpperCase();
  const pattern = country === "US"
    ? US_POSTAL_CODE_PATTERN
    : INTERNATIONAL_POSTAL_CODE_PATTERN;
  return pattern.test(postalCode) ? postalCode : "";
}

export function normalizeTaxDestination(value) {
  if (!value || typeof value !== "object") {
    return {
      valid: false,
      destination: null,
      error: "Billing address is incomplete"
    };
  }

  const rawCountry = String(value.country || value.countryCode || "").trim();
  const rawPostalCode = String(
    value.postalCode || value.postal_code || ""
  ).trim();
  const country = normalizeDestinationCountry(rawCountry);
  const postalCode = normalizeDestinationPostalCode(rawPostalCode, country);
  const destination = {
    country,
    postalCode,
    state: String(
      value.state
      || value.province
      || value.region
      || value.stateCode
      || ""
    ).trim().toUpperCase(),
    city: String(value.city || "").trim(),
    line1: String(
      value.line1 || value.address1 || value.street || ""
    ).trim(),
    line2: String(value.line2 || value.address2 || "").trim()
  };

  if (!rawCountry) {
    return {
      valid: false,
      destination: null,
      error: "Billing country is required"
    };
  }
  if (!country) {
    return {
      valid: false,
      destination: null,
      error: "Billing country must use a two-letter code"
    };
  }
  if (!rawPostalCode) {
    return {
      valid: false,
      destination: null,
      error: "Billing postal code is required"
    };
  }
  if (!postalCode) {
    return {
      valid: false,
      destination: null,
      error: "Billing postal code is invalid"
    };
  }

  return { valid: true, destination };
}

export function calculateManualTax({
  subtotalCents,
  shippingCents = 0,
  ratePartsPerMillion,
  shippingTaxable = false,
  taxBehavior = "exclusive"
}) {
  const subtotal = validCents(subtotalCents, "subtotalCents");
  const shipping = validCents(shippingCents, "shippingCents");
  const rate = validRate(ratePartsPerMillion);
  if (!["exclusive", "inclusive"].includes(taxBehavior)) {
    throw new TypeError("taxBehavior must be exclusive or inclusive");
  }
  if (typeof shippingTaxable !== "boolean") {
    throw new TypeError("shippingTaxable must be a boolean");
  }
  const taxableShippingCents = shippingTaxable ? shipping : 0;
  const taxableBaseCents = subtotal + taxableShippingCents;
  if (!Number.isSafeInteger(taxableBaseCents)) {
    throw new RangeError("Taxable amount exceeds the safe integer range");
  }
  const taxCents = taxBehavior === "inclusive"
    ? Math.round(
        taxableBaseCents * rate / (RATE_DENOMINATOR + rate)
      )
    : Math.round(taxableBaseCents * rate / RATE_DENOMINATOR);
  const totalCents = taxBehavior === "inclusive"
    ? subtotal + shipping
    : subtotal + shipping + taxCents;
  if (!Number.isSafeInteger(totalCents) || totalCents > MAX_AMOUNT_CENTS) {
    throw new RangeError("Total amount exceeds the supported ceiling");
  }
  return {
    subtotalCents: subtotal,
    shippingCents: shipping,
    taxableSubtotalCents: subtotal,
    taxableShippingCents,
    shippingTaxed: shippingTaxable,
    ratePartsPerMillion: rate,
    effectiveRate: rate / RATE_DENOMINATOR,
    taxBehavior,
    taxCents,
    totalCents
  };
}

function validCents(value, field) {
  if (
    !Number.isSafeInteger(value)
    || value < 0
    || value > MAX_AMOUNT_CENTS
  ) {
    throw new RangeError(`${field} must be bounded non-negative cents`);
  }
  return value;
}

function validRate(value) {
  if (
    !Number.isSafeInteger(value)
    || value < 0
    || value > RATE_DENOMINATOR
  ) {
    throw new RangeError(
      "ratePartsPerMillion must be an integer from zero to one million"
    );
  }
  return value;
}
