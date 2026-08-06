export interface MinifyAssetOptions {
  maxPasses?: number;
}

export interface MinifySiteAssetsOptions {
  siteDir?: string;
  assetDirectories?: string | string[];
  write?: boolean;
}

export interface MinifiedAssetResult {
  file: string;
  changed: boolean;
  bytesBefore: number;
  bytesAfter: number;
  bytesSaved: number;
}

export interface MinifySiteAssetsResult {
  siteDir: string;
  assetDirectories: string[];
  mode: "write" | "check";
  filesChecked: number;
  minifiedCount: number;
  bytesBefore: number;
  bytesAfter: number;
  bytesSaved: number;
  results: MinifiedAssetResult[];
}

export function normalizeRepoPath(repoPath: unknown): string;
export function normalizeAssetDirectories(
  assetDirectories?: string | string[]
): string[];
export function isMinifiableAssetPath(
  repoPath: unknown,
  siteDir?: string,
  assetDirectories?: string | string[]
): boolean;
export function minifyAssetSource(
  source: unknown,
  repoPath: string,
  options?: MinifyAssetOptions
): Promise<string>;
export function minifySiteAssets(
  options?: MinifySiteAssetsOptions
): Promise<MinifySiteAssetsResult>;
