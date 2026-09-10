import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandLogo } from "./BrandLogo";

describe("BrandLogo", () => {
  it("shows only the accessible compass artwork without a wordmark", () => {
    const { container } = render(<BrandLogo />);
    expect(screen.queryByText("Lumina Intel")).not.toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute("src", "/branding/favicon.svg");
    expect(screen.getByRole("img", { name: "Lumina Intel" })).toBeInTheDocument();
  });

  it("preserves accessible branding when custom styling is supplied", () => {
    render(<BrandLogo className="rounded-full" />);
    expect(screen.getByRole("img", { name: "Lumina Intel" })).toHaveClass("rounded-full");
    expect(screen.getByRole("img", { name: "Lumina Intel" })).toBeInTheDocument();
    expect(screen.queryByText("Lumina Intel")).not.toBeInTheDocument();
  });
});
