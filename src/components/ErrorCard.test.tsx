import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ErrorCard from "./ErrorCard";
import type { ValidationError } from "../types";

describe("ErrorCard", () => {
  it("shows the valid state when there are no errors", () => {
    render(<ErrorCard errors={[]} />);
    expect(screen.getByText("All partitions are valid.")).toBeInTheDocument();
  });

  it("lists every error message", () => {
    const errors: ValidationError[] = [
      { message: "Partition exceeds flash boundary.", severity: "blocking" },
      { message: "NVS partition is below the recommended minimum.", severity: "warning" },
    ];
    render(<ErrorCard errors={errors} />);

    expect(screen.getByText("Partition exceeds flash boundary.")).toBeInTheDocument();
    expect(screen.getByText("NVS partition is below the recommended minimum.")).toBeInTheDocument();
  });

  it("renders pluralized blocking and warning counts", () => {
    const errors: ValidationError[] = [
      { message: "First blocker", severity: "blocking" },
      { message: "Second blocker", severity: "blocking" },
      { message: "A warning", severity: "warning" },
    ];
    render(<ErrorCard errors={errors} />);

    expect(screen.getByText("2 errors")).toBeInTheDocument();
    expect(screen.getByText("1 warning")).toBeInTheDocument();
  });

  it("uses singular wording for a single blocking error", () => {
    render(<ErrorCard errors={[{ message: "Only one", severity: "blocking" }]} />);
    expect(screen.getByText("1 error")).toBeInTheDocument();
  });

  it("does not render the valid message when errors exist", () => {
    render(<ErrorCard errors={[{ message: "Boom", severity: "blocking" }]} />);
    expect(screen.queryByText("All partitions are valid.")).not.toBeInTheDocument();
  });
});
