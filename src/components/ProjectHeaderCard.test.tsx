import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProjectHeaderCard from "./ProjectHeaderCard";

type Props = Parameters<typeof ProjectHeaderCard>[0];

function baseProps(overrides: Partial<Props> = {}): Props {
  return {
    flashOptions: [2, 4, 8, 16],
    flashSizeMb: 2,
    projectPath: "",
    sdkconfigFile: "",
    sdkconfigFiles: [],
    syncSdkconfig: false,
    partitionFilename: "partitions.csv",
    partitionOffset: "0x8000",
    statusMessage: "Select an ESP-IDF project folder to begin.",
    isBusy: false,
    hasSnapshot: false,
    onFlashSizeChange: () => undefined,
    onSdkconfigFileChange: () => undefined,
    onSyncSdkconfigChange: () => undefined,
    onLoad: () => undefined,
    onSave: () => undefined,
    onClose: () => undefined,
    onReset: () => undefined,
    ...overrides,
  };
}

describe("ProjectHeaderCard", () => {
  it("shows the empty-project prompt when no project is loaded", () => {
    render(<ProjectHeaderCard {...baseProps()} />);
    expect(screen.getByText(/No project selected/)).toBeInTheDocument();
  });

  it("renders the status message", () => {
    render(<ProjectHeaderCard {...baseProps({ statusMessage: "Project closed." })} />);
    expect(screen.getByText("Project closed.")).toBeInTheDocument();
  });

  it("shows the project path and partition metadata when a project is loaded", () => {
    render(
      <ProjectHeaderCard
        {...baseProps({
          projectPath: "C:/dev/esp-project",
          partitionFilename: "custom.csv",
          partitionOffset: "0x9000",
        })}
      />,
    );

    expect(screen.getByText("C:/dev/esp-project")).toBeInTheDocument();
    expect(screen.getByText("Partition File:")).toBeInTheDocument();
    expect(screen.getByText("custom.csv")).toBeInTheDocument();
    expect(screen.getByText("Partition Start:")).toBeInTheDocument();
    expect(screen.getByText("0x9000")).toBeInTheDocument();
  });

  it("invokes onFlashSizeChange with a numeric value", () => {
    const onFlashSizeChange = vi.fn();
    render(<ProjectHeaderCard {...baseProps({ onFlashSizeChange })} />);

    fireEvent.change(screen.getByTitle("Select flash size"), { target: { value: "16" } });
    expect(onFlashSizeChange).toHaveBeenCalledWith(16);
  });

  it("invokes onLoad when the Load Project button is clicked", () => {
    const onLoad = vi.fn();
    render(<ProjectHeaderCard {...baseProps({ onLoad })} />);

    fireEvent.click(screen.getByRole("button", { name: /Load Project/ }));
    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  it("disables Save and Close while no project is loaded", () => {
    render(<ProjectHeaderCard {...baseProps()} />);
    expect(screen.getByRole("button", { name: /Save/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Close/ })).toBeDisabled();
  });

  it("enables Save once a project is loaded and forwards the click", () => {
    const onSave = vi.fn();
    render(<ProjectHeaderCard {...baseProps({ projectPath: "C:/dev/esp", onSave })} />);

    const saveButton = screen.getByRole("button", { name: /Save/ });
    expect(saveButton).toBeEnabled();
    fireEvent.click(saveButton);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("disables Reset until a snapshot exists", () => {
    const { rerender } = render(<ProjectHeaderCard {...baseProps({ hasSnapshot: false })} />);
    expect(screen.getByRole("button", { name: /Reset/ })).toBeDisabled();

    rerender(<ProjectHeaderCard {...baseProps({ hasSnapshot: true })} />);
    expect(screen.getByRole("button", { name: /Reset/ })).toBeEnabled();
  });

  it("hides the sdkconfig sync controls until a project is loaded", () => {
    render(<ProjectHeaderCard {...baseProps()} />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("toggles sdkconfig sync when a project is loaded", () => {
    const onSyncSdkconfigChange = vi.fn();
    render(
      <ProjectHeaderCard
        {...baseProps({ projectPath: "C:/dev/esp", syncSdkconfig: false, onSyncSdkconfigChange })}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox"));
    expect(onSyncSdkconfigChange).toHaveBeenCalledWith(true);
  });
});
