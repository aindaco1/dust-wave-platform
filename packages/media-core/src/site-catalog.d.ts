export const MEDIA_RESPONSIVE_WIDTHS: readonly number[];
export const MEDIA_MANIFEST_VERSION: 1;
export function normalizeMediaRepoPath(value?: unknown): string;
export function mediaPublicPath(value?: unknown): string;
export function mediaPathExtension(value?: unknown): string;
export function mediaPathLabel(value?: unknown): string;
export function responsiveImageDerivativeInfo(value?: unknown): { basePath: string; width: number } | null;
export function probableResponsiveImageSourcePaths(value?: unknown): string[];
export function probableVideoSourcePaths(value?: unknown): string[];
export function createMediaCatalog(options: {
  scopeForPath(path: string): string;
  entitySlugForPath?(path: string): string;
  entitySlugKey?: string;
  placementBudgets: Record<string, Record<string, unknown>>;
  defaultPlacement: string;
  includeWebmAudio?: boolean;
  includeBrokenReferences?: boolean;
}): {
  classifyMediaPath(value?: unknown, knownPaths?: Set<string> | string[] | null): Record<string, unknown> | null;
  expectedMediaDerivativePaths(value?: unknown, metadata?: Record<string, unknown>): string[];
  normalizeMediaManifest(value?: unknown): Record<string, unknown>;
  mediaPlacementBudget(placement?: unknown): Record<string, unknown>;
};
