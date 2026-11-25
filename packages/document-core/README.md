# Document Core

Import only the entry your application uses. Both operate in memory in browsers and Workers. Consumers own file selection, UI, content, persistence and delivery.

## CSV rows

`readCsvRows(text, options)` returns string rows and an ordered list of distinct issues. The defaults allow 1,048,576 input characters, 10,000 included rows, 256 columns and 65,536 characters per field. Characters are UTF-16 code units. The reader preserves quoted line breaks and doubled quotes. It retains empty terminated rows by default. An optional predicate runs before the row limit and receives an end-of-input flag. An unfinished quoted row is dropped unless the caller selects `incomplete: "keep"`. A row cut off by the input limit is always dropped. The caller owns BOM handling, header mapping and policy for partial results.

## PDF pages

Install the exact optional peer `pdf-lib@1.17.1` when using `assemblePdfPages`. Pass one or more sources, each with a byte array and an optional one-based selection such as `3,1-2,3`. Omit the selection to copy all pages in order. Repetition is intentional. The promise resolves to a new PDF. Invalid selections, unreadable or encrypted sources and exceeded limits reject the operation. `selectPdfPages` can validate a selection without loading the codec.

The limits are 32 sources, 32 MiB of combined source bytes, 4,096 characters per selection and 512 output pages. These are input and output-count limits. The PDF decoder’s CPU and memory use depend on document contents. Page copying serves static documents. Outlines, form behavior, attachments, signatures and document-level metadata are outside the preservation contract. Keep the original file.
