import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CommentsCard from "./CommentsCard";

describe("CommentsCard", () => {
  it("renders the heading and the current comment value", () => {
    render(<CommentsCard comments={"line one\nline two"} onCommentsChange={() => undefined} />);

    expect(screen.getByText("Comments")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("line one\nline two");
  });

  it("invokes onCommentsChange with the new value when edited", () => {
    const onCommentsChange = vi.fn();
    render(<CommentsCard comments="" onCommentsChange={onCommentsChange} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "new note" } });
    expect(onCommentsChange).toHaveBeenCalledWith("new note");
  });
});
