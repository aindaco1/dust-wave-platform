export interface ResponsiveTabSelectOptions {
  tabList?: HTMLElement;
  wrapperTag?: string;
  labelTag?: string;
  id?: string;
  wrapperClass?: string;
  labelClass?: string;
  selectClass?: string;
  label?: string;
  tabs?: Iterable<HTMLElement> | ArrayLike<HTMLElement> | (() => Iterable<HTMLElement> | ArrayLike<HTMLElement>);
  buttonSelector?: string;
  activeValue?: string;
  minimumTabs?: number;
  hideWhenTabListHidden?: boolean;
  value?: (tab: HTMLElement) => string | null | undefined;
  optionLabel?: (tab: HTMLElement, value: string) => string;
  activate?: (value: string, tab: HTMLElement) => void;
}
export interface ResponsiveTabSelect {
  element: HTMLElement;
  label: HTMLElement;
  select: HTMLSelectElement;
  refresh(options?: ResponsiveTabSelectOptions): ResponsiveTabSelect;
  sync(name: string): ResponsiveTabSelect;
  destroy(): void;
}
export function mountResponsiveTabSelect(root: HTMLElement, options?: ResponsiveTabSelectOptions): ResponsiveTabSelect;
export interface AccessibleTabsOptions {
  initialTab?: string;
  responsiveSelect?: ResponsiveTabSelectOptions | false;
  storageKey?: string;
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  onSelect?: (name: string, tab: HTMLElement) => void;
}
export function mountAccessibleTabs(root: HTMLElement, options?: AccessibleTabsOptions): {
  select(name: string, options?: { focus?: boolean; persist?: boolean }): string;
  tabs: HTMLElement[];
  panels: HTMLElement[];
  responsiveSelect: ResponsiveTabSelect | undefined;
};
