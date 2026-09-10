import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandLogo } from "./BrandLogo";

describe("BrandLogo", () => {
  it("shows the brand name with decorative original artwork", () => {
    const { container } = render(<BrandLogo />);
    expect(screen.getByText("Lumina Intel")).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute("src", "/branding/lumina-intel.png");
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("keeps the collapsed brand accessible without a visible wordmark", () => {
    render(<BrandLogo compact />);
    expect(screen.getByRole("img", { name: "Lumina Intel" })).toBeInTheDocument();
    expect(screen.queryByText("Lumina Intel")).not.toBeInTheDocument();
  });
});
