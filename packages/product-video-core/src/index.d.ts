export type ProductVideoAction =
  | { action: 'wait'; ms: number }
  | { action: 'waitForURLIncludes'; value: string; timeoutMs?: number }
  | { action: 'goto'; url: string; waitAfterMs?: number }
  | { action: 'click'; selector: string; timeoutMs?: number; moveDurationMs?: number; delayMs?: number; waitAfterMs?: number };

export interface ProductVideoFlow {
  name: string;
  initialPath: string;
  presentation?: { stylesheetPath?: string | null };
  capture: {
    fps?: number;
    timingMultiplier?: number;
    preRollMs?: number;
    postRollMs?: number;
    minimumEffectiveFpsRatio?: number;
    viewport?: { width?: number; height?: number };
    shell?: { width?: number; height?: number; radius?: number };
    cursor?: { startX?: number; startY?: number; moveDurationMs?: number };
  };
  actions: ProductVideoAction[];
}

export function normalizeProductVideoBaseUrl(value: unknown, options?: { allowRemote?: boolean }): string;
export function normalizeProductVideoFlow(value: unknown): ProductVideoFlow & { expectedDurationMs: number };
export function resolveProductVideoPathPolicy(options: { cwd?: string; workRoot: string; targetPath: string }): { cwd: string; workRoot: string; targetPath: string };
export function createProductVideoOutputDirectory(options: { cwd?: string; workRoot: string; targetPath: string }): Promise<string>;
export function resolveExistingProductVideoDirectory(options: { cwd?: string; workRoot: string; targetPath: string }): Promise<string>;
export function createProductVideoStageHtml(options: { iframeUrl: string; shell: { width: number; height: number; radius: number }; title?: string }): string;
export function captureProductVideoFrames(options: { chromium: { launch(options: { headless: boolean }): Promise<unknown> }; baseUrl: string; flow: ProductVideoFlow; outputDir: string; allowRemoteOrigin?: boolean }): Promise<Record<string, unknown>>;
export function normalizeProductVideoFormats(values?: string | string[]): string[];
export function createProductVideoRenderPlan(options: { captureManifest: Record<string, unknown>; framesDir: string; outputDir: string; formats?: string | string[]; name?: string }): Record<string, unknown>;
export function runProductVideoCommand(command: string, args: string[], options?: { captureOutput?: boolean }): Promise<{ status: number; stdout: string; stderr: string }>;
export function executeProductVideoRenderPlan(plan: Record<string, unknown>, options?: { runCommand?: typeof runProductVideoCommand }): Promise<Record<string, unknown>>;
