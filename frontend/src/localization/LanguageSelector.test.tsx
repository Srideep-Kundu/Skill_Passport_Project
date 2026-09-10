import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "../auth/AuthContext";
import { LanguageSelector } from "./LanguageSelector";
import { localeStorageKey, pendingLocaleStorageKey } from "./i18n";

describe("LanguageSelector", () => {
  it("is keyboard-accessible, lists every locale, and persists an LTR selection", async () => {
    const user = userEvent.setup();
    render(<AuthProvider><LanguageSelector /></AuthProvider>);
    const selector = screen.getByRole("combobox");
    expect(selector.getAttribute("aria-label")).toBeTruthy();
    expect(screen.getAllByRole("option")).toHaveLength(20);
    expect(screen.queryByRole("option", { name: "اردو" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "کٲشُر" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "سنڌي" })).not.toBeInTheDocument();

    await user.selectOptions(selector, "hi");
    expect(selector).toHaveValue("hi");
    expect(selector).toHaveAttribute("dir", "ltr");
    expect(localStorage.getItem(localeStorageKey)).toBe("hi");
    expect(sessionStorage.getItem(pendingLocaleStorageKey)).toBe("hi");
    expect(document.documentElement).toHaveAttribute("lang", "hi");
    expect(document.documentElement).toHaveAttribute("dir", "ltr");
    expect(document.documentElement).toHaveAttribute("data-locale", "hi");
  });
});
