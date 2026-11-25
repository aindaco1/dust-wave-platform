/** Return zero-based indices in the requested order. Public selection numbers are one-based. */
export function selectPdfPages(selection: string | undefined, pageCount: number): number[];
export function assemblePdfPages(sources: readonly { bytes: Uint8Array; pages?: string }[]): Promise<Uint8Array>;
