export function mountAccessibleTabs(root, {
  initialTab,
  responsiveSelect,
  storageKey,
  storage = globalThis.sessionStorage,
  onSelect
} = {}) {
  if (!root?.querySelectorAll) throw new TypeError("A tab root is required");
  const tabs = Array.from(root.querySelectorAll('[role="tab"]'));
  const panels = Array.from(root.querySelectorAll('[role="tabpanel"]'));
  if (tabs.length === 0) throw new TypeError("At least one tab is required");
  let responsiveControl;

  function tabName(tab) {
    return tab.dataset.tab || tab.id || "";
  }

  function select(name, { focus = false, persist = true } = {}) {
    const selected = tabs.find((tab) => tabName(tab) === name) || tabs[0];
    tabs.forEach((tab) => {
      const active = tab === selected;
      tab.setAttribute("aria-selected", active ? "true" : "false");
      tab.tabIndex = active ? 0 : -1;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.getAttribute("aria-labelledby") !== selected.id;
    });
    if (focus) selected.focus();
    if (persist && storageKey && storage) {
      storage.setItem(storageKey, tabName(selected));
    }
    responsiveControl?.sync(tabName(selected));
    onSelect?.(tabName(selected), selected);
    return tabName(selected);
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => select(tabName(tab)));
    tab.addEventListener("keydown", (event) => {
      const key = event.key;
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(key)) return;
      event.preventDefault();
      const targetIndex = key === "Home"
        ? 0
        : key === "End"
          ? tabs.length - 1
          : (index + (key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      select(tabName(tabs[targetIndex]), { focus: true });
    });
  });

  if (responsiveSelect) {
    responsiveControl = mountResponsiveTabSelect(root, {
      ...responsiveSelect,
      tabs,
      activate: (name) => select(name)
    });
  }
  const stored = storageKey && storage ? storage.getItem(storageKey) : "";
  select(initialTab || stored || tabName(tabs[0]), { persist: false });
  return { select, tabs, panels, responsiveSelect: responsiveControl };
}

let responsiveSelectSequence = 0;

export function mountResponsiveTabSelect(root, {
  activate,
  id,
  label,
  labelClass = "dw-admin-mobile-tabs__label",
  selectClass = "dw-admin-mobile-tabs__control",
  tabs = Array.from(root?.querySelectorAll?.('[role="tab"]') ?? []),
  wrapperClass = "dw-admin-mobile-tabs"
} = {}) {
  if (!root?.ownerDocument) throw new TypeError("A tab root is required");
  if (typeof activate !== "function") {
    throw new TypeError("A tab activation function is required");
  }
  if (tabs.length === 0) throw new TypeError("At least one tab is required");

  const document = root.ownerDocument;
  const tabList = tabs[0].closest?.('[role="tablist"]');
  if (!tabList) throw new TypeError("A tab list is required");
  const wrapper = document.createElement("div");
  const labelElement = document.createElement("label");
  const selectElement = document.createElement("select");
  const selectId = id
    || `${root.id || "dw-admin-mobile-tabs"}-${++responsiveSelectSequence}`;

  wrapper.className = wrapperClass;
  labelElement.className = labelClass;
  labelElement.htmlFor = selectId;
  labelElement.textContent =
    label || tabList.getAttribute("aria-label") || "Sections";
  selectElement.className = selectClass;
  selectElement.id = selectId;

  for (const tab of tabs) {
    const value = tab.dataset.tab || tab.id || "";
    if (!value) throw new TypeError("Every tab requires an identifier");
    const option = document.createElement("option");
    option.value = value;
    option.textContent = tab.textContent?.trim() || value;
    selectElement.append(option);
  }

  selectElement.addEventListener("change", () => {
    const selected = tabs.find((tab) =>
      (tab.dataset.tab || tab.id || "") === selectElement.value
    );
    if (selected) activate(selectElement.value, selected);
  });
  wrapper.hidden = tabs.length < 2;
  wrapper.append(labelElement, selectElement);
  tabList.insertAdjacentElement("afterend", wrapper);

  return {
    element: wrapper,
    label: labelElement,
    select: selectElement,
    sync(name) {
      const matching = Array.from(selectElement.options).find(
        (option) => option.value === name
      );
      if (matching) {
        for (const option of selectElement.options) {
          if (option === matching) option.setAttribute("selected", "");
          else option.removeAttribute("selected");
        }
      }
    }
  };
}
