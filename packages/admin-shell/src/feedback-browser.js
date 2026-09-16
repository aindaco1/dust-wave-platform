(function(scope) {
  "use strict";
  if (scope.DustWaveAdminShellFeedback) return;
  const messages = {
  "en": {
    "alt_recommended": "%{field}: a description helps people using screen readers. You can save and publish without it.",
    "alt_normalized": "%{field}: the description was shortened or cleaned up. Saving and publishing are allowed.",
    "required": "%{field}: add a value before continuing.",
    "too_long": "%{field}: shorten the text before continuing.",
    "url": "%{field}: choose an uploaded file or enter a valid, supported link.",
    "html": "%{field}: use the formatting toolbar or a content block instead of pasted HTML.",
    "gallery": "%{field}: add at least one image.",
    "empty": "%{field} is empty. You can fill it in when ready.",
    "audio_title": "%{field}: a title helps people identify this audio.",
    "preview_limit": "%{field}: the preview shows the first %{count} items.",
    "conflict": "A newer version was saved elsewhere. Keep a copy of your edits, then reload and compare before saving again.",
    "type": "%{field}: choose a supported media or content type.",
    "duplicate": "%{field}: this value is already in use. Choose a different one.",
    "slug": "%{field}: use lowercase letters, numbers, and hyphens.",
    "range": "%{field}: enter a value from %{min} to %{max}.",
    "whole_number": "%{field}: enter zero or a positive whole number.",
    "invalid": "Check the selected settings and try again.",
    "session": "Your session has expired. Keep this tab open and sign in again.",
    "permission": "This action is not available to your account, or the security check expired. Sign in again; contact an administrator if it continues.",
    "missing": "This item could not be found. Refresh the list and try again.",
    "upload_size": "This upload is too large. Choose a smaller file and try again.",
    "rate_limit": "Too many requests. Wait a moment and try again.",
    "service": "The service could not complete this request. Try again shortly; contact an administrator if it continues.",
    "network": "Could not connect. Check your connection and try again.",
    "review_warning": "%{field}: review this item when ready.",
    "review_field": "%{field}: check the value before continuing."
  },
  "es": {
    "alt_recommended": "%{field}: una descripción ayuda a quienes usan lectores de pantalla. Puedes guardar y publicar sin ella.",
    "alt_normalized": "%{field}: la descripción se acortó o se limpió. Puedes guardar y publicar.",
    "required": "%{field}: añade un valor antes de continuar.",
    "too_long": "%{field}: acorta el texto antes de continuar.",
    "url": "%{field}: elige un archivo subido o introduce un enlace válido y compatible.",
    "html": "%{field}: usa la barra de formato o un bloque de contenido en lugar de pegar HTML.",
    "gallery": "%{field}: añade al menos una imagen.",
    "empty": "%{field} está vacío. Puedes completarlo cuando quieras.",
    "audio_title": "%{field}: un título ayuda a identificar este audio.",
    "preview_limit": "%{field}: la vista previa muestra los primeros %{count} elementos.",
    "conflict": "Se guardó una versión más reciente en otro lugar. Conserva una copia de tus cambios; después recarga y compara antes de volver a guardar.",
    "type": "%{field}: elige un tipo de contenido o archivo compatible.",
    "duplicate": "%{field}: este valor ya está en uso. Elige otro.",
    "slug": "%{field}: usa letras minúsculas, números y guiones.",
    "range": "%{field}: introduce un valor entre %{min} y %{max}.",
    "whole_number": "%{field}: introduce cero o un número entero positivo.",
    "invalid": "Revisa los ajustes seleccionados e inténtalo de nuevo.",
    "session": "Tu sesión ha caducado. Mantén esta pestaña abierta y vuelve a iniciar sesión.",
    "permission": "Tu cuenta no puede realizar esta acción o la comprobación de seguridad ha caducado. Vuelve a iniciar sesión; si continúa, contacta con un administrador.",
    "missing": "No se encontró este elemento. Actualiza la lista e inténtalo de nuevo.",
    "upload_size": "El archivo supera el tamaño permitido. Elige uno más pequeño e inténtalo de nuevo.",
    "rate_limit": "Hay demasiadas solicitudes. Espera un momento e inténtalo de nuevo.",
    "service": "El servicio no pudo completar la solicitud. Inténtalo de nuevo en unos momentos; si continúa, contacta con un administrador.",
    "network": "No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.",
    "review_warning": "%{field}: revisa este elemento cuando puedas.",
    "review_field": "%{field}: comprueba el valor antes de continuar."
  }
};
  function message(key, { locale = "en", translate, values = {} } = {}) {
    const language = String(locale).toLowerCase().split(/[-_]/)[0];
    const fallback = (messages[language] || messages.en)[key] || messages.en[key] || messages.en.invalid;
    const template = translate?.(key, fallback) ?? fallback;
    return String(template).replace(/%\{(\w+)\}/g, (match, name) => values[name] === undefined ? match : String(values[name]));
  }
  function formatIssue(text, { field = "", ...options } = {}) {
    const t = (key, values) => message(key, { ...options, values });
    var values = { field: field };
    if (/alt is recommended/.test(text)) return t('alt_recommended', values);
    if (/alt was normalized/.test(text)) return t('alt_normalized', values);
    if (/is required|needs body text|needs a name|needs a label/i.test(text)) return t('required', values);
    if (/is too long/i.test(text)) return t('too_long', values);
    if (/unsafe link|(?:valid|approved|absolute|relative|https?).*URL|URL.*(?:unsafe|invalid|must)|unsafe.*path/i.test(text)) return t('url', values);
    if (/raw.*HTML|inline (?:style|event)|\.html is not allowed/i.test(text)) return t('html', values);
    if (/must include at least one image/i.test(text)) return t('gallery', values);
    if (/is empty/i.test(text)) return t('empty', values);
    if (/helps make audio previews accessible/i.test(text)) return t('audio_title', values);
    var limit = text.match(/was limited to (\d+) (images|blocks)/);
    if (limit) return t('preview_limit', { field: field, count: limit[1] });
    if (/changed since|project changed|conflict/i.test(text)) return t('conflict');
    if (/not supported|not approved|provider must be|unsupported.*type/i.test(text)) return t('type', values);
    if (/duplicated|already (?:used|exists)/i.test(text)) return t('duplicate', values);
    if (/lowercase letters, numbers, and hyphens/i.test(text)) return t('slug', values);
    var range = text.match(/must be between (\$?[\d,.-]+) and (\$?[\d,.-]+)/);
    if (range) return t('range', { field: field, min: range[1], max: range[2] });
    if (/non-negative whole number/i.test(text)) return t('whole_number', values);
    return '';
  }

  function createRequestError(data = {}, { status = 0, resolveIssue = () => "", ...options } = {}) {
    const t = key => message(key, options);
    const rows = (Array.isArray(data.errors) ? data.errors : []).filter(value => typeof value === "string").map(value => resolveIssue(value) || t("invalid"));
    let text = rows.length ? [...new Set(rows)].join(" ") : resolveIssue(data.error);
    if (!text) {
      const key = status === 401 ? "session" : status === 403 ? "permission" : status === 404 ? "missing" : status === 409 ? "conflict" : status === 413 || /too large|exceeds.*limit/i.test(data.error || "") ? "upload_size" : status === 429 ? "rate_limit" : status >= 500 ? "service" : status === 0 ? "network" : "invalid";
      text = message(key, options);
    }
    const error = new Error(text);
    error.rawData = data;
    error.data = { ...data, error: text, ...(rows.length ? { errors: rows } : {}) };
    error.status = status;
    return error;
  }
  Object.defineProperty(scope, "DustWaveAdminShellFeedback", { value: Object.freeze({ message, formatIssue, createRequestError }), configurable: false });
})(globalThis);
