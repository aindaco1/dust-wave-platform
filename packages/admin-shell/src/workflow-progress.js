function statusText(step, labels) {
  return String(
    step.statusLabel
    || labels?.[step.status]
    || step.status
    || ""
  ).trim();
}

export function mountWorkflowProgress(root, {
  label = "Workflow",
  labels = {},
  selectionMode = "progress",
  onSelect
} = {}) {
  if (!root?.ownerDocument) {
    throw new TypeError("A workflow-progress root is required");
  }
  const document = root.ownerDocument;
  const nav = document.createElement("nav");
  nav.className = "dw-admin-workflow";
  nav.setAttribute("aria-label", label);
  const list = document.createElement("ol");
  list.className = "dw-admin-workflow__list";
  const usesTabs = selectionMode === "tabs";
  if (usesTabs) {
    list.setAttribute("role", "tablist");
    list.setAttribute("aria-label", label);
  }
  nav.append(list);
  root.replaceChildren(nav);
  let steps = [];
  let activeStep = "";

  function normalizedId(id) {
    return String(id ?? "");
  }

  function buttonFor(id) {
    const normalized = normalizedId(id);
    return Array.from(list.querySelectorAll("[data-workflow-step]"))
      .find((button) => button.dataset.workflowStep === normalized);
  }

  function select(id, { focus = false, notify = true } = {}) {
    const normalized = normalizedId(id);
    const selectedStep = steps.find(
      (step) => normalizedId(step.id) === normalized
    );
    if (!selectedStep || (usesTabs && selectedStep.disabled)) return false;
    const preserveFocus = focus || list.contains(document.activeElement);
    activeStep = normalized;
    render();
    if (notify) {
      onSelect?.(activeStep, selectedStep);
    }
    if (preserveFocus) {
      buttonFor(normalized)?.focus({ preventScroll: true });
    }
    return true;
  }

  function handleKeydown(event, id) {
    if (!usesTabs) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const available = steps.filter((step) => !step.disabled);
    const currentIndex = available.findIndex(
      (step) => normalizedId(step.id) === normalizedId(id)
    );
    if (currentIndex < 0 || available.length === 0) return;
    event.preventDefault();
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? available.length - 1
        : (
          currentIndex
          + (event.key === "ArrowRight" ? 1 : -1)
          + available.length
        ) % available.length;
    select(available[nextIndex].id, { focus: true });
  }

  function render() {
    list.replaceChildren(...steps.map((step, index) => {
      const item = document.createElement("li");
      item.className = "dw-admin-workflow__item";
      item.dataset.status = String(step.status || "not_started");
      if (usesTabs) item.setAttribute("role", "presentation");
      const button = document.createElement("button");
      button.className = "dw-admin-workflow__button";
      button.type = "button";
      button.dataset.workflowStep = normalizedId(step.id);
      button.disabled = Boolean(step.disabled);
      const active = normalizedId(step.id) === activeStep;
      if (usesTabs) {
        button.setAttribute("role", "tab");
        button.setAttribute("aria-selected", active ? "true" : "false");
        button.tabIndex = active ? 0 : -1;
        button.setAttribute("tabindex", active ? "0" : "-1");
        if (step.controls) {
          button.setAttribute("aria-controls", String(step.controls));
        }
      } else if (active) {
        button.setAttribute("aria-current", "step");
      }
      const number = document.createElement("span");
      number.className = "dw-admin-workflow__number";
      number.setAttribute("aria-hidden", "true");
      number.textContent = String(index + 1);
      const copy = document.createElement("span");
      copy.className = "dw-admin-workflow__copy";
      const name = document.createElement("strong");
      name.textContent = String(step.label || step.id);
      const status = document.createElement("span");
      status.className = "dw-admin-workflow__status";
      status.textContent = statusText(step, labels);
      copy.append(name, status);
      button.append(number, copy);
      button.addEventListener(
        "click",
        () => select(step.id, { focus: true })
      );
      button.addEventListener(
        "keydown",
        (event) => handleKeydown(event, step.id)
      );
      item.append(button);
      return item;
    }));
  }

  return {
    element: nav,
    setSteps(nextSteps) {
      const preserveFocus = list.contains(document.activeElement);
      steps = Array.from(nextSteps || []).map((step) => ({ ...step }));
      const active = steps.find(
        ({ id }) => normalizedId(id) === activeStep
      );
      if (!active || (usesTabs && active.disabled)) {
        const fallback = usesTabs
          ? steps.find((step) => !step.disabled)
          : steps[0];
        activeStep = normalizedId(fallback?.id);
      }
      render();
      if (preserveFocus) {
        buttonFor(activeStep)?.focus({ preventScroll: true });
      }
    },
    setActive(id) {
      return select(id, { notify: false });
    },
    getActive() {
      return activeStep;
    },
    destroy() {
      root.replaceChildren();
      steps = [];
      activeStep = "";
    }
  };
}
