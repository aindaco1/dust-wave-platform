import { readJsonObject, requiredText, RequestValidationError } from '@dustwave/worker-core/request-validation';

// The application supplies session, origin and CSRF authorization together.
// The default denies every request; this example stores nothing.
export function createPreviewWorker({ authorize = async () => false } = {}) {
  return { async fetch(request) {
    if (new URL(request.url).pathname !== '/admin/preview') return new Response('Not found', { status: 404 });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { allow: 'POST' } });
    if (!await authorize(request)) return Response.json({ error: 'unauthorized' }, { status: 401 });
    try {
      const body = await readJsonObject(request, 4096);
      return Response.json({ preview: requiredText(body.title, 'title', 100) });
    } catch (error) {
      if (!(error instanceof RequestValidationError)) throw error;
      return Response.json({ error: error.code, message: error.message }, { status: error.status });
    }
  } };
}
