import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ToastStack from "./ToastStack";
import type { ToastMessage } from "../types";

const TOASTS: ToastMessage[] = [
  { id: "t1", message: "Project loaded.", kind: "success" },
  { id: "t2", message: "sdkconfig sync disabled.", kind: "warning" },
];

describe("ToastStack", () => {
  it("renders nothing when there are no toasts", () => {
    const { container } = render(<ToastStack toasts={[]} onDismiss={() => undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders every toast message", () => {
    render(<ToastStack toasts={TOASTS} onDismiss={() => undefined} />);

    expect(screen.getByText("Project loaded.")).toBeInTheDocument();
    expect(screen.getByText("sdkconfig sync disabled.")).toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(2);
  });

  it("invokes onDismiss with the toast id when its close button is clicked", () => {
    const onDismiss = vi.fn();
    render(<ToastStack toasts={TOASTS} onDismiss={onDismiss} />);

    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(onDismiss).toHaveBeenCalledWith("t1");
  });
});
