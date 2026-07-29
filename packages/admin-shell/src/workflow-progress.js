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
  nav.append(list);
  root.replaceChildren(nav);
  let steps = [];
  let activeStep = "";

  function render() {
    list.replaceChildren(...steps.map((step, index) => {
      const item = document.createElement("li");
      item.className = "dw-admin-workflow__item";
      item.dataset.status = String(step.status || "not_started");
      const button = document.createElement("button");
      button.className = "dw-admin-workflow__button";
      button.type = "button";
      button.dataset.workflowStep = String(step.id);
      button.disabled = Boolean(step.disabled);
      if (step.id === activeStep) button.setAttribute("aria-current", "step");
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
      button.addEventListener("click", () => {
        activeStep = String(step.id);
        render();
        onSelect?.(activeStep, step);
      });
      item.append(button);
      return item;
    }));
  }

  return {
    element: nav,
    setSteps(nextSteps) {
      steps = Array.from(nextSteps || []).map((step) => ({ ...step }));
      if (!steps.some(({ id }) => String(id) === activeStep)) {
        activeStep = String(steps[0]?.id || "");
      }
      render();
    },
    setActive(id) {
      const normalized = String(id || "");
      if (!steps.some((step) => String(step.id) === normalized)) return false;
      activeStep = normalized;
      render();
      return true;
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
