const DEFAULT_DIMENSION_INCHES = 1;
export const SHIPPING_OPTION_STANDARD = 'standard';
export const SHIPPING_OPTION_SIGNATURE_REQUIRED = 'signature_required';
export const SHIPPING_OPTION_ADULT_SIGNATURE_REQUIRED = 'adult_signature_required';

const KNOWN_SHIPPING_OPTIONS = new Set([
  SHIPPING_OPTION_STANDARD,
  SHIPPING_OPTION_SIGNATURE_REQUIRED,
  SHIPPING_OPTION_ADULT_SIGNATURE_REQUIRED
]);
const USPS_SIGNATURE_REQUIRED_FEE_CENTS = 395;
const USPS_ADULT_SIGNATURE_REQUIRED_FEE_CENTS = 970;
const MANUAL_DOMESTIC_RATE_FIRST_CLASS_FLAT = 'FIRST_CLASS_FLAT';
const FIRST_CLASS_FLAT_MIN_LENGTH_IN = 11.5;
const FIRST_CLASS_FLAT_MAX_LENGTH_IN = 15;
const FIRST_CLASS_FLAT_MIN_WIDTH_IN = 6.125;
const FIRST_CLASS_FLAT_MAX_WIDTH_IN = 12;
const FIRST_CLASS_FLAT_MAX_HEIGHT_IN = 0.75;
const FIRST_CLASS_FLAT_MAX_WEIGHT_OZ = 13;
const MAX_SELECTIONS_PER_KIND = 1000;
const MAX_PROFILE_MAIL_CLASSES = 32;
const FIRST_CLASS_FLAT_RATE_TABLE_CENTS = Object.freeze({
  1: 163,
  2: 190,
  3: 217,
  4: 244,
  5: 272,
  6: 300,
  7: 328,
  8: 356,
  9: 384,
  10: 414,
  11: 444,
  12: 474,
  13: 504
});

function boundedArray(value, label) {
  const normalized = Array.isArray(value) ? value : [];
  if (normalized.length > MAX_SELECTIONS_PER_KIND) {
    return { valid: false, error: `${label} exceeds the supported selection limit` };
  }
  return { valid: true, value: normalized };
}

function normalizeOptionalString(value) {
  const normalized = String(value || '').trim();
  return normalized ? normalized : '';
}

function normalizeUspsDomesticProfile(profile) {
  if (!profile || typeof profile !== 'object') return null;
  const processingCategory = normalizeOptionalString(profile.processing_category || profile.processingCategory);
  const destinationEntryFacilityType = normalizeOptionalString(
    profile.destination_entry_facility_type || profile.destinationEntryFacilityType
  );
  const rateIndicator = normalizeOptionalString(profile.rate_indicator || profile.rateIndicator);
  const priceType = normalizeOptionalString(profile.price_type || profile.priceType);
  const sourceMailClasses = profile.mail_classes || profile.mailClasses;
  const mailClasses = Array.isArray(sourceMailClasses)
    ? sourceMailClasses
        .slice(0, MAX_PROFILE_MAIL_CLASSES)
        .map((value) => normalizeOptionalString(value))
        .filter(Boolean)
    : [];

  if (!processingCategory && !destinationEntryFacilityType && !rateIndicator && !priceType && mailClasses.length === 0) {
    return null;
  }
  return {
    ...(processingCategory ? { processingCategory } : {}),
    ...(destinationEntryFacilityType ? { destinationEntryFacilityType } : {}),
    ...(rateIndicator ? { rateIndicator } : {}),
    ...(priceType ? { priceType } : {}),
    ...(mailClasses.length > 0 ? { mailClasses } : {})
  };
}

function normalizeManualDomesticRate(value) {
  const normalized = normalizeOptionalString(value).toUpperCase();
  return normalized === MANUAL_DOMESTIC_RATE_FIRST_CLASS_FLAT ? normalized : null;
}

