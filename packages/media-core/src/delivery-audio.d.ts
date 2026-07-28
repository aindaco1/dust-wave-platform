export interface PlayerPeaksDocument {
  schemaVersion: "dustwave-player-peaks-v1";
  version: 2;
  channels: 1;
  sample_rate: 16000;
  samples_per_pixel: number;
  bits: 8;
  length: number;
  data: number[];
}

export interface DeliveryAudioManifest {
  schemaVersion: "podcast-delivery-audio-job-v1";
  jobId: string;
  episodeId: string;
  showId: string;
  source: {
    workingMasterId: string;
    bucketName: string;
    objectKey: string;
    objectBytes: number;
    etag: string;
    mimeType: string;
    sha256: string;
    durationMs: number;
  };
  profile: {
    id: "mp3-44100-stereo-cbr128-frame-v1";
    codec: "mp3";
    sampleRateHz: 44100;
    channels: 2;
    bitrateKbps: 128;
    writeXing: false;
  };
  output: {
    objectKey: string;
    mimeType: "audio/mpeg";
    recommendedPartBytes: 33554432;
  };
  peaks: {
    objectKey: string;
    schemaVersion: "dustwave-player-peaks-v1";
    mimeType: "application/json";
    maximumLength: 8192;
  };
  endpoints: {
    source: string;
    partTemplate: string;
    uploadComplete: string;
    evidenceComplete: string;
  };
  manifestSha256: string;
}

export interface DeliveryAudioReport {
  schemaVersion: "podcast-delivery-audio-report-v1";
  jobId: string;
  manifestSha256: string;
  processorVersion: string;
  sourceSha256: string;
  audio: {
    objectKey: string;
    objectBytes: number;
    sha256: string;
    mimeType: "audio/mpeg";
    durationMs: number;
    streamProfile: "mp3-44100-stereo-cbr128-frame-v1";
    audioCodec: "mp3";
    sampleRateHz: 44100;
    channels: 2;
    bitrateKbps: 128;
    frameBytes: number;
    frameCount: number;
    id3v2Bytes: 0;
    id3v1Bytes: 0;
    fullyDecoded: true;
  };
  peaks: {
    objectKey: string;
    schemaVersion: "dustwave-player-peaks-v1";
    sha256: string;
    objectBytes: number;
    mimeType: "application/json";
    channels: 1;
    sampleRateHz: 16000;
    samplesPerPixel: number;
    bits: 8;
    length: number;
    dataPointCount: number;
  };
  resource: {
    wallMs: number;
    maximumRssBytes: number;
    ffmpegVersion: string;
    ffprobeVersion: string;
  };
}

export const DELIVERY_AUDIO_PROFILE:
  "mp3-44100-stereo-cbr128-frame-v1";
export const DELIVERY_AUDIO_MANIFEST_SCHEMA:
  "podcast-delivery-audio-job-v1";
export const DELIVERY_AUDIO_REPORT_SCHEMA:
  "podcast-delivery-audio-report-v1";
export const PLAYER_PEAKS_SCHEMA: "dustwave-player-peaks-v1";

export function buildDeliveryAudioManifest(
  body: Omit<DeliveryAudioManifest, "manifestSha256">
): Promise<DeliveryAudioManifest>;
export function validateDeliveryAudioManifest(
  value: unknown,
  options?: { expectedHost?: string; expectedBucket?: string }
): Promise<DeliveryAudioManifest>;
export function validatePlayerPeaksDocument(
  value: unknown
): PlayerPeaksDocument;
export function playerPeaksSha256(value: unknown): Promise<string>;
export function validateDeliveryAudioReport(
  value: unknown,
  manifest: DeliveryAudioManifest
): Promise<DeliveryAudioReport>;
export function deliveryAudioReportSha256(
  report: unknown,
  manifest: DeliveryAudioManifest
): Promise<string>;
