(function(scope) {
  "use strict";

  if (scope.DustWaveAdminShellTabs?.mountResponsiveTabSelect) return;

  let responsiveSelectSequence = 0;
  const responsiveSelects = new WeakMap();

  function tabIdentifier(tab, options) {
    const value = typeof options.value === "function"
      ? options.value(tab)
      : tab.dataset?.tab || tab.id || "";
    return value === undefined || value === null ? "" : String(value);
  }

  function tabLabel(tab, value, options) {
    return String(
      typeof options.optionLabel === "function"
        ? options.optionLabel(tab, value)
        : tab.getAttribute?.("aria-label") || tab.textContent?.trim() || value
    ).trim();
  }

  function setSelectedOption(select, name) {
    const matching = Array.from(select.options).find(
      (option) => option.value === name
    );
    if (!matching) return false;
    for (const option of select.options) {
      if (option === matching) option.setAttribute("selected", "");
      else option.removeAttribute("selected");
    }
    return true;
  }

  function mountResponsiveTabSelect(root, options = {}) {
    if (!root?.ownerDocument) throw new TypeError("A tab root is required");
    const tabList = options.tabList
      || (root.getAttribute?.("role") === "tablist" ? root : null)
      || root.querySelector?.('[role="tablist"]');
    if (!tabList) throw new TypeError("A tab list is required");

    const mounted = responsiveSelects.get(tabList);
    if (mounted) {
      mounted.refresh(options);
      return mounted;
    }

    const document = root.ownerDocument;
    const wrapper = document.createElement(options.wrapperTag || "div");
    const labelElement = document.createElement(options.labelTag || "label");
    const selectElement = document.createElement("select");
    const selectId = options.id
      || `${root.id || tabList.id || "dw-admin-mobile-tabs"}-${++responsiveSelectSequence}`;
    let currentOptions = {};
    let currentTabs = [];

    wrapper.className = options.wrapperClass ?? "dw-admin-mobile-tabs";
    labelElement.className =
      options.labelClass ?? "dw-admin-mobile-tabs__label";
    selectElement.className =
      options.selectClass ?? "dw-admin-mobile-tabs__control";
    selectElement.id = selectId;
    if (labelElement.tagName === "LABEL") labelElement.htmlFor = selectId;
    wrapper.append(labelElement, selectElement);
    tabList.insertAdjacentElement("afterend", wrapper);

    const controller = {
      element: wrapper,
      label: labelElement,
      select: selectElement,
      refresh(nextOptions = {}) {
        currentOptions = { ...currentOptions, ...nextOptions };
        const tabSource = typeof currentOptions.tabs === "function"
          ? currentOptions.tabs()
          : currentOptions.tabs;
        currentTabs = Array.from(
          tabSource
            || tabList.querySelectorAll(
              currentOptions.buttonSelector || '[role="tab"]'
            )
        ).filter((tab) => tab?.nodeType === 1 && !tab.hidden);

        labelElement.textContent =
          currentOptions.label
          || tabList.getAttribute("aria-label")
          || "Sections";
        selectElement.replaceChildren();

        let selectedValue = String(currentOptions.activeValue || "");
        for (const tab of currentTabs) {
          const value = tabIdentifier(tab, currentOptions);
          if (!value) {
            throw new TypeError("Every tab requires an identifier");
          }
          const option = document.createElement("option");
          option.value = value;
          option.textContent = tabLabel(tab, value, currentOptions);
          selectElement.append(option);
          if (
            !selectedValue
            && tab.getAttribute?.("aria-selected") === "true"
          ) {
            selectedValue = value;
          }
        }

        const minimumTabs = Number.isFinite(currentOptions.minimumTabs)
          ? Math.max(0, currentOptions.minimumTabs)
          : 2;
        wrapper.hidden = Boolean(
          (currentOptions.hideWhenTabListHidden !== false && tabList.hidden)
          || currentTabs.length < minimumTabs
        );
        if (selectedValue) setSelectedOption(selectElement, selectedValue);
        return controller;
      },
      sync(name) {
        setSelectedOption(selectElement, String(name || ""));
        return controller;
      },
      destroy() {
        responsiveSelects.delete(tabList);
        wrapper.remove();
      }
    };

    selectElement.addEventListener("change", () => {
      const value = selectElement.value;
      const selected = currentTabs.find(
        (tab) => tabIdentifier(tab, currentOptions) === value
      );
      if (!selected) return;
      if (typeof currentOptions.activate === "function") {
        currentOptions.activate(value, selected);
      } else {
        selected.click?.();
      }
    });

    responsiveSelects.set(tabList, controller);
    return controller.refresh(options);
  }

  Object.defineProperty(scope, "DustWaveAdminShellTabs", {
    configurable: false,
    enumerable: false,
    value: Object.freeze({ mountResponsiveTabSelect }),
    writable: false
  });
})(globalThis);
