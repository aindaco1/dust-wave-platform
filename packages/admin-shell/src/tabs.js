import "./tabs-browser.js";

const { mountResponsiveTabSelect } = globalThis.DustWaveAdminShellTabs;

export { mountResponsiveTabSelect };

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
