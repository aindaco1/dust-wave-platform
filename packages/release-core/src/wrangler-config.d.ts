export type WranglerPrimitive = string | number | boolean;
export type WranglerBinding = Record<string, WranglerPrimitive>;

export interface WranglerInventory {
  name: string;
  environment: string;
  compatibilityDate: string;
  compatibilityFlags: unknown[];
  cache: { enabled: boolean; crossVersionCache: boolean };
  cachedExports: string[];
  vars: Record<string, unknown>;
  kvNamespaces: WranglerBinding[];
  r2Buckets: WranglerBinding[];
  durableObjects: WranglerBinding[];
  routes: WranglerBinding[];
  migrations: WranglerBinding[];
}

export function parseWranglerConfig(content?: unknown): Record<string, unknown>;
export function normalizeWranglerInventory(
  content?: string | Record<string, unknown>,
  options?: { environment?: unknown }
): WranglerInventory;
