import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import RightBar from "@/components/layout/RightBar";

describe("RightBar", () => {
  it("is labelled as a quick guide, not an AI, and hidden below lg", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/home"]}>
        <RightBar />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /quick guide/i })).toBeInTheDocument();
    expect(screen.getByText(/this is not an ai/i)).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("hidden", "lg:flex");
    expect(screen.queryByPlaceholderText(/ask anything/i)).toBeNull();
  });
});
