import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { AuthProvider, useAuth } from "../auth/AuthContext";
import i18n, { pendingLocaleStorageKey } from "./i18n";
import { LanguageSelector } from "./LanguageSelector";
import { LocalizationProvider } from "./LocalizationProvider";

function LoginHarness() {
  const { session, setSession } = useAuth();
  return (
    <>
      <LanguageSelector />
      {!session && (
        <button
          type="button"
          onClick={() => setSession({ access_token: "test-token", token_type: "bearer", role: "student" }, "student@example.test")}
        >
          Complete login
        </button>
      )}
    </>
  );
}

function renderLoginFlow() {
  return render(
    <AuthProvider>
      <LocalizationProvider>
        <LoginHarness />
      </LocalizationProvider>
    </AuthProvider>,
  );
}

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  await i18n.changeLanguage("en");
});

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await i18n.changeLanguage("en");
});

describe("LocalizationProvider login handoff", () => {
  it("keeps and persists the language explicitly chosen before login", async () => {
    const user = userEvent.setup();
    const getPreferences = vi.spyOn(api, "getPreferences").mockResolvedValue({ preferred_locale: "bn" });
    const updatePreferences = vi.spyOn(api, "updatePreferences").mockResolvedValue({ preferred_locale: "hi" });
    renderLoginFlow();

    await user.selectOptions(screen.getByRole("combobox"), "hi");
    await user.click(screen.getByRole("button", { name: "Complete login" }));

    await waitFor(() => expect(updatePreferences).toHaveBeenCalledWith(
      { preferred_locale: "hi" },
      "test-token",
    ));
    expect(getPreferences).not.toHaveBeenCalled();
    expect(screen.getByRole("combobox")).toHaveValue("hi");
    expect(document.documentElement).toHaveAttribute("lang", "hi");
    await waitFor(() => expect(sessionStorage.getItem(pendingLocaleStorageKey)).toBeNull());
  });

  it("restores the account preference when no language was chosen before login", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "getPreferences").mockResolvedValue({ preferred_locale: "bn" });
    const updatePreferences = vi.spyOn(api, "updatePreferences").mockResolvedValue({ preferred_locale: "bn" });
    renderLoginFlow();

    await user.click(screen.getByRole("button", { name: "Complete login" }));

    await waitFor(() => expect(screen.getByRole("combobox")).toHaveValue("bn"));
    expect(updatePreferences).not.toHaveBeenCalled();
  });
});