export function normalizeShippingProfile(shipping, label = 'Physical item') {
  const normalizedLabel = String(label || 'Physical item').slice(0, 240);
  if (!shipping || typeof shipping !== 'object') {
    return { valid: false, error: `${normalizedLabel} is missing shipping metadata` };
  }

  const weightOz = Number(shipping.weight_oz);
  const lengthIn = Number(shipping.length_in);
  const widthIn = Number(shipping.width_in);
  const heightIn = Number(shipping.height_in);
  const packagingWeightOz = Number(shipping.packaging_weight_oz);
  const stackHeightIn = Number(shipping.stack_height_in);
  if (!(Number.isFinite(weightOz) && weightOz > 0)) {
    return { valid: false, error: `${normalizedLabel} is missing a valid weight` };
  }

  const normalizedHeightIn = Number.isFinite(heightIn) && heightIn > 0
    ? heightIn
    : DEFAULT_DIMENSION_INCHES;
  return {
    valid: true,
    shipping: {
      weightOz,
      lengthIn: Number.isFinite(lengthIn) && lengthIn > 0 ? lengthIn : DEFAULT_DIMENSION_INCHES,
      widthIn: Number.isFinite(widthIn) && widthIn > 0 ? widthIn : DEFAULT_DIMENSION_INCHES,
      heightIn: normalizedHeightIn,
      packagingWeightOz: Number.isFinite(packagingWeightOz) && packagingWeightOz > 0 ? packagingWeightOz : 0,
      stackHeightIn: Number.isFinite(stackHeightIn) && stackHeightIn > 0 ? stackHeightIn : normalizedHeightIn,
      uspsDomesticProfile: normalizeUspsDomesticProfile(shipping.usps_domestic),
      manualDomesticRate: normalizeManualDomesticRate(shipping.manual_domestic_rate || shipping.manualDomesticRate)
    }
  };
}

export function getTierShippingProfile(tier = {}) {
  if (tier?.category !== 'physical') return { valid: true, shipping: null };
  return normalizeShippingProfile(tier?.shipping, `Physical tier "${tier?.id || 'unknown'}"`);
}

export function getSupportItemShippingProfile(supportItem = {}) {
  if (supportItem?.category !== 'physical') return { valid: true, shipping: null };
  return normalizeShippingProfile(
    supportItem?.shipping,
    `Physical support item "${supportItem?.id || 'unknown'}"`
  );
}

export function getAddOnShippingProfile(addOn = {}) {
  if (addOn?.category !== 'physical') return { valid: true, shipping: null };
  return normalizeShippingProfile(
    addOn?.shipping,
    `Physical add-on "${addOn?.productId || addOn?.name || 'unknown'}"`
  );
}

function mergeShipmentUspsDomesticProfile(shipment, profile) {
  if (!shipment || shipment.uspsDomesticProfile === null) return;
  const normalizedProfile = profile && typeof profile === 'object' ? profile : null;
  if (shipment.uspsDomesticProfile === undefined) {
    shipment.uspsDomesticProfile = normalizedProfile;
    return;
  }
  const currentKey = shipment.uspsDomesticProfile ? JSON.stringify(shipment.uspsDomesticProfile) : '';
  const nextKey = normalizedProfile ? JSON.stringify(normalizedProfile) : '';
  if (currentKey !== nextKey) shipment.uspsDomesticProfile = null;
}

function mergeShipmentManualDomesticRate(shipment, manualDomesticRate) {
  if (!shipment || shipment.manualDomesticRate === null) return;
  const normalized = normalizeManualDomesticRate(manualDomesticRate);
  if (shipment.manualDomesticRate === undefined) {
    shipment.manualDomesticRate = normalized;
    return;
  }
  if (shipment.manualDomesticRate !== normalized) shipment.manualDomesticRate = null;
}

function initialShipment(metadataIncomplete = false) {
  return {
    hasPhysical: false,
    physicalTierCount: 0,
    physicalSupportItemCount: 0,
    physicalAddOnCount: 0,
    physicalUnitCount: 0,
    weightOz: 0,
    lengthIn: 0,
    widthIn: 0,
    heightIn: 0,
    tierIds: [],
    supportItemIds: [],
    addOnIds: [],
    ...(metadataIncomplete
      ? { metadataIncomplete: true }
      : { uspsDomesticProfile: undefined, manualDomesticRate: undefined })
  };
}

function normalizedSelections(tierSelection, supportItems, context, bundleAddOns) {
  const tiers = boundedArray(tierSelection?.selectedTiers, 'Tier selection');
  if (!tiers.valid) return tiers;
  const support = boundedArray(supportItems, 'Support-item selection');
  if (!support.valid) return support;
  const addOns = boundedArray(bundleAddOns, 'Add-on selection');
  if (!addOns.valid) return addOns;
  const definitions = boundedArray(context?.support_items, 'Support-item catalog');
  if (!definitions.valid) return definitions;
  return {
    valid: true,
    tiers: tiers.value,
    support: support.value,
    addOns: addOns.value,
    supportItemDefinitions: new Map(definitions.value.map((item) => [item?.id, item]))
  };
}

