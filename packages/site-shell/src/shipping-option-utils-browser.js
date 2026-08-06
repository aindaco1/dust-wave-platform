(function() {
  'use strict';

  if (window.DustWaveShippingOptionUtils) return;

  function normalizeSelection(availableOptions, selectedOption, defaultOption) {
    var options = Array.isArray(availableOptions) ? availableOptions : [];
    var requested = String(selectedOption || '').trim().toLowerCase();
    if (requested && options.some(function(option) { return option?.id === requested; })) {
      return requested;
    }

    var normalizedDefault = String(defaultOption || 'standard').trim().toLowerCase() || 'standard';
    if (options.some(function(option) { return option?.id === normalizedDefault; })) {
      return normalizedDefault;
    }

    return options[0]?.id || 'standard';
  }

  function getSelectedDetails(availableOptions, selectedOption, defaultOption) {
    var options = Array.isArray(availableOptions) ? availableOptions : [];
    var resolvedOption = normalizeSelection(options, selectedOption, defaultOption);
    return options.find(function(option) { return option?.id === resolvedOption; }) || null;
  }

  function getPrimaryQuote(quotes) {
    var normalizedQuotes = Array.isArray(quotes) ? quotes : [];
    var shippableQuotes = normalizedQuotes.filter(function(quote) {
      return Number(quote?.shippingCents || 0) > 0 || quote?.shipment?.hasPhysical === true;
    });
    return shippableQuotes[0] || normalizedQuotes[0] || null;
  }

  function resolveQuote(payload, selectedOption, fallbackShippingCents) {
    var quotes = Array.isArray(payload?.quotes) ? payload.quotes : [];
    var primaryQuote = getPrimaryQuote(quotes);
    var shippableQuotes = quotes.filter(function(quote) {
      return Number(quote?.shippingCents || 0) > 0 || quote?.shipment?.hasPhysical === true;
    });
    var optionSourceQuote = shippableQuotes.length === 1 ? shippableQuotes[0] : primaryQuote;
    var availableOptions = shippableQuotes.length === 1 && Array.isArray(optionSourceQuote?.availableOptions)
      ? optionSourceQuote.availableOptions
      : [];
    var defaultOption = String(optionSourceQuote?.defaultOption || 'standard').trim().toLowerCase() || 'standard';
    var resolvedOption = normalizeSelection(
      availableOptions,
      selectedOption || optionSourceQuote?.selectedOption,
      defaultOption
    );
    var selectedDetails = getSelectedDetails(availableOptions, resolvedOption, defaultOption);
    var shippingCents = selectedDetails
      ? Math.max(0, Number(selectedDetails.shippingCents || 0))
      : Math.max(0, Number(payload?.totalShippingCents || fallbackShippingCents || 0));

    return {
      shippingCents: shippingCents,
      source: String(primaryQuote?.source || ''),
      availableOptions: availableOptions,
      defaultOption: defaultOption,
      selectedOption: resolvedOption
    };
  }

  function shouldShowOptions(quote) {
    var source = String(quote?.source || '').trim().toLowerCase();
    var availableOptions = Array.isArray(quote?.availableOptions) ? quote.availableOptions : [];
    var shippingCents = Math.max(0, Number(quote?.shippingCents ?? quote?.amountCents ?? 0));
    return source === 'usps_live' && shippingCents > 0 && availableOptions.length > 1;
  }

  function formatChoice(option, labelResolver, moneyFormatter) {
    if (!option) return '';
    var label = typeof labelResolver === 'function' ? labelResolver(option.id) : String(option?.label || option?.id || '');
    var delta = Math.max(0, Number(option?.priceDeltaCents || 0));
    if (delta <= 0) return label;
    var formattedDelta = typeof moneyFormatter === 'function' ? moneyFormatter(delta) : String(delta);
    return label + ' (+' + formattedDelta + ')';
  }

  window.DustWaveShippingOptionUtils = {
    normalizeSelection: normalizeSelection,
    getSelectedDetails: getSelectedDetails,
    resolveQuote: resolveQuote,
    shouldShowOptions: shouldShowOptions,
    formatChoice: formatChoice
  };
})();
