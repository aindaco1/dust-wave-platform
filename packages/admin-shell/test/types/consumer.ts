import { AdminApiClient, AdminApiError } from "@dustwave/admin-shell/api-client";
import { mountAccessibleTabs, mountResponsiveTabSelect } from "@dustwave/admin-shell/tabs";
import { setDirtyButtonState } from "@dustwave/admin-shell/dirty-controls";
import { mountUnsavedChangesGuard } from "@dustwave/admin-shell/unsaved-changes";
import { minimumFlexibleWidth, responsiveTurnstileSize } from "@dustwave/admin-shell/turnstile";

const root = document.createElement("div");
const client = new AdminApiClient({ baseUrl: "https://example.test", fetchImpl: fetch });
client.setCsrfToken("token");
client.clearCsrfToken();
const payload: Promise<unknown> = client.request("/settings", { method: "POST", body: { enabled: true }, signal: new AbortController().signal });
const error: number = new AdminApiError("Failed", { status: 403 }).status;
const tabs = mountAccessibleTabs(root, { storage: null, responsiveSelect: { label: "Sections" }, onSelect(name, tab) { tab.dataset.tab = name; } });
tabs.select("settings", { focus: true });
tabs.tabs[0]?.focus();
tabs.responsiveSelect?.refresh().sync("settings").destroy();
mountResponsiveTabSelect(root, { tabs: () => [root], value: tab => tab.id }).select.focus();
const dirty: boolean = setDirtyButtonState(root, true);
const guard = mountUnsavedChangesGuard({ hasUnsavedChanges: () => dirty, eventTarget: window });
guard.confirmTransition("Leave?", () => false);
guard.hasUnsavedChanges();
guard.disconnect();
const size: "compact" | "flexible" = responsiveTurnstileSize(root);
const width: 300 = minimumFlexibleWidth;
void [payload, error, size, width];
// @ts-expect-error credential policy must use Fetch's supported values
new AdminApiClient({ baseUrl: "/", credentials: "anything" });
// @ts-expect-error the caller must explicitly narrow an unknown response
const unchecked: Promise<{ ok: true }> = client.request("/");
// @ts-expect-error a dirty-state callback is required
mountUnsavedChangesGuard({});
// @ts-expect-error control results are not tab names
const name: string = mountResponsiveTabSelect(root);
