export function createStorageShim(): Storage;
export function syncBrowserStorageGlobals(target?: typeof globalThis): void;
export function expectNoHorizontalOverflow(
  page: { evaluate(callback: () => number): Promise<number> },
  options: {
    expectTarget: { poll(callback: () => Promise<number>): { toBeLessThanOrEqual(value: number): Promise<void> } };
    tolerancePixels?: number;
  }
): Promise<void>;
