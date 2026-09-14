import { AdminApiClient } from '@dustwave/admin-shell/api-client';
export function createPreviewClient({ baseUrl, csrfToken, fetchImpl }) {
  const client = new AdminApiClient({ baseUrl, fetchImpl });
  client.setCsrfToken(csrfToken);
  return title => client.request('/admin/preview', { method: 'POST', body: { title } });
}
