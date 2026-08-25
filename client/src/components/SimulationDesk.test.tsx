/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import SimulationDesk from "./SimulationDesk";
import { defaultEvents, defaultLinks, defaultNodes } from "@/lib/network-sim";

describe("SimulationDesk", () => {
  it("renders comparison rows and filters the visible event log", () => {
    render(
      <SimulationDesk
        nodes={defaultNodes}
        links={defaultLinks}
        events={defaultEvents}
        onFrame={vi.fn()}
        onSaveExperiment={vi.fn()}
      />,
    );

    expect(screen.getByText("Algorithm response")).toBeTruthy();
    expect(screen.getAllByText("Dijkstra").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Adaptive").length).toBeGreaterThan(0);

    const search = screen.getByRole("textbox", { name: "Search event log" });
    fireEvent.change(search, { target: { value: "controller" } });
    expect(screen.getByText(/Simulation controller ready/i)).toBeTruthy();

    fireEvent.change(search, { target: { value: "unmatched" } });
    expect(screen.getByText("No matching log entries.")).toBeTruthy();
  });
});