export function summarizeShipmentSelection(
  tierSelection = { selectedTiers: [] },
  supportItems = [],
  context = null,
  bundleAddOns = []
) {
  const selections = normalizedSelections(tierSelection, supportItems, context, bundleAddOns);
  if (!selections.valid) return selections;
  const shipment = initialShipment();

  for (const selected of selections.tiers) {
    const tier = selected?.tier;
    if (tier?.category !== 'physical') continue;
    const qty = Number(selected?.qty || 0);
    if (!Number.isInteger(qty) || qty <= 0) {
      return { valid: false, error: `Invalid quantity for tier "${tier?.id || 'unknown'}"` };
    }
    const profile = getTierShippingProfile(tier);
    if (!profile.valid) return profile;
    shipment.hasPhysical = true;
    shipment.physicalTierCount += 1;
    shipment.physicalUnitCount += qty;
    shipment.weightOz += (profile.shipping.weightOz * qty) + profile.shipping.packagingWeightOz;
    shipment.lengthIn = Math.max(shipment.lengthIn, profile.shipping.lengthIn);
    shipment.widthIn = Math.max(shipment.widthIn, profile.shipping.widthIn);
    shipment.heightIn += profile.shipping.heightIn + (profile.shipping.stackHeightIn * Math.max(0, qty - 1));
    shipment.tierIds.push(tier.id);
    mergeShipmentUspsDomesticProfile(shipment, profile.shipping.uspsDomesticProfile);
    mergeShipmentManualDomesticRate(shipment, profile.shipping.manualDomesticRate);
  }

  for (const selected of selections.support) {
    const supportItemId = typeof selected?.id === 'string' ? selected.id : '';
    const amount = Number(selected?.amount || 0);
    if (!supportItemId || !Number.isInteger(amount) || amount <= 0) {
      return { valid: false, error: `Invalid amount for support item "${supportItemId || 'unknown'}"` };
    }
    const supportItem = selections.supportItemDefinitions.get(supportItemId);
    if (!supportItem) return { valid: false, error: `Support item "${supportItemId}" not found` };
    if (supportItem.category !== 'physical') continue;
    const profile = getSupportItemShippingProfile(supportItem);
    if (!profile.valid) return profile;
    shipment.hasPhysical = true;
    shipment.physicalSupportItemCount += 1;
    shipment.physicalUnitCount += 1;
    shipment.weightOz += profile.shipping.weightOz + profile.shipping.packagingWeightOz;
    shipment.lengthIn = Math.max(shipment.lengthIn, profile.shipping.lengthIn);
    shipment.widthIn = Math.max(shipment.widthIn, profile.shipping.widthIn);
    shipment.heightIn += profile.shipping.heightIn;
    shipment.supportItemIds.push(supportItemId);
    mergeShipmentUspsDomesticProfile(shipment, profile.shipping.uspsDomesticProfile);
    mergeShipmentManualDomesticRate(shipment, profile.shipping.manualDomesticRate);
  }

  for (const selected of selections.addOns) {
    const productId = typeof selected?.productId === 'string' ? selected.productId : '';
    const quantity = Number(selected?.quantity || 0);
    if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
      return { valid: false, error: `Invalid quantity for add-on "${productId || 'unknown'}"` };
    }
    if (selected?.category !== 'physical') continue;
    const profile = getAddOnShippingProfile(selected);
    if (!profile.valid) return profile;
    shipment.hasPhysical = true;
    shipment.physicalAddOnCount += 1;
    shipment.physicalUnitCount += quantity;
    shipment.weightOz += (profile.shipping.weightOz * quantity) + profile.shipping.packagingWeightOz;
    shipment.lengthIn = Math.max(shipment.lengthIn, profile.shipping.lengthIn);
    shipment.widthIn = Math.max(shipment.widthIn, profile.shipping.widthIn);
    shipment.heightIn += profile.shipping.heightIn + (profile.shipping.stackHeightIn * Math.max(0, quantity - 1));
    shipment.addOnIds.push(productId);
    mergeShipmentUspsDomesticProfile(shipment, profile.shipping.uspsDomesticProfile);
    mergeShipmentManualDomesticRate(shipment, profile.shipping.manualDomesticRate);
  }

  if (!shipment.uspsDomesticProfile) delete shipment.uspsDomesticProfile;
  if (!shipment.manualDomesticRate) delete shipment.manualDomesticRate;
  return { valid: true, shipment };
}

