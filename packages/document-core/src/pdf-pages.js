const MAX_SOURCES = 32;
const MAX_INPUT_BYTES = 32 * 1024 * 1024;
const MAX_SELECTED_PAGES = 512;

export function selectPdfPages(selection, pageCount) {
  if (!Number.isSafeInteger(pageCount) || pageCount < 1) throw new RangeError("Expected a positive page count");
  if (selection === undefined) {
    if (pageCount > MAX_SELECTED_PAGES) throw new RangeError("Too many selected pages");
    return Array.from({ length: pageCount }, (_, index) => index);
  }
  if (typeof selection !== "string" || selection.length > 4096) throw new TypeError("Invalid page selection");
  const indices = [];
  for (const item of selection.split(",")) {
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(item.trim());
    if (!match) throw new TypeError("Expected a page or ascending page range");
    const first = Number(match[1]);
    const last = Number(match[2] ?? match[1]);
    if (first < 1 || last < first || last > pageCount) throw new RangeError("Page outside document or reversed range");
    if (last - first + 1 > MAX_SELECTED_PAGES - indices.length) throw new RangeError("Too many selected pages");
    for (let page = first; page <= last; page++) indices.push(page - 1);
  }
  return indices;
}

// Only the PDF entry loads the optional codec. Sources are never written.
export async function assemblePdfPages(sources) {
  if (!Array.isArray(sources) || !sources.length || sources.length > MAX_SOURCES) throw new RangeError("Expected 1 to 32 PDF sources");
  let totalBytes = 0;
  // Snapshot the selection and bytes before awaiting the codec or yielding to callers.
  const inputs = Array.from(sources, source => {
    if (!(source?.bytes instanceof Uint8Array) || !source.bytes.length) throw new TypeError("Expected nonempty PDF bytes");
    totalBytes += source.bytes.length;
    if (totalBytes > MAX_INPUT_BYTES) throw new RangeError("PDF inputs exceed 32 MiB");
    return { bytes: new Uint8Array(source.bytes), pages: source.pages };
  });
  const { PDFDocument } = await import("pdf-lib");
  const output = await PDFDocument.create();
  for (const { bytes, pages } of inputs) {
    const source = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: true });
    const indices = selectPdfPages(pages, source.getPageCount());
    if (output.getPageCount() + indices.length > MAX_SELECTED_PAGES) throw new RangeError("Too many selected pages");
    for (const page of await output.copyPages(source, indices)) output.addPage(page);
  }
  return output.save();
}
