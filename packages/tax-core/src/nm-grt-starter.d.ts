export interface NmGrtSampleAddress {
  street_number: string;
  street_name: string;
  street_suffix?: string;
  street_post_directional?: string;
  pre_direction?: string;
  city: string;
  zipcode: string;
  county: string;
}

export interface NmGrtStarterLocation {
  city: string;
  cityAliases: string[];
  county: string;
  postalCodes: string[];
  locationCode: string;
  effectiveRate: number;
  source: string;
  sampleAddress: NmGrtSampleAddress;
}

export const NM_GRT_STARTER_METADATA: {
  generatedAt: string;
  source: string;
  notes: string;
};
export const NM_GRT_STARTER_LOCATIONS: NmGrtStarterLocation[];