export function summarizePhysicalSelectionWithoutMetadata(
  tierSelection = { selectedTiers: [] },
  supportItems = [],
  context = null,
  bundleAddOns = []
) {
  const selections = normalizedSelections(tierSelection, supportItems, context, bundleAddOns);
  if (!selections.valid) return selections;
  const shipment = initialShipment(true);

  for (const selected of selections.tiers) {
    const tier = selected?.tier;
    if (tier?.category !== 'physical') continue;
    const qty = Number(selected?.qty || 0);
    if (!Number.isInteger(qty) || qty <= 0) {
      return { valid: false, error: `Invalid quantity for tier "${tier?.id || 'unknown'}"` };
    }
    shipment.hasPhysical = true;
    shipment.physicalTierCount += 1;
    shipment.physicalUnitCount += qty;
    shipment.tierIds.push(tier.id);
  }

  for (const selected of selections.support) {
    const supportItemId = typeof selected?.id === 'string' ? selected.id : '';
    const amount = Number(selected?.amount || 0);
    if (!supportItemId || !Number.isInteger(amount) || amount <= 0) {
      return { valid: false, error: `Invalid amount for support item "${supportItemId || 'unknown'}"` };
    }
    const supportItem = selections.supportItemDefinitions.get(supportItemId);
    if (!supportItem) return { valid: false, error: `Support item "${supportItemId}" not found` };
    if (supportItem.category !== 'physical') continue;
    shipment.hasPhysical = true;
    shipment.physicalSupportItemCount += 1;
    shipment.physicalUnitCount += 1;
    shipment.supportItemIds.push(supportItemId);
  }

  for (const selected of selections.addOns) {
    const productId = typeof selected?.productId === 'string' ? selected.productId : '';
    const quantity = Number(selected?.quantity || 0);
    if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
      return { valid: false, error: `Invalid quantity for add-on "${productId || 'unknown'}"` };
    }
    if (selected?.category !== 'physical') continue;
    shipment.hasPhysical = true;
    shipment.physicalAddOnCount += 1;
    shipment.physicalUnitCount += quantity;
    shipment.addOnIds.push(productId);
  }
  return { valid: true, shipment };
}

export function isShippingMetadataError(error) {
  const message = String(error || '');
  return message.includes('missing shipping metadata') || message.includes('missing a valid weight');
}

function normalizedPolicy(policy = {}) {
  const originCountry = String(policy.originCountry || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(originCountry)) throw new TypeError('A two-letter shipping origin country is required');
  return { ...policy, originCountry };
}

export function buildFallbackShippingQuote(policy, destination, shipment) {
  const normalized = normalizedPolicy(policy);
  const domestic = destination?.country === normalized.originCountry;
  const fallbackFeeCents = Math.max(0, Number(normalized.fallbackFeeCents || 0) || 0);
  return {
    shippingCents: shipment?.hasPhysical ? fallbackFeeCents : 0,
    source: shipment?.hasPhysical ? 'fallback_flat_rate' : 'none',
    carrier: shipment?.hasPhysical ? 'fallback' : null,
    service: shipment?.hasPhysical
      ? (domestic ? 'domestic_ground_fallback' : 'international_ground_fallback')
      : null,
    domestic
  };
}

function qualifiesForManualDomesticRate(shipment, rateId) {
  if (!shipment?.hasPhysical || rateId !== MANUAL_DOMESTIC_RATE_FIRST_CLASS_FLAT) return false;
  const weightOz = Number(shipment.weightOz || 0);
  const lengthIn = Number(shipment.lengthIn || 0);
  const widthIn = Number(shipment.widthIn || 0);
  const heightIn = Number(shipment.heightIn || 0);
  return Number.isFinite(weightOz) && weightOz > 0 && weightOz <= FIRST_CLASS_FLAT_MAX_WEIGHT_OZ
    && Number.isFinite(lengthIn) && lengthIn >= FIRST_CLASS_FLAT_MIN_LENGTH_IN && lengthIn <= FIRST_CLASS_FLAT_MAX_LENGTH_IN
    && Number.isFinite(widthIn) && widthIn >= FIRST_CLASS_FLAT_MIN_WIDTH_IN && widthIn <= FIRST_CLASS_FLAT_MAX_WIDTH_IN
    && Number.isFinite(heightIn) && heightIn > 0 && heightIn <= FIRST_CLASS_FLAT_MAX_HEIGHT_IN;
}

export function buildManualDomesticRateQuote(destination, shipment) {
  const rateId = normalizeManualDomesticRate(shipment?.manualDomesticRate);
  if (!rateId || destination?.country !== 'US' || !qualifiesForManualDomesticRate(shipment, rateId)) {
    return { valid: false, error: 'Manual domestic rate unavailable' };
  }
  const billableWeightOz = Math.min(
    FIRST_CLASS_FLAT_MAX_WEIGHT_OZ,
    Math.max(1, Math.ceil(Number(shipment.weightOz || 0)))
  );
  const shippingCents = FIRST_CLASS_FLAT_RATE_TABLE_CENTS[billableWeightOz];
  if (!Number.isFinite(shippingCents)) {
    return { valid: false, error: 'Manual domestic flat rate unavailable' };
  }
  return {
    valid: true,
    quote: {
      shippingCents,
      source: 'manual_rate_table',
      carrier: 'usps_manual',
      service: 'first_class_flat',
      domestic: true
    }
  };
}

