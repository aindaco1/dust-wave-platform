import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildFallbackShippingQuote,
  buildManualDomesticRateQuote,
  getAvailableShippingOptions,
  getSelectedShippingOptionDetails,
  resolveSelectedShippingOption,
  summarizePhysicalSelectionWithoutMetadata,
  summarizeShipmentSelection
} from '../src/index.js';

const profile = {
  weight_oz: 4,
  length_in: 12,
  width_in: 7,
  height_in: 0.2,
  packaging_weight_oz: 1,
  stack_height_in: 0.1,
  manual_domestic_rate: 'first_class_flat',
  usps_domestic: {
    processing_category: 'FLATS',
    mail_classes: ['USPS_GROUND_ADVANTAGE']
  }
};

test('preserves the characterized Pool and Store mixed-shipment summary', () => {
  const tier = { id: 'tier-one', category: 'physical', shipping: profile };
  const supportItem = {
    id: 'support-one',
    category: 'physical',
    shipping: { ...profile, weight_oz: 2, packaging_weight_oz: 0.5, height_in: 0.1 }
  };
  const addOn = {
    productId: 'add-on-one',
    category: 'physical',
    quantity: 3,
    shipping: { ...profile, weight_oz: 1, packaging_weight_oz: 0.25, stack_height_in: 0.15 }
  };
  const result = summarizeShipmentSelection(
    { selectedTiers: [{ tier, qty: 2 }] },
    [{ id: supportItem.id, amount: 500 }],
    { support_items: [supportItem] },
    [addOn]
  );
  assert.equal(result.valid, true);
  assert.deepEqual(result.shipment, {
    hasPhysical: true,
    physicalTierCount: 1,
    physicalSupportItemCount: 1,
    physicalAddOnCount: 1,
    physicalUnitCount: 6,
    weightOz: 14.75,
    lengthIn: 12,
    widthIn: 7,
    heightIn: 0.9,
    tierIds: ['tier-one'],
    supportItemIds: ['support-one'],
    addOnIds: ['add-on-one'],
    uspsDomesticProfile: {
      processingCategory: 'FLATS',
      mailClasses: ['USPS_GROUND_ADVANTAGE']
    },
    manualDomesticRate: 'FIRST_CLASS_FLAT'
  });
});

test('retains missing-metadata fallback evidence without manufacturing dimensions', () => {
  assert.deepEqual(
    summarizePhysicalSelectionWithoutMetadata({
      selectedTiers: [{ tier: { id: 'physical', category: 'physical' }, qty: 2 }]
    }),
    {
      valid: true,
      shipment: {
        hasPhysical: true,
        physicalTierCount: 1,
        physicalSupportItemCount: 0,
        physicalAddOnCount: 0,
        physicalUnitCount: 2,
        weightOz: 0,
        lengthIn: 0,
        widthIn: 0,
        heightIn: 0,
        tierIds: ['physical'],
        supportItemIds: [],
        addOnIds: [],
        metadataIncomplete: true
      }
    }
  );
});

test('applies injected fallback, manual rate, and option policy', () => {
  const shipment = {
    hasPhysical: true,
    weightOz: 4,
    lengthIn: 12,
    widthIn: 7,
    heightIn: 0.2,
    manualDomesticRate: 'FIRST_CLASS_FLAT'
  };
  assert.deepEqual(
    buildFallbackShippingQuote({ originCountry: 'US', fallbackFeeCents: 300 }, { country: 'CA' }, shipment),
    {
      shippingCents: 300,
      source: 'fallback_flat_rate',
      carrier: 'fallback',
      service: 'international_ground_fallback',
      domestic: false
    }
  );
  assert.equal(buildManualDomesticRateQuote({ country: 'US' }, shipment).quote.shippingCents, 244);
  const options = getAvailableShippingOptions(
    { originCountry: 'US', configuredOptions: ['signature_required'] },
    { country: 'US' },
    shipment,
    300
  );
  assert.deepEqual(options.map(({ id, shippingCents }) => ({ id, shippingCents })), [
    { id: 'standard', shippingCents: 300 },
    { id: 'signature_required', shippingCents: 695 },
    { id: 'adult_signature_required', shippingCents: 1270 }
  ]);
  assert.equal(resolveSelectedShippingOption(options, 'unknown', 'signature_required'), 'signature_required');
  assert.equal(getSelectedShippingOptionDetails(options, '', 'signature_required').shippingCents, 695);
});

test('bounds selections and rejects missing origin policy', () => {
  assert.deepEqual(
    summarizeShipmentSelection({ selectedTiers: new Array(1001).fill({}) }),
    { valid: false, error: 'Tier selection exceeds the supported selection limit' }
  );
  assert.throws(
    () => buildFallbackShippingQuote({}, { country: 'US' }, { hasPhysical: true }),
    /origin country/
  );
});
