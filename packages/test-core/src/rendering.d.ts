export interface RenderingPage {
  evaluate<T, A>(callback: (arg: A) => T | Promise<T>, arg: A): Promise<T>;
  route(url: string, handler: (route: { fulfill(response: { contentType: string; body: string }): Promise<void> }) => unknown): Promise<void>;
  addStyleTag(options: { url: string }): Promise<unknown>;
}
export function waitForStableRendering(page: Pick<RenderingPage, 'evaluate'>, fontTimeoutMs?: number): Promise<void>;
export function applyTextScale(page: RenderingPage, percent?: number, options?: { pathPrefix?: string }): Promise<void>;
