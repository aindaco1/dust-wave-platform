export interface DocumentationOptions {
  root: string;
  /** Absolute paths discovered by the consumer; no implicit repository traversal. */
  files: string[];
  requiredFiles?: string[];
  restrictToRoot?: boolean;
  malformedLinks?: 'throw' | 'report';
  anchorError?: string;
  validateSource?: (source: string, label: string) => string[];
}
export function checkDocumentation(options: DocumentationOptions): {
  errors: string[];
  markdownFileCount: number;
  localLinkCount: number;
};
