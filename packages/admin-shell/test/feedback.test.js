import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequestError, formatIssue, message } from '../src/feedback.js';

for (const locale of ['en', 'es']) {
  test(`${locale}: field validation and advisory accessibility use readable copy`, () => {
    const field = locale === 'es' ? 'Bloque 4, imagen 1' : 'Block 4, image 1';
    const required = formatIssue('longContent[3].images[0].src is required.', { field, locale });
    assert.ok(required.startsWith(field));
    assert.match(required, locale === 'es' ? /añade un valor/ : /add a value/);
    assert.doesNotMatch(required, /longContent|\[3\]/);
    assert.match(formatIssue('x.alt is recommended for accessibility.', { field, locale }), locale === 'es' ? /guardar y publicar sin ella/ : /save and publish without it/);
    const raw = { error: 'Internal provider stack /secret/config.js:24', code: 'provider_failed' };
    const error = createRequestError(raw, { status: 502, locale });
    assert.match(error.message, locale === 'es' ? /servicio no pudo/ : /service could not/);
    assert.doesNotMatch(error.message, /secret|stack/);
    assert.equal(error.rawData, raw);
    assert.equal(error.data.code, 'provider_failed');
  });
  test(`${locale}: session, size, conflict, rate, and network failures have actionable messages`, () => {
    for (const [status, key] of [[401,'session'], [403,'permission'], [409,'conflict'], [413,'upload_size'], [429,'rate_limit'], [0,'network']]) {
      assert.equal(createRequestError({}, { status, locale }).message, message(key, { locale }));
    }
  });
}

test('structured validation preserves diagnostic data and uses the consumer field adapter', () => {
  const data = { errors: ['x is required.', 'x is required.'], preview: { html: '<p>Preview</p>' } };
  const error = createRequestError(data, { status: 400, resolveIssue: text => formatIssue(text, { field: 'Name' }) });
  assert.equal(error.message, 'Name: add a value before continuing.');
  assert.equal(error.data.preview, data.preview);
  assert.deepEqual(data.errors, ['x is required.', 'x is required.']);
});

test('consumer translation and locale fallback remain explicit', () => {
  assert.equal(message('required', { locale: 'es-MX', values: { field: 'Nombre' } }), 'Nombre: añade un valor antes de continuar.');
  assert.equal(message('required', { locale: 'fr', values: { field: 'Name' } }), 'Name: add a value before continuing.');
  assert.equal(message('required', { translate: () => 'Enter %{field}', values: { field: 'Title' } }), 'Enter Title');
  assert.equal(formatIssue('unknown provider detail'), '');
});
