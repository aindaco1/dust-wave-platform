export interface UnsavedChangesGuard {
  confirmTransition(message?: string, transitionHasUnsavedChanges?: () => boolean): boolean;
  disconnect(): void;
  hasUnsavedChanges(callback?: () => boolean): boolean;
}
/** Dirty-state failures are treated as dirty; confirmation failures deny a transition. */
export function mountUnsavedChangesGuard(options: {
  hasUnsavedChanges: () => boolean;
  confirmDiscard?: (message: string) => boolean;
  eventTarget?: Pick<EventTarget, "addEventListener" | "removeEventListener">;
}): Readonly<UnsavedChangesGuard>;
