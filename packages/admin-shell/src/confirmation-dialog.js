let dialogSequence = 0;

function normalizedText(value) {
  return String(value ?? "").trim();
}

function closeDialog(dialog, returnFocus) {
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
  if (returnFocus?.isConnected) returnFocus.focus();
}

export function mountConfirmationDialog(root, {
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  requiredMessage = "Complete the required field."
} = {}) {
  if (!root?.ownerDocument) {
    throw new TypeError("A confirmation-dialog root is required");
  }
  const document = root.ownerDocument;
  const sequence = ++dialogSequence;
  const titleId = `dw-admin-dialog-title-${sequence}`;
  const descriptionId = `dw-admin-dialog-description-${sequence}`;
  const dialog = document.createElement("dialog");
  dialog.className = "dw-admin-dialog";
  dialog.setAttribute("aria-labelledby", titleId);
  dialog.setAttribute("aria-describedby", descriptionId);

  const surface = document.createElement("div");
  surface.className = "dw-admin-dialog__surface";
  const title = document.createElement("h2");
  title.id = titleId;
  const description = document.createElement("p");
  description.id = descriptionId;
  const items = document.createElement("ul");
  items.className = "dw-admin-dialog__items";
  const fieldLabel = document.createElement("label");
  fieldLabel.className = "dw-admin-dialog__field";
  const fieldText = document.createElement("span");
  const field = document.createElement("textarea");
  field.name = "confirmationReason";
  field.rows = 4;
  const error = document.createElement("p");
  error.className = "dw-admin-dialog__error";
  error.setAttribute("role", "alert");
  error.hidden = true;
  fieldLabel.append(fieldText, field, error);
  const actions = document.createElement("div");
  actions.className = "dw-admin-dialog__actions";
  const cancel = document.createElement("button");
  cancel.className = "btn btn-outline-light";
  cancel.type = "button";
  const confirm = document.createElement("button");
  confirm.className = "btn btn-danger";
  confirm.type = "button";
  actions.append(cancel, confirm);
  surface.append(title, description, items, fieldLabel, actions);
  dialog.append(surface);
  root.append(dialog);

  let pending = null;
  let returnFocus = null;
  let fieldOptions = null;

  function finish(result) {
    if (!pending) return;
    const resolve = pending;
    pending = null;
    closeDialog(dialog, returnFocus);
    returnFocus = null;
    resolve(result);
  }

  cancel.addEventListener("click", () => {
    finish({ confirmed: false, value: "" });
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    finish({ confirmed: false, value: "" });
  });
  confirm.addEventListener("click", () => {
    const value = fieldOptions ? normalizedText(field.value) : "";
    if (fieldOptions?.required && !value) {
      error.textContent = normalizedText(
        fieldOptions.requiredMessage || requiredMessage
      );
      error.hidden = false;
      field.setAttribute("aria-invalid", "true");
      field.focus();
      return;
    }
    error.hidden = true;
    field.removeAttribute("aria-invalid");
    finish({ confirmed: true, value });
  });

  return {
    element: dialog,
    open({
      title: nextTitle,
      description: nextDescription = "",
      items: nextItems = [],
      field: nextField = null,
      confirmLabel: nextConfirmLabel = confirmLabel,
      cancelLabel: nextCancelLabel = cancelLabel,
      tone = "danger",
      returnFocus: nextReturnFocus = document.activeElement
    } = {}) {
      if (pending) {
        finish({ confirmed: false, value: "" });
      }
      title.textContent = normalizedText(nextTitle);
      description.textContent = normalizedText(nextDescription);
      description.hidden = !description.textContent;
      items.replaceChildren(...Array.from(nextItems || [])
        .map(normalizedText)
        .filter(Boolean)
        .map((item) => {
          const li = document.createElement("li");
          li.textContent = item;
          return li;
        }));
      items.hidden = items.childElementCount === 0;
      fieldOptions = nextField && typeof nextField === "object"
        ? nextField
        : null;
      fieldLabel.hidden = !fieldOptions;
      fieldText.textContent = normalizedText(fieldOptions?.label);
      field.value = normalizedText(fieldOptions?.value);
      const maximumLength = Math.max(
        0,
        Number(fieldOptions?.maxLength) || 0
      );
      if (maximumLength) field.maxLength = maximumLength;
      else field.removeAttribute("maxlength");
      field.required = Boolean(fieldOptions?.required);
      error.hidden = true;
      field.removeAttribute("aria-invalid");
      cancel.textContent = normalizedText(nextCancelLabel) || cancelLabel;
      confirm.textContent = normalizedText(nextConfirmLabel) || confirmLabel;
      confirm.className = tone === "neutral"
        ? "btn btn-outline-light"
        : "btn btn-danger";
      returnFocus = nextReturnFocus;
      if (typeof dialog.showModal === "function") {
        try {
          dialog.showModal();
        } catch {
          dialog.setAttribute("open", "");
        }
      } else {
        dialog.setAttribute("open", "");
      }
      queueMicrotask(() => {
        if (fieldOptions) field.focus();
        else confirm.focus();
      });
      return new Promise((resolve) => {
        pending = resolve;
      });
    },
    close() {
      finish({ confirmed: false, value: "" });
    },
    destroy() {
      finish({ confirmed: false, value: "" });
      dialog.remove();
    }
  };
}
