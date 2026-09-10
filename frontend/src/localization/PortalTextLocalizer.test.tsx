import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import i18n from "./i18n";
import { PortalTextLocalizer } from "./PortalTextLocalizer";

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage("en");
});

describe("PortalTextLocalizer", () => {
  it("localizes existing portal copy and restores its English source", async () => {
    await i18n.changeLanguage("bn");
    render(
      <>
        <PortalTextLocalizer />
        <h1>Evidence Graph</h1>
        <input aria-label="Search actions" placeholder="Filter skills or evidence keywords..." />
      </>,
    );

    await waitFor(() => expect(screen.getByRole("heading")).toHaveTextContent("প্রমাণ গ্রাফ"));
    expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-label", "Search actions");
    expect(screen.getByRole("textbox")).not.toHaveAttribute("placeholder", "Filter skills or evidence keywords...");

    await i18n.changeLanguage("en");
    await waitFor(() => expect(screen.getByRole("heading")).toHaveTextContent("Evidence Graph"));
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-label", "Search actions");
  });
});