export function buildFreeShippingQuote(policy, destination, shipment) {
  const normalized = normalizedPolicy(policy);
  return {
    shippingCents: 0,
    source: shipment?.hasPhysical ? 'free_shipping' : 'none',
    carrier: null,
    service: shipment?.hasPhysical ? 'free_shipping' : null,
    domestic: destination?.country === normalized.originCountry
  };
}

function getShippingOptionLabel(id) {
  if (id === SHIPPING_OPTION_SIGNATURE_REQUIRED) return 'Signature required';
  if (id === SHIPPING_OPTION_ADULT_SIGNATURE_REQUIRED) return 'Adult signature required';
  return 'Standard';
}

function getShippingOptionDeltaCents(id) {
  if (id === SHIPPING_OPTION_SIGNATURE_REQUIRED) return USPS_SIGNATURE_REQUIRED_FEE_CENTS;
  if (id === SHIPPING_OPTION_ADULT_SIGNATURE_REQUIRED) return USPS_ADULT_SIGNATURE_REQUIRED_FEE_CENTS;
  return 0;
}

export function getAvailableShippingOptions(
  policy,
  destination = {},
  shipment = { hasPhysical: false },
  baseShippingCents = 0
) {
  if (!shipment?.hasPhysical) return [];
  const normalized = normalizedPolicy(policy);
  const domestic = destination?.country === normalized.originCountry;
  const freeShipping = normalized.freeShipping === true;
  const configured = Array.isArray(normalized.configuredOptions)
    ? normalized.configuredOptions.slice(0, 32)
    : [];
  const optionIds = new Set([SHIPPING_OPTION_STANDARD]);
  if (!freeShipping && domestic) {
    optionIds.add(SHIPPING_OPTION_SIGNATURE_REQUIRED);
    optionIds.add(SHIPPING_OPTION_ADULT_SIGNATURE_REQUIRED);
  }
  if (!freeShipping) {
    for (const optionId of configured) {
      const candidate = String(optionId || '').trim().toLowerCase();
      if (!KNOWN_SHIPPING_OPTIONS.has(candidate)) continue;
      if (!domestic && candidate !== SHIPPING_OPTION_STANDARD) continue;
      optionIds.add(candidate);
    }
  }
  return Array.from(optionIds).map((id) => ({
    id,
    label: getShippingOptionLabel(id),
    domesticOnly: id !== SHIPPING_OPTION_STANDARD,
    priceDeltaCents: getShippingOptionDeltaCents(id),
    shippingCents: Math.max(0, Number(baseShippingCents) || 0) + getShippingOptionDeltaCents(id)
  }));
}

export function resolveSelectedShippingOption(
  availableOptions = [],
  selectedOption,
  defaultOption = SHIPPING_OPTION_STANDARD
) {
  const options = Array.isArray(availableOptions) ? availableOptions.slice(0, 32) : [];
  const requested = String(selectedOption || '').trim().toLowerCase();
  if (requested && options.some((option) => option?.id === requested)) return requested;
  const normalizedDefault = String(defaultOption || SHIPPING_OPTION_STANDARD).trim().toLowerCase();
  if (options.some((option) => option?.id === normalizedDefault)) return normalizedDefault;
  return options[0]?.id || SHIPPING_OPTION_STANDARD;
}

export function getSelectedShippingOptionDetails(
  availableOptions = [],
  selectedOption,
  defaultOption = SHIPPING_OPTION_STANDARD
) {
  const options = Array.isArray(availableOptions) ? availableOptions.slice(0, 32) : [];
  const resolvedId = resolveSelectedShippingOption(options, selectedOption, defaultOption);
  return options.find((option) => option?.id === resolvedId) || null;
}

export function buildStandardOnlyShippingOptions(shipment, shippingCents) {
  if (!shipment?.hasPhysical) return [];
  return [{
    id: SHIPPING_OPTION_STANDARD,
    label: getShippingOptionLabel(SHIPPING_OPTION_STANDARD),
    domesticOnly: false,
    priceDeltaCents: 0,
    shippingCents: Math.max(0, Number(shippingCents || 0))
  }];
}
