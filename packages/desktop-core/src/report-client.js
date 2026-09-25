import { readBoundedJson } from '../../worker-core/src/response-body.js';

export function validateReportReceipt(receipt, reportID) {
  if (receipt?.ok !== true || receipt.reportId !== reportID || !Number.isSafeInteger(receipt.issueNumber)
    || receipt.issueNumber < 1 || !['created', 'updated', 'duplicate'].includes(receipt.action)) {
    throw new Error('Invalid reporting receipt.');
  }
  return receipt;
}

/** Sends only on invocation. Caller supplies an already reviewed, schema-validated report. */
export async function sendReviewedReport(endpoint, report, { fetcher = fetch, headers = {},
  maximumResponseBytes = 4096, timeoutMS = 15000 } = {}) {
  const response = await fetcher(endpoint, { method: 'POST', redirect: 'error', credentials: 'omit',
    referrerPolicy: 'no-referrer', headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(report), signal: AbortSignal.timeout(timeoutMS) });
  if (!response.ok || !response.body) {
    throw new Error('Report delivery was not confirmed. Keep this report and retry later.');
  }
  try {
    return validateReportReceipt(await readBoundedJson(response, maximumResponseBytes), report.id);
  } catch {
    throw new Error('Invalid reporting receipt.');
  }
}
