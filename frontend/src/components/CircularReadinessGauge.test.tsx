import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CircularReadinessGauge } from "./CircularReadinessGauge";

describe("CircularReadinessGauge", () => {
  it.each([9, 31.4, 54.4, 100])("keeps %s%% inside a fixed square gauge", (score) => {
    const { container, unmount } = render(
      <CircularReadinessGauge readinessScore={score} label="READY" size={110} />,
    );

    const percentage = screen.getByText(`${score}%`);
    const label = screen.getByText("READY");
    const gauge = percentage.parentElement?.parentElement?.parentElement;

    expect(label.previousElementSibling).toBe(percentage);
    expect(percentage).toHaveClass("whitespace-nowrap", "leading-none");
    expect(percentage.style.fontSize).toBe(
      `${score}%`.length >= 5
        ? "clamp(0.9375rem, 19cqi, 1.625rem)"
        : "clamp(1rem, 22cqi, 1.875rem)",
    );
    expect(label).toHaveClass("leading-none", "text-center");
    expect(gauge).toHaveClass("aspect-square", "shrink-0");
    expect(gauge?.style.width).toBe("110px");
    expect(gauge?.style.height).toBe("110px");
    expect(gauge?.style.flexBasis).toBe("110px");
    expect(container.querySelectorAll("circle")).toHaveLength(2);
    expect(container.querySelector("#innerCreamGradient")).not.toBeInTheDocument();

    unmount();
  });
});
