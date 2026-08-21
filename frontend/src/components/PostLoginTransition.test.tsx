import { render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { PostLoginTransition } from "./PostLoginTransition";

describe("PostLoginTransition", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders student incoming words and resolves to student message", () => {
    const onComplete = vi.fn();
    render(
      <PostLoginTransition
        role="student"
        userEmail="maya@example.demo"
        onComplete={onComplete}
      />,
    );

    // Initial words rendered
    expect(screen.getByText("Skills")).toBeInTheDocument();
    expect(screen.getByText("Evidence")).toBeInTheDocument();
    expect(screen.getByText("Opportunities")).toBeInTheDocument();

    // Fast-forward past convergence to resolved message
    act(() => {
      vi.advanceTimersByTime(1400);
    });

    expect(screen.getByText(/Welcome back, Maya/i)).toBeInTheDocument();
    expect(screen.getByText(/Find/i)).toBeInTheDocument();
    expect(screen.getByText("opportunities")).toBeInTheDocument();
    expect(screen.getByText(/Your verified skills are ready to work for you/i)).toBeInTheDocument();

    // Fast-forward to completion (4.5s total)
    act(() => {
      vi.advanceTimersByTime(3500);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("renders recruiter words and resolves to recruiter message", () => {
    const onComplete = vi.fn();
    render(
      <PostLoginTransition
        role="recruiter"
        userEmail="recruiter@example.demo"
        onComplete={onComplete}
      />,
    );

    expect(screen.getByText("Candidates")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1400);
    });

    expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
    expect(screen.getByText("talent")).toBeInTheDocument();
    expect(screen.getByText(/Discover candidates through evidence-backed skills/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3500);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
