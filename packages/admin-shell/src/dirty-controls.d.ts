/** Returns false for a non-button; only recognized buttons are modified. */
export function setDirtyButtonState(
  button: unknown,
  dirty: boolean,
  cleanText?: string,
  dirtyText?: string,
  options?: { disableWhenClean?: boolean; forceDisabled?: boolean }
): boolean;
