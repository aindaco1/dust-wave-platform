import type { NmGrtStarterLocation } from "./nm-grt-starter.js";

export interface NmGrtStarterSeed {
  city: string;
  county: string;
  postalCode: string;
  street_number: string;
  street_name: string;
  street_suffix?: string;
  street_post_directional?: string;
  pre_direction?: string;
}

export interface UpdateNmGrtStarterOptions {
  apiBase?: string;
  outputPath: string;
  seeds?: readonly NmGrtStarterSeed[];
  fetchImpl?: typeof fetch;
  writeFileImpl?: (
    path: string,
    source: string,
    encoding: "utf8"
  ) => Promise<unknown>;
  generatedAt?: string;
}

export const DEFAULT_NM_GRT_API_BASE: "https://grt.edacnm.org";
export const NM_GRT_STARTER_ADDRESSES: readonly NmGrtStarterSeed[];
export function lookupNmGrtAddress(
  apiBase: string,
  seed: NmGrtStarterSeed,
  fetchImpl?: typeof fetch
): Promise<NmGrtStarterLocation>;
export function renderNmGrtStarterModule(
  entries: unknown[],
  apiBase: string,
  generatedAt: string
): string;
export function updateNmGrtStarter(
  options: UpdateNmGrtStarterOptions
): Promise<{
  entries: NmGrtStarterLocation[];
  generatedAt: string;
  outputPath: string;
  source: string;
}>;
