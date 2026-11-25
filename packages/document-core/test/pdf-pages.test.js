import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { selectPdfPages, assemblePdfPages } from "../src/pdf-pages.js";

async function fixture(widths) {
  const doc = await PDFDocument.create();
  for (const width of widths) doc.addPage([width, 400]);
  return doc.save();
}

test("copies real pages in the requested order, including repetitions and multiple sources", async () => {
  const bytes = await fixture([100, 200, 300]);
  const other = await fixture([400]);
  const saved = bytes.slice();
  const output = await assemblePdfPages([{ bytes, pages: "3,1-2,3" }, { bytes: other }]);
  const pages = (await PDFDocument.load(output)).getPages();
  assert.deepEqual(pages.map(page => page.getWidth()), [300, 100, 200, 300, 400]);
  assert.notEqual(pages[0].ref.toString(), pages[3].ref.toString());
  assert.deepEqual(bytes, saved);
});

test("rejects invalid and oversized requests before expanding ranges", async () => {
  for (const selection of ["", "0", "2-1", "4", "1,,2", "1e1", "1.5", "1-9999999999"]) {
    assert.throws(() => selectPdfPages(selection, 3));
  }
  assert.throws(() => selectPdfPages("1-1000000", 1000000), RangeError);
  await assert.rejects(assemblePdfPages([]));
  await assert.rejects(assemblePdfPages([{ bytes: new Uint8Array([1,2,3]) }]));
  await assert.rejects(assemblePdfPages([{ bytes: await fixture([5]), pages: "2" }]));
});
