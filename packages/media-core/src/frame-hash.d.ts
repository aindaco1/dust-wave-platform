/** Normalize equivalent sample aspect ratios in bounded FFmpeg framehash text.
 * Throws TypeError for missing/malformed ratios or oversized/non-string input.
 * All other frame, geometry, and timing evidence is preserved verbatim. */
export declare function normalizeFrameHashAspectRatios(frameHash: string): string;
